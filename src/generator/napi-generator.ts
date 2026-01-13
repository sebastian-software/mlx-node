/**
 * N-API C++ Code Generator
 *
 * Generates Node.js native addon code from parsed nanobind bindings.
 * Uses node-addon-api (C++ wrapper for N-API) for cleaner code.
 */

import { type Binding, type FunctionBinding, type ClassBinding, parseSignature } from '../parser/regex-parser.js';

export interface NapiGeneratorOptions {
  /** Include original docstrings as comments */
  includeComments?: boolean;
  /** Namespace for generated code */
  namespace?: string;
}

export class NapiGenerator {
  private options: Required<NapiGeneratorOptions>;

  constructor(options: NapiGeneratorOptions = {}) {
    this.options = {
      includeComments: options.includeComments ?? true,
      namespace: options.namespace ?? 'mlx_node',
    };
  }

  /**
   * Generate the main binding.cpp file
   */
  generateBindingCpp(bindings: Binding[]): string {
    const lines: string[] = [];

    lines.push(this.generateHeader());
    lines.push('');
    lines.push(this.generateIncludes());
    lines.push('');
    lines.push(`namespace ${this.options.namespace} {`);
    lines.push('');

    // Generate type converters
    lines.push(this.generateTypeConverters());
    lines.push('');

    // Generate function wrappers
    const functions = bindings.filter((b): b is FunctionBinding => b.type === 'function');
    for (const fn of functions) {
      const wrapper = this.generateFunctionWrapper(fn);
      if (wrapper) {
        lines.push(wrapper);
        lines.push('');
      }
    }

    // Generate class wrappers
    const classes = bindings.filter((b): b is ClassBinding => b.type === 'class');
    for (const cls of classes) {
      lines.push(this.generateClassWrapper(cls));
      lines.push('');
    }

    // Generate module initialization
    lines.push(this.generateModuleInit(bindings));

    lines.push('');
    lines.push(`} // namespace ${this.options.namespace}`);

    return lines.join('\n');
  }

  /**
   * Generate the header file with declarations
   */
  generateBindingHeader(bindings: Binding[]): string {
    const lines: string[] = [];

    lines.push('#pragma once');
    lines.push('');
    lines.push('#include <napi.h>');
    lines.push('#include "mlx/mlx.h"');
    lines.push('');
    lines.push(`namespace ${this.options.namespace} {`);
    lines.push('');
    lines.push('// Type conversion utilities');
    lines.push('mlx::core::array NapiToArray(const Napi::Value& value);');
    lines.push('Napi::Value ArrayToNapi(Napi::Env env, const mlx::core::array& arr);');
    lines.push('mlx::core::Dtype NapiToDtype(const Napi::Value& value);');
    lines.push('mlx::core::Device NapiToDevice(const Napi::Value& value);');
    lines.push('mlx::core::StreamOrDevice NapiToStreamOrDevice(const Napi::Value& value);');
    lines.push('');
    lines.push('// Array wrapper class');
    lines.push('class MLXArray : public Napi::ObjectWrap<MLXArray> {');
    lines.push(' public:');
    lines.push('  static Napi::Object Init(Napi::Env env, Napi::Object exports);');
    lines.push('  static Napi::FunctionReference constructor;');
    lines.push('');
    lines.push('  MLXArray(const Napi::CallbackInfo& info);');
    lines.push('  mlx::core::array& GetArray() { return array_; }');
    lines.push('  const mlx::core::array& GetArray() const { return array_; }');
    lines.push('  void SetArray(mlx::core::array arr) { array_ = std::move(arr); }');
    lines.push('');
    lines.push(' private:');
    lines.push('  mlx::core::array array_;');
    lines.push('');
    lines.push('  // Property getters');
    lines.push('  Napi::Value GetShape(const Napi::CallbackInfo& info);');
    lines.push('  Napi::Value GetNdim(const Napi::CallbackInfo& info);');
    lines.push('  Napi::Value GetSize(const Napi::CallbackInfo& info);');
    lines.push('  Napi::Value GetDtype(const Napi::CallbackInfo& info);');
    lines.push('  Napi::Value GetItemsize(const Napi::CallbackInfo& info);');
    lines.push('  Napi::Value GetNbytes(const Napi::CallbackInfo& info);');
    lines.push('');
    lines.push('  // Methods');
    lines.push('  Napi::Value ToList(const Napi::CallbackInfo& info);');
    lines.push('  Napi::Value Item(const Napi::CallbackInfo& info);');
    lines.push('  Napi::Value Reshape(const Napi::CallbackInfo& info);');
    lines.push('  Napi::Value Astype(const Napi::CallbackInfo& info);');
    lines.push('};');
    lines.push('');
    lines.push('// Module initialization');
    lines.push('Napi::Object Init(Napi::Env env, Napi::Object exports);');
    lines.push('');
    lines.push(`} // namespace ${this.options.namespace}`);

    return lines.join('\n');
  }

