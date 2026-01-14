/**
 * C++ Based N-API Generator
 *
 * Generates N-API bindings by:
 * 1. Reading a C++ template file (templates/binding.cpp)
 * 2. Generating function wrappers based on parsed C++ headers
 * 3. Replacing markers in the template with generated code
 * 4. Formatting with clang-format
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { CppFunction, CppParam, groupByName } from './cpp-header-parser.js';
import { ExportedFunction } from './export-list-parser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface GeneratorOptions {
  templatePath?: string;
  format?: boolean;
}

/**
 * Main generator class
 */
export class CppNapiGenerator {
  private functions: Map<string, CppFunction[]>;
  private exports: Map<string, ExportedFunction>;
  private templatePath: string;
  private format: boolean;

  constructor(
    functions: CppFunction[],
    exports: Map<string, ExportedFunction>,
    options: Partial<GeneratorOptions> = {}
  ) {
    this.functions = groupByName(functions);
    this.exports = exports;
    this.templatePath = options.templatePath ||
      path.join(__dirname, '..', 'templates', 'binding.cpp');
    this.format = options.format ?? true;
  }

  /**
   * Generate the complete binding.cpp file
   */
  generate(): string {
    // Read template
    const template = fs.readFileSync(this.templatePath, 'utf-8');

    // Generate the dynamic parts
    const wrappers = this.generateFunctionWrappers();
    const exportLines = this.generateExports();

    // Replace markers
    let code = template
      .replace('// @@FUNCTION_WRAPPERS@@', wrappers)
      .replace('// @@EXPORTS@@', exportLines);

    // Format with clang-format
    if (this.format) {
      code = this.formatCode(code);
    }

    return code;
  }

