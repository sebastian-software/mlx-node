/**
 * C++ Based N-API Generator
 *
 * Generates N-API bindings by:
 * 1. Reading a C++ template file (templates/binding.cpp)
 * 2. Generating function wrappers based on parsed C++ headers
 * 3. Replacing markers in the template with generated code
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { CppFunction, CppParam, groupByName } from './cpp-header-parser.js';
import { ExportedFunction } from './export-list-parser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface GeneratorOptions {
  templatePath?: string;
}

/**
 * Main generator class
 */
export class CppNapiGenerator {
  private functions: Map<string, CppFunction[]>;
  private exports: Map<string, ExportedFunction>;
  private templatePath: string;

  constructor(
    functions: CppFunction[],
    exports: Map<string, ExportedFunction>,
    options: Partial<GeneratorOptions> = {}
  ) {
    this.functions = groupByName(functions);
    this.exports = exports;
    this.templatePath = options.templatePath ||
      path.join(__dirname, '..', 'templates', 'binding.cpp');
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
    return template
      .replace('// @@FUNCTION_WRAPPERS@@', wrappers)
      .replace('// @@EXPORTS@@', exportLines);
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
        lines.push(`  exports.Set("${name}", Napi::Function::New(env, Wrap_${name}));`);
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
    lines.push('  Napi::Env env = info.Env();');

    if (sorted.length === 1) {
      lines.push(this.generateSingleOverloadBody(sorted[0], '  '));
    } else {
      lines.push(this.generateMultiOverloadBody(name, sorted, '  '));
    }

    lines.push('}');

    return lines.join('\n');
  }

  /**
   * Generate body for single-overload function
   */
  private generateSingleOverloadBody(fn: CppFunction, indent: string): string {
    const lines: string[] = [];

    // Parameter extraction
    for (let i = 0; i < fn.params.length; i++) {
      const param = fn.params[i];
      lines.push(this.generateParamExtraction(param, i, indent));
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
      lines.push(`${indent}${call};`);
      lines.push(`${indent}return env.Undefined();`);
    } else if (fn.returnType === 'array') {
      lines.push(`${indent}mx::array result = ${call};`);
      lines.push(`${indent}return ArrayToNapi(env, result);`);
    } else if (fn.returnType === 'std::vector<array>') {
      lines.push(`${indent}std::vector<mx::array> result = ${call};`);
      lines.push(`${indent}return VecArrayToNapi(env, result);`);
    } else if (fn.returnType === 'bool') {
      lines.push(`${indent}bool result = ${call};`);
      lines.push(`${indent}return Napi::Boolean::New(env, result);`);
    } else if (fn.returnType === 'int' || fn.returnType === 'size_t') {
      lines.push(`${indent}auto result = ${call};`);
      lines.push(`${indent}return Napi::Number::New(env, result);`);
    } else {
      lines.push(`${indent}auto result = ${call};`);
      lines.push(`${indent}return ArrayToNapi(env, result);`);
    }

    return lines.join('\n');
  }

  /**
   * Generate body for multi-overload function with dispatch
   */
  private generateMultiOverloadBody(name: string, overloads: CppFunction[], indent: string): string {
    const primary = overloads[0];

    // Special case: arange
    if (name === 'arange') {
      return this.generateArangeDispatch(indent);
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
      return this.generateVarianceDispatch(name, indent);
    }

    // Regular reduction
    if (hasAxisOverloads && hasAxesOverloads && hasKeepdims) {
      return this.generateReductionDispatch(name, indent);
    }

    // Default: use the most general overload
    return this.generateSingleOverloadBody(primary, indent);
  }

