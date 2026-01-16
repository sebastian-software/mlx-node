/**
 * C++ Based N-API Generator
 *
 * Generates N-API bindings using:
 * - Template files for static C++ code
 * - Data-driven type extraction
 * - clang-format for output formatting
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { CppFunction, CppParam, groupByName } from './cpp-header-parser.js';
import { ExportedFunction } from './export-list-parser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// =============================================================================
// Type Extraction Registry
// =============================================================================

interface TypeHandler {
  cppType: string;
  extract: string;           // $i = index, $d = default
  defaultPrefix?: string;    // Prefix for default value (e.g., 'mx::')
  fixedValue?: string;       // For types like StreamOrDevice that don't use info[]
}

const TYPE_HANDLERS: Record<string, TypeHandler> = {
  // Array types
  'array':                    { cppType: 'mx::array', extract: 'NapiToArray(info[$i])' },
  'mx::array':                { cppType: 'mx::array', extract: 'NapiToArray(info[$i])' },

  // Shape/Vector types
  'Shape':                    { cppType: 'mx::Shape', extract: 'NapiToShape(info[$i])', defaultPrefix: 'mx::Shape' },
  'mx::Shape':                { cppType: 'mx::Shape', extract: 'NapiToShape(info[$i])', defaultPrefix: 'mx::Shape' },
  'std::vector<int>':         { cppType: 'std::vector<int>', extract: 'NapiToVecInt(info[$i])', defaultPrefix: 'std::vector<int>' },
  'std::vector<array>':       { cppType: 'std::vector<mx::array>', extract: 'NapiToVecArray(info[$i])' },
  'std::vector<mx::array>':   { cppType: 'std::vector<mx::array>', extract: 'NapiToVecArray(info[$i])' },

  // Dtype
  'Dtype':                    { cppType: 'mx::Dtype', extract: 'NapiToDtype(info[$i])', defaultPrefix: 'mx::' },
  'mx::Dtype':                { cppType: 'mx::Dtype', extract: 'NapiToDtype(info[$i])', defaultPrefix: 'mx::' },

  // Stream (always default)
  'StreamOrDevice':           { cppType: 'mx::StreamOrDevice', extract: '{}', fixedValue: '{}' },
  'mx::StreamOrDevice':       { cppType: 'mx::StreamOrDevice', extract: '{}', fixedValue: '{}' },

  // Primitives
  'int':                      { cppType: 'int', extract: 'info[$i].As<Napi::Number>().Int32Value()' },
  'bool':                     { cppType: 'bool', extract: 'info[$i].As<Napi::Boolean>().Value()' },
  'float':                    { cppType: 'double', extract: 'info[$i].As<Napi::Number>().DoubleValue()' },
  'double':                   { cppType: 'double', extract: 'info[$i].As<Napi::Number>().DoubleValue()' },
  'size_t':                   { cppType: 'size_t', extract: 'static_cast<size_t>(info[$i].As<Napi::Number>().Int64Value())' },
  'uint64_t':                 { cppType: 'uint64_t', extract: 'static_cast<uint64_t>(info[$i].As<Napi::Number>().Int64Value())' },

  // String
  'std::string':              { cppType: 'std::string', extract: 'info[$i].As<Napi::String>().Utf8Value()' },
  'string':                   { cppType: 'std::string', extract: 'info[$i].As<Napi::String>().Utf8Value()' },

  // Strides
  'Strides':                  { cppType: 'mx::Strides', extract: 'NapiToStrides(info[$i])' },
  'mx::Strides':              { cppType: 'mx::Strides', extract: 'NapiToStrides(info[$i])' },
};

// Optional type patterns
const OPTIONAL_HANDLERS: Array<{ pattern: RegExp, cppType: string, extract: string }> = [
  { pattern: /optional<array>/, cppType: 'std::optional<mx::array>', extract: 'std::optional<mx::array>(NapiToArray(info[$i]))' },
  { pattern: /optional<int>/, cppType: 'std::optional<int>', extract: 'std::optional<int>(info[$i].As<Napi::Number>().Int32Value())' },
  { pattern: /optional<float>|optional<double>/, cppType: 'std::optional<float>', extract: 'std::optional<float>(info[$i].As<Napi::Number>().FloatValue())' },
  { pattern: /optional<Dtype>/, cppType: 'std::optional<mx::Dtype>', extract: 'std::optional<mx::Dtype>(NapiToDtype(info[$i]))' },
  { pattern: /optional<std::vector<int>>/, cppType: 'std::optional<std::vector<int>>', extract: 'std::optional<std::vector<int>>(NapiToVecInt(info[$i]))' },
];

// Complex type patterns (need special handling)
const COMPLEX_HANDLERS: Array<{ pattern: RegExp, generate: (name: string, index: number, defaultValue?: string) => string }> = [
  {
    pattern: /^std::pair<int,\s*int>$|pair<int/,
    generate: (name, index, def = '{1, 1}') => `std::pair<int, int> ${name} = info.Length() > ${index} && !info[${index}].IsUndefined() ? [&]() {
if (info[${index}].IsArray()) {
Napi::Array arr = info[${index}].As<Napi::Array>();
return std::pair<int, int>{arr.Get(0u).As<Napi::Number>().Int32Value(), arr.Get(1u).As<Napi::Number>().Int32Value()};
}
return std::pair<int, int>${def};
}() : std::pair<int, int>${def};`
  },
  {
    pattern: /tuple<int,\s*int,\s*int>/,
    generate: (name, index, def = '{1, 1, 1}') => `std::tuple<int, int, int> ${name} = info.Length() > ${index} && !info[${index}].IsUndefined() ? [&]() {
if (info[${index}].IsArray()) {
Napi::Array arr = info[${index}].As<Napi::Array>();
return std::tuple<int, int, int>{arr.Get(0u).As<Napi::Number>().Int32Value(), arr.Get(1u).As<Napi::Number>().Int32Value(), arr.Get(2u).As<Napi::Number>().Int32Value()};
}
return std::tuple<int, int, int>${def};
}() : std::tuple<int, int, int>${def};`
  },
];

// =============================================================================
// Generator Options
// =============================================================================

export interface GeneratorOptions {
  templatePath?: string;
  format?: boolean;
}

// =============================================================================
// Main Generator Class
// =============================================================================

export class CppNapiGenerator {
  private functions: Map<string, CppFunction[]>;
  private exports: Map<string, ExportedFunction>;
  private templatesDir: string;
  private snippetsDir: string;
  private format: boolean;
  private fileCache: Map<string, string> = new Map();

  constructor(
    functions: CppFunction[],
    exports: Map<string, ExportedFunction>,
    options: Partial<GeneratorOptions> = {}
  ) {
    this.functions = groupByName(functions);
    this.exports = exports;
    const baseDir = path.join(__dirname, '..');
    this.templatesDir = options.templatePath
      ? path.dirname(options.templatePath)
      : path.join(baseDir, 'templates');
    this.snippetsDir = path.join(baseDir, 'snippets');
    this.format = options.format ?? true;
  }

  // ===========================================================================
  // File Loading
  // ===========================================================================

  private loadFile(filePath: string, vars: Record<string, string> = {}): string {
    const cacheKey = filePath + JSON.stringify(vars);
    if (this.fileCache.has(cacheKey)) {
      return this.fileCache.get(cacheKey)!;
    }

    let content = fs.readFileSync(filePath, 'utf-8');

    for (const [key, value] of Object.entries(vars)) {
      content = content.replaceAll(`@@${key}@@`, value);
    }

    this.fileCache.set(cacheKey, content);
    return content;
  }

  private loadTemplate(name: string): string {
    return this.loadFile(path.join(this.templatesDir, name));
  }

  private loadSnippet(name: string, vars: Record<string, string> = {}): string {
    return this.loadFile(path.join(this.snippetsDir, name), vars);
  }

  // ===========================================================================
  // Main Generation
  // ===========================================================================

  generate(): string {
    const template = this.loadTemplate('binding.cpp');
    const wrappers = this.generateFunctionWrappers();
    const exportLines = this.generateExports();

    let code = template
      .replace('// @@FUNCTION_WRAPPERS@@', wrappers)
      .replace('// @@EXPORTS@@', exportLines);

    if (this.format) {
      code = this.formatCode(code);
    }

    return code;
  }

  private formatCode(code: string): string {
    const paths = [
      'clang-format',
      '/usr/bin/clang-format',
      '/Library/Developer/CommandLineTools/usr/bin/clang-format',
      '/usr/local/bin/clang-format',
    ];

    for (const bin of paths) {
      try {
        return execSync(bin, {
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

  // ===========================================================================
  // Function Wrappers
  // ===========================================================================

  private generateFunctionWrappers(): string {
    const lines: string[] = [];

    for (const [name] of this.exports) {
      const overloads = this.functions.get(name);
      if (!overloads?.length) {
        lines.push(`// ${name}: Not found in C++ headers`);
        continue;
      }
      lines.push(this.generateWrapper(name, overloads));
      lines.push('');
    }

    return lines.join('\n');
  }

  private generateExports(): string {
    const lines: string[] = [];
    for (const [name] of this.exports) {
      if (this.functions.has(name)) {
        lines.push(`exports.Set("${name}", Napi::Function::New(env, Wrap_${name}));`);
      }
    }
    return lines.join('\n');
  }

  private generateWrapper(name: string, overloads: CppFunction[]): string {
    const sorted = [...overloads].sort((a, b) =>
      a.params.filter(p => !p.defaultValue).length -
      b.params.filter(p => !p.defaultValue).length
    );

    const body = sorted.length === 1
      ? this.generateSimpleBody(sorted[0])
      : this.generateDispatchBody(name, sorted);

    return [
      `Napi::Value Wrap_${name}(const Napi::CallbackInfo& info) {`,
      'Napi::Env env = info.Env();',
      body,
      '}'
    ].join('\n');
  }

  // ===========================================================================
  // Body Generation
  // ===========================================================================

  private generateSimpleBody(fn: CppFunction): string {
    const lines: string[] = [];

    // Extract parameters
    for (let i = 0; i < fn.params.length; i++) {
      lines.push(this.extractParam(fn.params[i], i));
    }

    // Build function call
    const args = fn.params.map(p => p.name).join(', ');
    const ns = this.getNamespace(fn);
    const call = `${ns}${fn.name}(${args})`;

    // Wrap in try/catch to convert C++ exceptions to JS errors
    lines.push('try {');
    lines.push(this.generateReturn(fn.returnType, call));
    lines.push('} catch (const std::exception& e) {');
    lines.push('  throw Napi::Error::New(env, e.what());');
    lines.push('}');

    return lines.join('\n');
  }

  private generateDispatchBody(name: string, overloads: CppFunction[]): string {
    // Special cases with snippets
    if (name === 'arange') {
      return this.loadSnippet('arange.cpp');
    }

    // Check for reduction patterns
    const hasAxis = overloads.some(o => o.params.some(p => p.type === 'int' && p.name.includes('axis')));
    const hasAxes = overloads.some(o => o.params.some(p => p.type === 'std::vector<int>' && p.name.includes('axes')));
    const hasKeepdims = overloads.some(o => o.params.some(p => p.name === 'keepdims'));
    const hasDdof = overloads.some(o => o.params.some(p => p.name === 'ddof'));

    if (hasAxis && hasAxes && hasKeepdims && hasDdof) {
      return this.loadSnippet('variance.cpp', { NAME: name });
    }

    if (hasAxis && hasAxes && hasKeepdims) {
      return this.loadSnippet('reduction.cpp', { NAME: name });
    }

    // Default: use first overload
    return this.generateSimpleBody(overloads[0]);
  }

  // ===========================================================================
  // Parameter Extraction
  // ===========================================================================

  private extractParam(param: CppParam, index: number): string {
    const { name, type, defaultValue } = param;

    // Check complex handlers first (pair, tuple)
    for (const handler of COMPLEX_HANDLERS) {
      if (handler.pattern.test(type)) {
        return handler.generate(name, index, defaultValue);
      }
    }

    // Check optional types
    for (const handler of OPTIONAL_HANDLERS) {
      if (handler.pattern.test(type)) {
        const extract = handler.extract.replace(/\$i/g, String(index));
        return `${handler.cppType} ${name} = info.Length() > ${index} && !info[${index}].IsUndefined() && !info[${index}].IsNull() ? ${extract} : std::nullopt;`;
      }
    }

    // Check standard type handlers
    const handler = TYPE_HANDLERS[type];
    if (handler) {
      // Fixed value types (StreamOrDevice)
      if (handler.fixedValue) {
        return `${handler.cppType} ${name} = ${handler.fixedValue};`;
      }

      const extract = handler.extract.replace(/\$i/g, String(index));

      // With default value
      if (defaultValue) {
        let def = defaultValue;
        if (handler.defaultPrefix && !def.startsWith('mx::') && !def.startsWith('std::')) {
          def = handler.defaultPrefix + def;
        }
        return `${handler.cppType} ${name} = info.Length() > ${index} && !info[${index}].IsUndefined() ? ${extract} : ${def};`;
      }

      // Required parameter
      return `${handler.cppType} ${name} = ${extract};`;
    }

    // Fallback
    console.warn(`Unhandled type: ${type} for param ${name}`);
    return `// FIXME: Unhandled type ${type} for param ${name}`;
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  private getNamespace(fn: CppFunction): string {
    if (fn.namespace.includes('linalg')) return 'mx::linalg::';
    if (fn.namespace.includes('fft')) return 'mx::fft::';
    if (fn.namespace.includes('random')) return 'mx::random::';
    return 'mx::';
  }

  private generateReturn(returnType: string, call: string): string {
    switch (returnType) {
      case 'void':
        return `${call};\nreturn env.Undefined();`;
      case 'array':
        return `mx::array result = ${call};\nreturn ArrayToNapi(env, result);`;
      case 'std::vector<array>':
        return `std::vector<mx::array> result = ${call};\nreturn VecArrayToNapi(env, result);`;
      case 'bool':
        return `bool result = ${call};\nreturn Napi::Boolean::New(env, result);`;
      case 'int':
      case 'size_t':
        return `auto result = ${call};\nreturn Napi::Number::New(env, result);`;
      default:
        return `auto result = ${call};\nreturn ArrayToNapi(env, result);`;
    }
  }
}