  private generateHeader(): string {
    return `/**
 * MLX Node.js Native Bindings
 *
 * Auto-generated from MLX Python bindings.
 * DO NOT EDIT MANUALLY.
 */`;
  }

  private generateIncludes(): string {
    return `#include <napi.h>
#include "mlx/mlx.h"
#include "binding.h"

#include <vector>
#include <string>
#include <optional>
#include <variant>`;
  }

  private generateTypeConverters(): string {
    return `// ============================================================================
// Type Conversion Utilities
// ============================================================================

Napi::FunctionReference MLXArray::constructor;

/**
 * Convert JavaScript value to mlx::core::array
 */
mlx::core::array NapiToArray(const Napi::Value& value) {
  Napi::Env env = value.Env();

  // If it's already an MLXArray wrapper, extract the array
  if (value.IsObject()) {
    Napi::Object obj = value.As<Napi::Object>();
    if (obj.InstanceOf(MLXArray::constructor.Value())) {
      return Napi::ObjectWrap<MLXArray>::Unwrap(obj)->GetArray();
    }
  }

  // Handle number
  if (value.IsNumber()) {
    double num = value.As<Napi::Number>().DoubleValue();
    return mlx::core::array(num);
  }

  // Handle boolean
  if (value.IsBoolean()) {
    bool b = value.As<Napi::Boolean>().Value();
    return mlx::core::array(b);
  }

  // Handle typed arrays (Float32Array, etc.)
  if (value.IsTypedArray()) {
    Napi::TypedArray typedArray = value.As<Napi::TypedArray>();
    size_t length = typedArray.ElementLength();

    switch (typedArray.TypedArrayType()) {
      case napi_float32_array: {
        Napi::Float32Array arr = value.As<Napi::Float32Array>();
        std::vector<float> data(arr.Data(), arr.Data() + length);
        return mlx::core::array(data.data(), {static_cast<int>(length)}, mlx::core::float32);
      }
      case napi_float64_array: {
        Napi::Float64Array arr = value.As<Napi::Float64Array>();
        std::vector<double> data(arr.Data(), arr.Data() + length);
        return mlx::core::array(data.data(), {static_cast<int>(length)}, mlx::core::float64);
      }
      case napi_int32_array: {
        Napi::Int32Array arr = value.As<Napi::Int32Array>();
        std::vector<int32_t> data(arr.Data(), arr.Data() + length);
        return mlx::core::array(data.data(), {static_cast<int>(length)}, mlx::core::int32);
      }
      default:
        break;
    }
  }

  // Handle regular arrays (recursive for nested)
  if (value.IsArray()) {
    Napi::Array arr = value.As<Napi::Array>();
    uint32_t length = arr.Length();

    if (length == 0) {
      return mlx::core::array({}, mlx::core::float32);
    }

    // Check first element to determine type and nesting
    Napi::Value first = arr.Get(uint32_t(0));

    if (first.IsArray()) {
      // Nested array - need to flatten and determine shape
      std::vector<double> flat_data;
      std::vector<int> shape;

      std::function<void(Napi::Array, int)> flatten = [&](Napi::Array a, int depth) {
        uint32_t len = a.Length();
        if (depth >= static_cast<int>(shape.size())) {
          shape.push_back(static_cast<int>(len));
        }
        for (uint32_t i = 0; i < len; i++) {
          Napi::Value elem = a.Get(i);
          if (elem.IsArray()) {
            flatten(elem.As<Napi::Array>(), depth + 1);
          } else if (elem.IsNumber()) {
            flat_data.push_back(elem.As<Napi::Number>().DoubleValue());
          }
        }
      };

      flatten(arr, 0);
      return mlx::core::array(flat_data.data(), shape, mlx::core::float64);
    } else {
      // Flat array of numbers
      std::vector<double> data;
      data.reserve(length);
      for (uint32_t i = 0; i < length; i++) {
        Napi::Value elem = arr.Get(i);
        if (elem.IsNumber()) {
          data.push_back(elem.As<Napi::Number>().DoubleValue());
        } else if (elem.IsBoolean()) {
          data.push_back(elem.As<Napi::Boolean>().Value() ? 1.0 : 0.0);
        }
      }
      return mlx::core::array(data.data(), {static_cast<int>(data.size())}, mlx::core::float64);
    }
  }

  throw Napi::TypeError::New(env, "Cannot convert value to mlx::array");
}

/**
 * Convert mlx::core::array to JavaScript value (wrapped in MLXArray)
 */
Napi::Value ArrayToNapi(Napi::Env env, const mlx::core::array& arr) {
  Napi::Object obj = MLXArray::constructor.New({});
  MLXArray* wrapper = Napi::ObjectWrap<MLXArray>::Unwrap(obj);
  wrapper->SetArray(arr);
  return obj;
}

/**
 * Convert JavaScript value to mlx::core::Dtype
 */
mlx::core::Dtype NapiToDtype(const Napi::Value& value) {
  if (value.IsString()) {
    std::string dtype_str = value.As<Napi::String>().Utf8Value();

    if (dtype_str == "bool") return mlx::core::bool_;
    if (dtype_str == "uint8") return mlx::core::uint8;
    if (dtype_str == "uint16") return mlx::core::uint16;
    if (dtype_str == "uint32") return mlx::core::uint32;
    if (dtype_str == "uint64") return mlx::core::uint64;
    if (dtype_str == "int8") return mlx::core::int8;
    if (dtype_str == "int16") return mlx::core::int16;
    if (dtype_str == "int32") return mlx::core::int32;
    if (dtype_str == "int64") return mlx::core::int64;
    if (dtype_str == "float16") return mlx::core::float16;
    if (dtype_str == "float32") return mlx::core::float32;
    if (dtype_str == "float64") return mlx::core::float64;
    if (dtype_str == "bfloat16") return mlx::core::bfloat16;
    if (dtype_str == "complex64") return mlx::core::complex64;

    throw Napi::TypeError::New(value.Env(), "Unknown dtype: " + dtype_str);
  }

  // Default to float32
  return mlx::core::float32;
}

/**
 * Convert JavaScript value to mlx::core::Device
 */
mlx::core::Device NapiToDevice(const Napi::Value& value) {
  if (value.IsUndefined() || value.IsNull()) {
    return mlx::core::default_device();
  }

  if (value.IsString()) {
    std::string device_str = value.As<Napi::String>().Utf8Value();
    if (device_str == "cpu") return mlx::core::Device(mlx::core::Device::cpu);
    if (device_str == "gpu") return mlx::core::Device(mlx::core::Device::gpu);
  }

  return mlx::core::default_device();
}

/**
 * Convert JavaScript value to mlx::core::StreamOrDevice
 */
mlx::core::StreamOrDevice NapiToStreamOrDevice(const Napi::Value& value) {
  if (value.IsUndefined() || value.IsNull()) {
    return {};
  }

  if (value.IsString()) {
    std::string str = value.As<Napi::String>().Utf8Value();
    if (str == "cpu") return mlx::core::Device(mlx::core::Device::cpu);
    if (str == "gpu") return mlx::core::Device(mlx::core::Device::gpu);
  }

  return {};
}`;
  }