  /**
   * Generate dispatch for arange function
   */
  private generateArangeDispatch(indent: string): string {
    return `${indent}mx::StreamOrDevice s = {};

${indent}if (info.Length() == 1) {
${indent}  double stop = info[0].As<Napi::Number>().DoubleValue();
${indent}  return ArrayToNapi(env, mx::arange(stop, s));
${indent}}

${indent}if (info.Length() == 2) {
${indent}  double start = info[0].As<Napi::Number>().DoubleValue();
${indent}  double stop = info[1].As<Napi::Number>().DoubleValue();
${indent}  return ArrayToNapi(env, mx::arange(start, stop, 1.0, s));
${indent}}

${indent}if (info.Length() >= 3) {
${indent}  double start = info[0].As<Napi::Number>().DoubleValue();
${indent}  double stop = info[1].As<Napi::Number>().DoubleValue();
${indent}  double step = info[2].As<Napi::Number>().DoubleValue();
${indent}  return ArrayToNapi(env, mx::arange(start, stop, step, s));
${indent}}

${indent}return env.Undefined();`;
  }

  /**
   * Generate dispatch for reduction functions (sum, mean, max, etc.)
   */
  private generateReductionDispatch(name: string, indent: string): string {
    return `${indent}mx::array a = NapiToArray(info[0]);
${indent}bool keepdims = false;
${indent}mx::StreamOrDevice s = {};

${indent}if (info.Length() == 1 || info[1].IsUndefined()) {
${indent}  return ArrayToNapi(env, mx::${name}(a, keepdims, s));
${indent}}

${indent}if (info[1].IsNumber()) {
${indent}  int axis = info[1].As<Napi::Number>().Int32Value();
${indent}  if (info.Length() > 2 && info[2].IsBoolean()) {
${indent}    keepdims = info[2].As<Napi::Boolean>().Value();
${indent}  }
${indent}  return ArrayToNapi(env, mx::${name}(a, axis, keepdims, s));
${indent}}

${indent}if (info[1].IsArray()) {
${indent}  std::vector<int> axes = NapiToVecInt(info[1]);
${indent}  if (info.Length() > 2 && info[2].IsBoolean()) {
${indent}    keepdims = info[2].As<Napi::Boolean>().Value();
${indent}  }
${indent}  return ArrayToNapi(env, mx::${name}(a, axes, keepdims, s));
${indent}}

${indent}return ArrayToNapi(env, mx::${name}(a, keepdims, s));`;
  }

  /**
   * Generate dispatch for variance functions (var, std)
   */
  private generateVarianceDispatch(name: string, indent: string): string {
    return `${indent}mx::array a = NapiToArray(info[0]);
${indent}bool keepdims = false;
${indent}int ddof = 0;
${indent}mx::StreamOrDevice s = {};

${indent}if (info.Length() == 1 || info[1].IsUndefined()) {
${indent}  return ArrayToNapi(env, mx::${name}(a, keepdims, ddof, s));
${indent}}

${indent}if (info[1].IsNumber()) {
${indent}  int axis = info[1].As<Napi::Number>().Int32Value();
${indent}  if (info.Length() > 2 && info[2].IsBoolean()) {
${indent}    keepdims = info[2].As<Napi::Boolean>().Value();
${indent}  }
${indent}  if (info.Length() > 3 && info[3].IsNumber()) {
${indent}    ddof = info[3].As<Napi::Number>().Int32Value();
${indent}  }
${indent}  return ArrayToNapi(env, mx::${name}(a, axis, keepdims, ddof, s));
${indent}}

${indent}if (info[1].IsArray()) {
${indent}  std::vector<int> axes = NapiToVecInt(info[1]);
${indent}  if (info.Length() > 2 && info[2].IsBoolean()) {
${indent}    keepdims = info[2].As<Napi::Boolean>().Value();
${indent}  }
${indent}  if (info.Length() > 3 && info[3].IsNumber()) {
${indent}    ddof = info[3].As<Napi::Number>().Int32Value();
${indent}  }
${indent}  return ArrayToNapi(env, mx::${name}(a, axes, keepdims, ddof, s));
${indent}}

${indent}return ArrayToNapi(env, mx::${name}(a, keepdims, ddof, s));`;
  }