  /**
   * Format code using clang-format
   */
  private formatCode(code: string): string {
    const clangFormatPaths = [
      'clang-format',
      '/usr/bin/clang-format',
      '/Library/Developer/CommandLineTools/usr/bin/clang-format',
      '/usr/local/bin/clang-format',
    ];

    for (const clangFormat of clangFormatPaths) {
      try {
        return execSync(clangFormat, {
          input: code,
          encoding: 'utf-8',
          maxBuffer: 10 * 1024 * 1024,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
      } catch {
        continue;
      }
    }

    console.warn('clang-format not found, skipping formatting');
    return code;
  }

  /**
   * Generate all function wrappers
   */
  private generateFunctionWrappers(): string {
    const lines: string[] = [];

    for (const [name, exported] of this.exports) {
      const overloads = this.functions.get(name);
      if (!overloads || overloads.length === 0) {
        lines.push(`// ${name}: Not found in C++ headers`);
        continue;
      }

      lines.push(this.generateFunctionWrapper(name, overloads));
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Generate export statements
   */
  private generateExports(): string {
    const lines: string[] = [];
    for (const [name, _] of this.exports) {
      if (this.functions.has(name)) {
        lines.push(`exports.Set("${name}", Napi::Function::New(env, Wrap_${name}));`);
      }
    }
    return lines.join('\n');
  }

  /**
   * Generate wrapper for a single function with all its overloads
   */
  private generateFunctionWrapper(name: string, overloads: CppFunction[]): string {
    const lines: string[] = [];

    // Sort overloads by number of required params
    const sorted = [...overloads].sort((a, b) => {
      const aReq = a.params.filter(p => !p.defaultValue).length;
      const bReq = b.params.filter(p => !p.defaultValue).length;
      return aReq - bReq;
    });

    lines.push(`Napi::Value Wrap_${name}(const Napi::CallbackInfo& info) {`);
    lines.push('Napi::Env env = info.Env();');

    if (sorted.length === 1) {
      lines.push(this.generateSingleOverloadBody(sorted[0]));
    } else {
      lines.push(this.generateMultiOverloadBody(name, sorted));
    }

    lines.push('}');

    return lines.join('\n');
  }

  /**
   * Generate body for single-overload function
   */
  private generateSingleOverloadBody(fn: CppFunction): string {
    const lines: string[] = [];

    // Parameter extraction
    for (let i = 0; i < fn.params.length; i++) {
      const param = fn.params[i];
      lines.push(this.generateParamExtraction(param, i));
    }

    // Function call with correct namespace
    const args = fn.params.map(p => p.name).join(', ');
    let nsPrefix = 'mx::';
    if (fn.namespace.includes('linalg')) {
      nsPrefix = 'mx::linalg::';
    } else if (fn.namespace.includes('fft')) {
      nsPrefix = 'mx::fft::';
    } else if (fn.namespace.includes('random')) {
      nsPrefix = 'mx::random::';
    }
    const call = `${nsPrefix}${fn.name}(${args})`;

    if (fn.returnType === 'void') {
      lines.push(`${call};`);
      lines.push(`return env.Undefined();`);
    } else if (fn.returnType === 'array') {
      lines.push(`mx::array result = ${call};`);
      lines.push(`return ArrayToNapi(env, result);`);
    } else if (fn.returnType === 'std::vector<array>') {
      lines.push(`std::vector<mx::array> result = ${call};`);
      lines.push(`return VecArrayToNapi(env, result);`);
    } else if (fn.returnType === 'bool') {
      lines.push(`bool result = ${call};`);
      lines.push(`return Napi::Boolean::New(env, result);`);
    } else if (fn.returnType === 'int' || fn.returnType === 'size_t') {
      lines.push(`auto result = ${call};`);
      lines.push(`return Napi::Number::New(env, result);`);
    } else {
      lines.push(`auto result = ${call};`);
      lines.push(`return ArrayToNapi(env, result);`);
    }

    return lines.join('\n');
  }

  /**
   * Generate body for multi-overload function with dispatch
   */
  private generateMultiOverloadBody(name: string, overloads: CppFunction[]): string {
    const primary = overloads[0];

    // Special case: arange
    if (name === 'arange') {
      return this.generateArangeDispatch();
    }

    // Check for reduction patterns
    const hasAxisOverloads = overloads.some(o =>
      o.params.some(p => p.type === 'int' && p.name.includes('axis'))
    );
    const hasAxesOverloads = overloads.some(o =>
      o.params.some(p => p.type === 'std::vector<int>' && p.name.includes('axes'))
    );
    const hasKeepdims = overloads.some(o =>
      o.params.some(p => p.name === 'keepdims')
    );
    const hasDdof = overloads.some(o =>
      o.params.some(p => p.name === 'ddof')
    );

    // var/std special case
    if (hasAxisOverloads && hasAxesOverloads && hasKeepdims && hasDdof) {
      return this.generateVarianceDispatch(name);
    }

    // Regular reduction
    if (hasAxisOverloads && hasAxesOverloads && hasKeepdims) {
      return this.generateReductionDispatch(name);
    }

    // Default: use the most general overload
    return this.generateSingleOverloadBody(primary);
  }

  /**
   * Generate dispatch for arange function
   */
  private generateArangeDispatch(): string {
    return `mx::StreamOrDevice s = {};
if (info.Length() == 1) {
double stop = info[0].As<Napi::Number>().DoubleValue();
return ArrayToNapi(env, mx::arange(stop, s));
}
if (info.Length() == 2) {
double start = info[0].As<Napi::Number>().DoubleValue();
double stop = info[1].As<Napi::Number>().DoubleValue();
return ArrayToNapi(env, mx::arange(start, stop, 1.0, s));
}
if (info.Length() >= 3) {
double start = info[0].As<Napi::Number>().DoubleValue();
double stop = info[1].As<Napi::Number>().DoubleValue();
double step = info[2].As<Napi::Number>().DoubleValue();
return ArrayToNapi(env, mx::arange(start, stop, step, s));
}
return env.Undefined();`;
  }

  /**
   * Generate dispatch for reduction functions (sum, mean, max, etc.)
   */
  private generateReductionDispatch(name: string): string {
    return `mx::array a = NapiToArray(info[0]);
bool keepdims = false;
mx::StreamOrDevice s = {};
if (info.Length() == 1 || info[1].IsUndefined()) {
return ArrayToNapi(env, mx::${name}(a, keepdims, s));
}
if (info[1].IsNumber()) {
int axis = info[1].As<Napi::Number>().Int32Value();
if (info.Length() > 2 && info[2].IsBoolean()) {
keepdims = info[2].As<Napi::Boolean>().Value();
}
return ArrayToNapi(env, mx::${name}(a, axis, keepdims, s));
}
if (info[1].IsArray()) {
std::vector<int> axes = NapiToVecInt(info[1]);
if (info.Length() > 2 && info[2].IsBoolean()) {
keepdims = info[2].As<Napi::Boolean>().Value();
}
return ArrayToNapi(env, mx::${name}(a, axes, keepdims, s));
}
return ArrayToNapi(env, mx::${name}(a, keepdims, s));`;
  }

  /**
   * Generate dispatch for variance functions (var, std)
   */
  private generateVarianceDispatch(name: string): string {
    return `mx::array a = NapiToArray(info[0]);
bool keepdims = false;
int ddof = 0;
mx::StreamOrDevice s = {};
if (info.Length() == 1 || info[1].IsUndefined()) {
return ArrayToNapi(env, mx::${name}(a, keepdims, ddof, s));
}
if (info[1].IsNumber()) {
int axis = info[1].As<Napi::Number>().Int32Value();
if (info.Length() > 2 && info[2].IsBoolean()) {
keepdims = info[2].As<Napi::Boolean>().Value();
}
if (info.Length() > 3 && info[3].IsNumber()) {
ddof = info[3].As<Napi::Number>().Int32Value();
}
return ArrayToNapi(env, mx::${name}(a, axis, keepdims, ddof, s));
}
if (info[1].IsArray()) {
std::vector<int> axes = NapiToVecInt(info[1]);
if (info.Length() > 2 && info[2].IsBoolean()) {
keepdims = info[2].As<Napi::Boolean>().Value();
}
if (info.Length() > 3 && info[3].IsNumber()) {
ddof = info[3].As<Napi::Number>().Int32Value();
}
return ArrayToNapi(env, mx::${name}(a, axes, keepdims, ddof, s));
}
return ArrayToNapi(env, mx::${name}(a, keepdims, ddof, s));`;
  }

  /**
   * Generate parameter extraction code
   */
  private generateParamExtraction(param: CppParam, index: number): string {
    const { name, type, defaultValue } = param;
    const hasDefault = !!defaultValue;

    // Array types
    if (type === 'array' || type === 'mx::array') {
      if (hasDefault) {
        return `mx::array ${name} = info.Length() > ${index} && !info[${index}].IsUndefined() ? NapiToArray(info[${index}]) : ${defaultValue};`;
      }
      return `mx::array ${name} = NapiToArray(info[${index}]);`;
    }

    // Shape types
    if (type === 'Shape' || type === 'mx::Shape') {
      if (hasDefault) {
        return `mx::Shape ${name} = info.Length() > ${index} && !info[${index}].IsUndefined() ? NapiToShape(info[${index}]) : mx::Shape${defaultValue};`;
      }
      return `mx::Shape ${name} = NapiToShape(info[${index}]);`;
    }

    // Vector<int>
    if (type === 'std::vector<int>') {
      if (hasDefault) {
        return `std::vector<int> ${name} = info.Length() > ${index} && !info[${index}].IsUndefined() ? NapiToVecInt(info[${index}]) : std::vector<int>${defaultValue};`;
      }
      return `std::vector<int> ${name} = NapiToVecInt(info[${index}]);`;
    }

    // Vector<array>
    if (type === 'std::vector<array>' || type === 'std::vector<mx::array>') {
      return `std::vector<mx::array> ${name} = NapiToVecArray(info[${index}]);`;
    }

    // Dtype
    if (type === 'Dtype' || type === 'mx::Dtype') {
      let def = defaultValue || 'float32';
      if (!def.startsWith('mx::')) def = `mx::${def}`;
      return `mx::Dtype ${name} = info.Length() > ${index} && !info[${index}].IsUndefined() ? NapiToDtype(info[${index}]) : ${def};`;
    }

    // StreamOrDevice
    if (type === 'StreamOrDevice' || type === 'mx::StreamOrDevice') {
      return `mx::StreamOrDevice ${name} = {};`;
    }

    // Primitives
    if (type === 'int') {
      const def = defaultValue || '0';
      if (hasDefault) {
        return `int ${name} = info.Length() > ${index} && !info[${index}].IsUndefined() ? info[${index}].As<Napi::Number>().Int32Value() : ${def};`;
      }
      return `int ${name} = info[${index}].As<Napi::Number>().Int32Value();`;
    }

    if (type === 'bool') {
      const def = defaultValue || 'false';
      return `bool ${name} = info.Length() > ${index} && !info[${index}].IsUndefined() ? info[${index}].As<Napi::Boolean>().Value() : ${def};`;
    }

    if (type === 'double' || type === 'float') {
      const def = defaultValue || '0.0';
      if (hasDefault) {
        return `double ${name} = info.Length() > ${index} && !info[${index}].IsUndefined() ? info[${index}].As<Napi::Number>().DoubleValue() : ${def};`;
      }
      return `double ${name} = info[${index}].As<Napi::Number>().DoubleValue();`;
    }

    if (type === 'size_t') {
      const def = defaultValue || '0';
      if (hasDefault) {
        return `size_t ${name} = info.Length() > ${index} && !info[${index}].IsUndefined() ? static_cast<size_t>(info[${index}].As<Napi::Number>().Int64Value()) : ${def};`;
      }
      return `size_t ${name} = static_cast<size_t>(info[${index}].As<Napi::Number>().Int64Value());`;
    }

    // String
    if (type === 'std::string' || type === 'string') {
      const def = defaultValue ? `"${defaultValue.replace(/"/g, '')}"` : '""';
      return `std::string ${name} = info.Length() > ${index} && !info[${index}].IsUndefined() ? info[${index}].As<Napi::String>().Utf8Value() : ${def};`;
    }

    // Optional types
    if (type.includes('optional<array>')) {
      return `std::optional<mx::array> ${name} = info.Length() > ${index} && !info[${index}].IsUndefined() && !info[${index}].IsNull() ? std::optional<mx::array>(NapiToArray(info[${index}])) : std::nullopt;`;
    }

    if (type.includes('optional<int>')) {
      return `std::optional<int> ${name} = info.Length() > ${index} && !info[${index}].IsUndefined() && !info[${index}].IsNull() ? std::optional<int>(info[${index}].As<Napi::Number>().Int32Value()) : std::nullopt;`;
    }

    if (type.includes('optional<float>') || type.includes('optional<double>')) {
      return `std::optional<float> ${name} = info.Length() > ${index} && !info[${index}].IsUndefined() && !info[${index}].IsNull() ? std::optional<float>(info[${index}].As<Napi::Number>().FloatValue()) : std::nullopt;`;
    }

    if (type.includes('optional<Dtype>')) {
      return `std::optional<mx::Dtype> ${name} = info.Length() > ${index} && !info[${index}].IsUndefined() && !info[${index}].IsNull() ? std::optional<mx::Dtype>(NapiToDtype(info[${index}])) : std::nullopt;`;
    }

    if (type.includes('optional<std::vector<int>>')) {
      return `std::optional<std::vector<int>> ${name} = info.Length() > ${index} && !info[${index}].IsUndefined() && !info[${index}].IsNull() ? std::optional<std::vector<int>>(NapiToVecInt(info[${index}])) : std::nullopt;`;
    }

    // Strides
    if (type === 'Strides' || type === 'mx::Strides') {
      return `mx::Strides ${name} = info.Length() > ${index} && !info[${index}].IsUndefined() ? [&]() {
mx::Strides s;
if (info[${index}].IsArray()) {
Napi::Array arr = info[${index}].As<Napi::Array>();
for (uint32_t i = 0; i < arr.Length(); i++) {
s.push_back(static_cast<size_t>(arr.Get(i).As<Napi::Number>().Int64Value()));
}
}
return s;
}() : mx::Strides{};`;
    }

    // Pair<int, int>
    if (type === 'std::pair<int, int>' || type.includes('pair<int')) {
      const def = defaultValue || '{1, 1}';
      return `std::pair<int, int> ${name} = info.Length() > ${index} && !info[${index}].IsUndefined() ? [&]() {
if (info[${index}].IsArray()) {
Napi::Array arr = info[${index}].As<Napi::Array>();
return std::pair<int, int>{arr.Get(0u).As<Napi::Number>().Int32Value(), arr.Get(1u).As<Napi::Number>().Int32Value()};
}
return std::pair<int, int>${def};
}() : std::pair<int, int>${def};`;
    }

    // Tuple<int, int, int>
    if (type.includes('tuple<int, int, int>')) {
      const def = defaultValue || '{1, 1, 1}';
      return `std::tuple<int, int, int> ${name} = info.Length() > ${index} && !info[${index}].IsUndefined() ? [&]() {
if (info[${index}].IsArray()) {
Napi::Array arr = info[${index}].As<Napi::Array>();
return std::tuple<int, int, int>{arr.Get(0u).As<Napi::Number>().Int32Value(), arr.Get(1u).As<Napi::Number>().Int32Value(), arr.Get(2u).As<Napi::Number>().Int32Value()};
}
return std::tuple<int, int, int>${def};
}() : std::tuple<int, int, int>${def};`;
    }

    // uint64_t
    if (type === 'uint64_t') {
      const def = defaultValue || '0';
      return `uint64_t ${name} = info.Length() > ${index} && !info[${index}].IsUndefined() ? static_cast<uint64_t>(info[${index}].As<Napi::Number>().Int64Value()) : ${def};`;
    }

    // Fallback
    console.warn(`Unhandled type: ${type} for param ${name}`);
    return `// FIXME: Unhandled type ${type} for param ${name}
int ${name}_UNHANDLED = 0; (void)${name}_UNHANDLED;`;
  }
}