  private generateFunctionWrapper(fn: FunctionBinding): string | null {
    // Skip functions without signatures - we can't generate proper wrappers
    if (!fn.signature) {
      return this.generateGenericWrapper(fn);
    }

    const parsed = parseSignature(fn.signature);
    if (!parsed) {
      return this.generateGenericWrapper(fn);
    }

    const lines: string[] = [];

    // Add docstring as comment
    if (this.options.includeComments && fn.docstring) {
      lines.push('/**');
      for (const line of fn.docstring.split('\n').slice(0, 5)) {
        lines.push(` * ${line.trim()}`);
      }
      lines.push(' */');
    }

    const wrapperName = `Wrap_${fn.name}`;

    lines.push(`Napi::Value ${wrapperName}(const Napi::CallbackInfo& info) {`);
    lines.push('  Napi::Env env = info.Env();');
    lines.push('');

    // Generate parameter extraction
    let paramIndex = 0;
    const cppArgs: string[] = [];

    for (const param of parsed.params) {
      if (param.name === 'stream' || param.name === 'device') {
        // StreamOrDevice parameter - usually optional at end
        lines.push(`  mlx::core::StreamOrDevice ${param.name} = {};`);
        lines.push(`  if (info.Length() > ${paramIndex} && !info[${paramIndex}].IsUndefined()) {`);
        lines.push(`    ${param.name} = NapiToStreamOrDevice(info[${paramIndex}]);`);
        lines.push('  }');
        cppArgs.push(param.name);
      } else if (param.type?.includes('array') || param.type === 'array') {
        // Array parameter
        const isOptional = param.isOptional;
        if (isOptional) {
          lines.push(`  mlx::core::array ${param.name};`);
          lines.push(`  if (info.Length() > ${paramIndex} && !info[${paramIndex}].IsUndefined()) {`);
          lines.push(`    ${param.name} = NapiToArray(info[${paramIndex}]);`);
          lines.push('  }');
        } else {
          lines.push(`  if (info.Length() <= ${paramIndex}) {`);
          lines.push(`    throw Napi::TypeError::New(env, "Missing required argument: ${param.name}");`);
          lines.push('  }');
          lines.push(`  mlx::core::array ${param.name} = NapiToArray(info[${paramIndex}]);`);
        }
        cppArgs.push(param.name);
      } else if (param.type === 'int' || param.type === 'float') {
        // Numeric parameter
        const cppType = param.type === 'int' ? 'int' : 'double';
        const defaultVal = param.default || (param.type === 'int' ? '0' : '0.0');

        if (param.isOptional) {
          lines.push(`  ${cppType} ${param.name} = ${defaultVal};`);
          lines.push(`  if (info.Length() > ${paramIndex} && !info[${paramIndex}].IsUndefined()) {`);
          lines.push(`    ${param.name} = info[${paramIndex}].As<Napi::Number>().${param.type === 'int' ? 'Int32Value' : 'DoubleValue'}();`);
          lines.push('  }');
        } else {
          lines.push(`  ${cppType} ${param.name} = info[${paramIndex}].As<Napi::Number>().${param.type === 'int' ? 'Int32Value' : 'DoubleValue'}();`);
        }
        cppArgs.push(param.name);
      } else if (param.type === 'bool') {
        const defaultVal = param.default === 'True' ? 'true' : 'false';
        if (param.isOptional) {
          lines.push(`  bool ${param.name} = ${defaultVal};`);
          lines.push(`  if (info.Length() > ${paramIndex} && !info[${paramIndex}].IsUndefined()) {`);
          lines.push(`    ${param.name} = info[${paramIndex}].As<Napi::Boolean>().Value();`);
          lines.push('  }');
        } else {
          lines.push(`  bool ${param.name} = info[${paramIndex}].As<Napi::Boolean>().Value();`);
        }
        cppArgs.push(param.name);
      } else if (param.type === 'str' || param.type === 'string') {
        const defaultVal = param.default ? param.default.replace(/['"]/g, '"') : '""';
        if (param.isOptional) {
          lines.push(`  std::string ${param.name} = ${defaultVal};`);
          lines.push(`  if (info.Length() > ${paramIndex} && !info[${paramIndex}].IsUndefined()) {`);
          lines.push(`    ${param.name} = info[${paramIndex}].As<Napi::String>().Utf8Value();`);
          lines.push('  }');
        } else {
          lines.push(`  std::string ${param.name} = info[${paramIndex}].As<Napi::String>().Utf8Value();`);
        }
        cppArgs.push(param.name);
      } else if (param.type?.includes('Sequence[int]') || param.type?.includes('List[int]')) {
        // Vector of ints (e.g., shape)
        lines.push(`  std::vector<int> ${param.name};`);
        lines.push(`  if (info.Length() > ${paramIndex} && info[${paramIndex}].IsArray()) {`);
        lines.push(`    Napi::Array arr = info[${paramIndex}].As<Napi::Array>();`);
        lines.push('    for (uint32_t i = 0; i < arr.Length(); i++) {');
        lines.push(`      ${param.name}.push_back(arr.Get(i).As<Napi::Number>().Int32Value());`);
        lines.push('    }');
        lines.push('  }');
        cppArgs.push(param.name);
      } else {
        // Generic fallback
        cppArgs.push(`/* ${param.name}: ${param.type} */`);
      }

      paramIndex++;
    }

    lines.push('');

    // Generate the actual call
    const cppFn = fn.cppFunction || `mlx::core::${fn.name}`;
    const returnType = parsed.returnType;

    if (returnType === 'None' || returnType === 'void' || !returnType) {
      lines.push(`  ${cppFn}(${cppArgs.join(', ')});`);
      lines.push('  return env.Undefined();');
    } else if (returnType === 'array' || returnType === 'MLXArray') {
      lines.push(`  mlx::core::array result = ${cppFn}(${cppArgs.join(', ')});`);
      lines.push('  return ArrayToNapi(env, result);');
    } else if (returnType === 'bool') {
      lines.push(`  bool result = ${cppFn}(${cppArgs.join(', ')});`);
      lines.push('  return Napi::Boolean::New(env, result);');
    } else if (returnType === 'int' || returnType === 'float') {
      lines.push(`  auto result = ${cppFn}(${cppArgs.join(', ')});`);
      lines.push('  return Napi::Number::New(env, result);');
    } else {
      // Try to return as array (most common)
      lines.push('  try {');
      lines.push(`    mlx::core::array result = ${cppFn}(${cppArgs.join(', ')});`);
      lines.push('    return ArrayToNapi(env, result);');
      lines.push('  } catch (...) {');
      lines.push('    return env.Undefined();');
      lines.push('  }');
    }

    lines.push('}');

    return lines.join('\n');
  }

  private generateGenericWrapper(fn: FunctionBinding): string {
    const wrapperName = `Wrap_${fn.name}`;

    return `// TODO: ${fn.name} - needs manual implementation (no signature available)
Napi::Value ${wrapperName}(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  throw Napi::Error::New(env, "${fn.name} is not yet implemented");
  return env.Undefined();
}`;
  }

  private generateClassWrapper(cls: ClassBinding): string {
    if (cls.name !== 'array') {
      // For now, only fully implement the array class
      return `// TODO: Class ${cls.name} wrapper`;
    }

    return `// ============================================================================
// MLXArray Class Implementation
// ============================================================================

MLXArray::MLXArray(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<MLXArray>(info), array_(mlx::core::array({}, mlx::core::float32)) {
  Napi::Env env = info.Env();

  if (info.Length() > 0 && !info[0].IsUndefined()) {
    array_ = NapiToArray(info[0]);

    // Handle optional dtype argument
    if (info.Length() > 1 && !info[1].IsUndefined()) {
      mlx::core::Dtype dtype = NapiToDtype(info[1]);
      array_ = mlx::core::astype(array_, dtype);
    }
  }
}

Napi::Value MLXArray::GetShape(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  const auto& shape = array_.shape();
  Napi::Array result = Napi::Array::New(env, shape.size());
  for (size_t i = 0; i < shape.size(); i++) {
    result.Set(i, Napi::Number::New(env, shape[i]));
  }
  return result;
}

Napi::Value MLXArray::GetNdim(const Napi::CallbackInfo& info) {
  return Napi::Number::New(info.Env(), array_.ndim());
}

Napi::Value MLXArray::GetSize(const Napi::CallbackInfo& info) {
  return Napi::Number::New(info.Env(), array_.size());
}

Napi::Value MLXArray::GetDtype(const Napi::CallbackInfo& info) {
  // Return dtype as string for now
  Napi::Env env = info.Env();
  mlx::core::Dtype dtype = array_.dtype();

  if (dtype == mlx::core::bool_) return Napi::String::New(env, "bool");
  if (dtype == mlx::core::uint8) return Napi::String::New(env, "uint8");
  if (dtype == mlx::core::uint16) return Napi::String::New(env, "uint16");
  if (dtype == mlx::core::uint32) return Napi::String::New(env, "uint32");
  if (dtype == mlx::core::uint64) return Napi::String::New(env, "uint64");
  if (dtype == mlx::core::int8) return Napi::String::New(env, "int8");
  if (dtype == mlx::core::int16) return Napi::String::New(env, "int16");
  if (dtype == mlx::core::int32) return Napi::String::New(env, "int32");
  if (dtype == mlx::core::int64) return Napi::String::New(env, "int64");
  if (dtype == mlx::core::float16) return Napi::String::New(env, "float16");
  if (dtype == mlx::core::float32) return Napi::String::New(env, "float32");
  if (dtype == mlx::core::float64) return Napi::String::New(env, "float64");
  if (dtype == mlx::core::bfloat16) return Napi::String::New(env, "bfloat16");
  if (dtype == mlx::core::complex64) return Napi::String::New(env, "complex64");

  return Napi::String::New(env, "unknown");
}

Napi::Value MLXArray::GetItemsize(const Napi::CallbackInfo& info) {
  return Napi::Number::New(info.Env(), array_.itemsize());
}

Napi::Value MLXArray::GetNbytes(const Napi::CallbackInfo& info) {
  return Napi::Number::New(info.Env(), array_.nbytes());
}

Napi::Value MLXArray::ToList(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  // Evaluate the array first
  mlx::core::eval(array_);

  // For scalar
  if (array_.ndim() == 0) {
    if (array_.dtype() == mlx::core::float32) {
      return Napi::Number::New(env, array_.item<float>());
    } else if (array_.dtype() == mlx::core::float64) {
      return Napi::Number::New(env, array_.item<double>());
    } else if (array_.dtype() == mlx::core::int32) {
      return Napi::Number::New(env, array_.item<int32_t>());
    } else if (array_.dtype() == mlx::core::bool_) {
      return Napi::Boolean::New(env, array_.item<bool>());
    }
    return Napi::Number::New(env, array_.item<float>());
  }

  // For 1D array
  if (array_.ndim() == 1) {
    Napi::Array result = Napi::Array::New(env, array_.size());
    if (array_.dtype() == mlx::core::float32) {
      const float* data = array_.data<float>();
      for (size_t i = 0; i < array_.size(); i++) {
        result.Set(i, Napi::Number::New(env, data[i]));
      }
    } else if (array_.dtype() == mlx::core::float64) {
      const double* data = array_.data<double>();
      for (size_t i = 0; i < array_.size(); i++) {
        result.Set(i, Napi::Number::New(env, data[i]));
      }
    } else if (array_.dtype() == mlx::core::int32) {
      const int32_t* data = array_.data<int32_t>();
      for (size_t i = 0; i < array_.size(); i++) {
        result.Set(i, Napi::Number::New(env, data[i]));
      }
    }
    return result;
  }

  // For multi-dimensional, recursively build nested arrays
  // Simplified: flatten for now
  Napi::Array result = Napi::Array::New(env, array_.size());
  mlx::core::array flat = mlx::core::flatten(array_);
  mlx::core::eval(flat);

  if (flat.dtype() == mlx::core::float32 || flat.dtype() == mlx::core::float64) {
    for (size_t i = 0; i < flat.size(); i++) {
      result.Set(i, Napi::Number::New(env, flat.dtype() == mlx::core::float32
        ? flat.data<float>()[i]
        : flat.data<double>()[i]));
    }
  }

  return result;
}

Napi::Value MLXArray::Item(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mlx::core::eval(array_);

  if (array_.dtype() == mlx::core::float32) {
    return Napi::Number::New(env, array_.item<float>());
  } else if (array_.dtype() == mlx::core::float64) {
    return Napi::Number::New(env, array_.item<double>());
  } else if (array_.dtype() == mlx::core::int32) {
    return Napi::Number::New(env, array_.item<int32_t>());
  } else if (array_.dtype() == mlx::core::bool_) {
    return Napi::Boolean::New(env, array_.item<bool>());
  }

  return Napi::Number::New(env, array_.item<float>());
}

Napi::Value MLXArray::Reshape(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 1 || !info[0].IsArray()) {
    throw Napi::TypeError::New(env, "reshape requires a shape array");
  }

  std::vector<int> shape;
  Napi::Array shapeArr = info[0].As<Napi::Array>();
  for (uint32_t i = 0; i < shapeArr.Length(); i++) {
    shape.push_back(shapeArr.Get(i).As<Napi::Number>().Int32Value());
  }

  mlx::core::array result = mlx::core::reshape(array_, shape);
  return ArrayToNapi(env, result);
}

Napi::Value MLXArray::Astype(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 1) {
    throw Napi::TypeError::New(env, "astype requires a dtype argument");
  }

  mlx::core::Dtype dtype = NapiToDtype(info[0]);
  mlx::core::StreamOrDevice s = {};

  if (info.Length() > 1 && !info[1].IsUndefined()) {
    s = NapiToStreamOrDevice(info[1]);
  }

  mlx::core::array result = mlx::core::astype(array_, dtype, s);
  return ArrayToNapi(env, result);
}

Napi::Object MLXArray::Init(Napi::Env env, Napi::Object exports) {
  Napi::Function func = DefineClass(env, "MLXArray", {
    InstanceAccessor("shape", &MLXArray::GetShape, nullptr),
    InstanceAccessor("ndim", &MLXArray::GetNdim, nullptr),
    InstanceAccessor("size", &MLXArray::GetSize, nullptr),
    InstanceAccessor("dtype", &MLXArray::GetDtype, nullptr),
    InstanceAccessor("itemsize", &MLXArray::GetItemsize, nullptr),
    InstanceAccessor("nbytes", &MLXArray::GetNbytes, nullptr),
    InstanceMethod("tolist", &MLXArray::ToList),
    InstanceMethod("item", &MLXArray::Item),
    InstanceMethod("reshape", &MLXArray::Reshape),
    InstanceMethod("astype", &MLXArray::Astype),
  });

  constructor = Napi::Persistent(func);
  constructor.SuppressDestruct();

  exports.Set("array", func);
  return exports;
}`;
  }

  private generateModuleInit(bindings: Binding[]): string {
    const functions = bindings.filter((b): b is FunctionBinding => b.type === 'function');
    const lines: string[] = [];

    lines.push('// ============================================================================');
    lines.push('// Module Initialization');
    lines.push('// ============================================================================');
    lines.push('');
    lines.push('Napi::Object Init(Napi::Env env, Napi::Object exports) {');
    lines.push('  // Initialize array class');
    lines.push('  MLXArray::Init(env, exports);');
    lines.push('');

    // Add dtype constants
    lines.push('  // Dtype constants');
    const dtypes = ['bool_', 'uint8', 'uint16', 'uint32', 'uint64',
                    'int8', 'int16', 'int32', 'int64',
                    'float16', 'float32', 'float64', 'bfloat16', 'complex64'];
    for (const dtype of dtypes) {
      const jsName = dtype === 'bool_' ? 'bool' : dtype;
      lines.push(`  exports.Set("${jsName}", Napi::String::New(env, "${jsName}"));`);
    }
    lines.push('');

    // Add functions (only those with signatures for now)
    lines.push('  // Functions');
    const seenFunctions = new Set<string>();
    for (const fn of functions) {
      if (seenFunctions.has(fn.name)) continue;
      seenFunctions.add(fn.name);

      if (fn.signature) {
        lines.push(`  exports.Set("${fn.name}", Napi::Function::New(env, Wrap_${fn.name}));`);
      }
    }
    lines.push('');

    lines.push('  return exports;');
    lines.push('}');
    lines.push('');
    lines.push('NODE_API_MODULE(mlx_node, Init)');

    return lines.join('\n');
  }
}