  /**
   * Generate parameter extraction code
   */
  private generateParamExtraction(param: CppParam, index: number, indent: string): string {
    const { name, type, defaultValue } = param;
    const hasDefault = !!defaultValue;

    // Array types
    if (type === 'array' || type === 'mx::array') {
      if (hasDefault) {
        return `${indent}mx::array ${name} = info.Length() > ${index} && !info[${index}].IsUndefined() ? NapiToArray(info[${index}]) : ${defaultValue};`;
      }
      return `${indent}mx::array ${name} = NapiToArray(info[${index}]);`;
    }

    // Shape types
    if (type === 'Shape' || type === 'mx::Shape') {
      if (hasDefault) {
        return `${indent}mx::Shape ${name} = info.Length() > ${index} && !info[${index}].IsUndefined() ? NapiToShape(info[${index}]) : mx::Shape${defaultValue};`;
      }
      return `${indent}mx::Shape ${name} = NapiToShape(info[${index}]);`;
    }

    // Vector<int>
    if (type === 'std::vector<int>') {
      if (hasDefault) {
        return `${indent}std::vector<int> ${name} = info.Length() > ${index} && !info[${index}].IsUndefined() ? NapiToVecInt(info[${index}]) : std::vector<int>${defaultValue};`;
      }
      return `${indent}std::vector<int> ${name} = NapiToVecInt(info[${index}]);`;
    }

    // Vector<array>
    if (type === 'std::vector<array>' || type === 'std::vector<mx::array>') {
      return `${indent}std::vector<mx::array> ${name} = NapiToVecArray(info[${index}]);`;
    }

    // Dtype
    if (type === 'Dtype' || type === 'mx::Dtype') {
      let def = defaultValue || 'float32';
      if (!def.startsWith('mx::')) def = `mx::${def}`;
      return `${indent}mx::Dtype ${name} = info.Length() > ${index} && !info[${index}].IsUndefined() ? NapiToDtype(info[${index}]) : ${def};`;
    }

    // StreamOrDevice
    if (type === 'StreamOrDevice' || type === 'mx::StreamOrDevice') {
      return `${indent}mx::StreamOrDevice ${name} = {};`;
    }

    // Primitives
    if (type === 'int') {
      const def = defaultValue || '0';
      if (hasDefault) {
        return `${indent}int ${name} = info.Length() > ${index} && !info[${index}].IsUndefined() ? info[${index}].As<Napi::Number>().Int32Value() : ${def};`;
      }
      return `${indent}int ${name} = info[${index}].As<Napi::Number>().Int32Value();`;
    }

    if (type === 'bool') {
      const def = defaultValue || 'false';
      return `${indent}bool ${name} = info.Length() > ${index} && !info[${index}].IsUndefined() ? info[${index}].As<Napi::Boolean>().Value() : ${def};`;
    }

    if (type === 'double' || type === 'float') {
      const def = defaultValue || '0.0';
      if (hasDefault) {
        return `${indent}double ${name} = info.Length() > ${index} && !info[${index}].IsUndefined() ? info[${index}].As<Napi::Number>().DoubleValue() : ${def};`;
      }
      return `${indent}double ${name} = info[${index}].As<Napi::Number>().DoubleValue();`;
    }

    if (type === 'size_t') {
      const def = defaultValue || '0';
      if (hasDefault) {
        return `${indent}size_t ${name} = info.Length() > ${index} && !info[${index}].IsUndefined() ? static_cast<size_t>(info[${index}].As<Napi::Number>().Int64Value()) : ${def};`;
      }
      return `${indent}size_t ${name} = static_cast<size_t>(info[${index}].As<Napi::Number>().Int64Value());`;
    }

    // String
    if (type === 'std::string' || type === 'string') {
      const def = defaultValue ? `"${defaultValue.replace(/"/g, '')}"` : '""';
      return `${indent}std::string ${name} = info.Length() > ${index} && !info[${index}].IsUndefined() ? info[${index}].As<Napi::String>().Utf8Value() : ${def};`;
    }

    // Optional types
    if (type.includes('optional<array>')) {
      return `${indent}std::optional<mx::array> ${name} = info.Length() > ${index} && !info[${index}].IsUndefined() && !info[${index}].IsNull() ? std::optional<mx::array>(NapiToArray(info[${index}])) : std::nullopt;`;
    }

    if (type.includes('optional<int>')) {
      return `${indent}std::optional<int> ${name} = info.Length() > ${index} && !info[${index}].IsUndefined() && !info[${index}].IsNull() ? std::optional<int>(info[${index}].As<Napi::Number>().Int32Value()) : std::nullopt;`;
    }

    if (type.includes('optional<float>') || type.includes('optional<double>')) {
      return `${indent}std::optional<float> ${name} = info.Length() > ${index} && !info[${index}].IsUndefined() && !info[${index}].IsNull() ? std::optional<float>(info[${index}].As<Napi::Number>().FloatValue()) : std::nullopt;`;
    }

    if (type.includes('optional<Dtype>')) {
      return `${indent}std::optional<mx::Dtype> ${name} = info.Length() > ${index} && !info[${index}].IsUndefined() && !info[${index}].IsNull() ? std::optional<mx::Dtype>(NapiToDtype(info[${index}])) : std::nullopt;`;
    }

    if (type.includes('optional<std::vector<int>>')) {
      return `${indent}std::optional<std::vector<int>> ${name} = info.Length() > ${index} && !info[${index}].IsUndefined() && !info[${index}].IsNull() ? std::optional<std::vector<int>>(NapiToVecInt(info[${index}])) : std::nullopt;`;
    }

    // Strides
    if (type === 'Strides' || type === 'mx::Strides') {
      return `${indent}mx::Strides ${name} = info.Length() > ${index} && !info[${index}].IsUndefined() ? [&]() {
${indent}  mx::Strides s;
${indent}  if (info[${index}].IsArray()) {
${indent}    Napi::Array arr = info[${index}].As<Napi::Array>();
${indent}    for (uint32_t i = 0; i < arr.Length(); i++) {
${indent}      s.push_back(static_cast<size_t>(arr.Get(i).As<Napi::Number>().Int64Value()));
${indent}    }
${indent}  }
${indent}  return s;
${indent}}() : mx::Strides{};`;
    }

    // Pair<int, int>
    if (type === 'std::pair<int, int>' || type.includes('pair<int')) {
      const def = defaultValue || '{1, 1}';
      return `${indent}std::pair<int, int> ${name} = info.Length() > ${index} && !info[${index}].IsUndefined() ? [&]() {
${indent}  if (info[${index}].IsArray()) {
${indent}    Napi::Array arr = info[${index}].As<Napi::Array>();
${indent}    return std::pair<int, int>{arr.Get(0u).As<Napi::Number>().Int32Value(), arr.Get(1u).As<Napi::Number>().Int32Value()};
${indent}  }
${indent}  return std::pair<int, int>${def};
${indent}}() : std::pair<int, int>${def};`;
    }

    // Tuple<int, int, int>
    if (type.includes('tuple<int, int, int>')) {
      const def = defaultValue || '{1, 1, 1}';
      return `${indent}std::tuple<int, int, int> ${name} = info.Length() > ${index} && !info[${index}].IsUndefined() ? [&]() {
${indent}  if (info[${index}].IsArray()) {
${indent}    Napi::Array arr = info[${index}].As<Napi::Array>();
${indent}    return std::tuple<int, int, int>{arr.Get(0u).As<Napi::Number>().Int32Value(), arr.Get(1u).As<Napi::Number>().Int32Value(), arr.Get(2u).As<Napi::Number>().Int32Value()};
${indent}  }
${indent}  return std::tuple<int, int, int>${def};
${indent}}() : std::tuple<int, int, int>${def};`;
    }

    // uint64_t
    if (type === 'uint64_t') {
      const def = defaultValue || '0';
      return `${indent}uint64_t ${name} = info.Length() > ${index} && !info[${index}].IsUndefined() ? static_cast<uint64_t>(info[${index}].As<Napi::Number>().Int64Value()) : ${def};`;
    }

    // Fallback
    console.warn(`Unhandled type: ${type} for param ${name}`);
    return `${indent}// FIXME: Unhandled type ${type} for param ${name}
${indent}int ${name}_UNHANDLED = 0; (void)${name}_UNHANDLED;`;
  }
}
