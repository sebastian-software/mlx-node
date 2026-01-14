/**
 * C++ Based N-API Generator
 *
 * Generates N-API bindings directly from C++ headers.
 * Much cleaner than parsing Python pybind11 bindings.
 */

import { CppFunction, CppParam, groupByName } from './cpp-header-parser.js';
import { ExportedFunction } from './export-list-parser.js';

export interface GeneratorOptions {
  namespace: string;
  includeAllOverloads: boolean;
}

/**
 * Main generator class
 */
export class CppNapiGenerator {
  private functions: Map<string, CppFunction[]>;
  private exports: Map<string, ExportedFunction>;
  private options: GeneratorOptions;

  constructor(
    functions: CppFunction[],
    exports: Map<string, ExportedFunction>,
    options: Partial<GeneratorOptions> = {}
  ) {
    this.functions = groupByName(functions);
    this.exports = exports;
    this.options = {
      namespace: 'mlx::core',
      includeAllOverloads: true,
      ...options,
    };
  }

  /**
   * Generate the complete binding.cpp file
   */
  generate(): string {
    const parts: string[] = [];

    parts.push(this.generateHeader());
    parts.push(this.generateForwardDeclarations());  // Forward declarations (including helper function signatures)
    parts.push(this.generateArrayClass());            // MLXArray class (can call helpers - they're declared)
    parts.push(this.generateHelpers());               // Helper implementations (can access MLXArray - it's defined)
    parts.push(this.generateFunctionWrappers());
    parts.push(this.generateModuleInit());

    return parts.join('\n\n');
  }

  /**
   * Generate file header with includes
   */
  private generateHeader(): string {
    return `// Auto-generated N-API bindings for MLX
// Generated from C++ headers - DO NOT EDIT

#include <napi.h>
#include <mlx/mlx.h>
#include <vector>
#include <optional>
#include <string>

namespace mx = mlx::core;
`;
  }

  /**
   * Generate forward declarations
   */
  private generateForwardDeclarations(): string {
    return `// ============================================================================
// Forward Declarations
// ============================================================================

// Global constructor reference
Napi::FunctionReference constructor;

// Forward declare MLXArray class
class MLXArray;

// Helper function declarations
mx::array NapiToArray(const Napi::Value& value);
Napi::Value ArrayToNapi(Napi::Env env, const mx::array& arr);
mx::Shape NapiToShape(const Napi::Value& value);
std::vector<int> NapiToVecInt(const Napi::Value& value);
std::vector<mx::array> NapiToVecArray(const Napi::Value& value);
Napi::Value VecArrayToNapi(Napi::Env env, const std::vector<mx::array>& vec);
mx::Dtype NapiToDtype(const Napi::Value& value);
mx::StreamOrDevice NapiToStreamOrDevice(const Napi::Value& value);
`;
  }

  /**
   * Generate helper conversion functions
   */
  private generateHelpers(): string {
    return `// ============================================================================
// Type Conversion Helpers (Implementations)
// ============================================================================

// Convert Napi value to MLX array
mx::array NapiToArray(const Napi::Value& value) {
  Napi::Env env = value.Env();

  // Already an MLXArray wrapper
  if (value.IsObject()) {
    Napi::Object obj = value.As<Napi::Object>();
    if (obj.InstanceOf(constructor.Value())) {
      MLXArray* wrapper = Napi::ObjectWrap<MLXArray>::Unwrap(obj);
      return wrapper->array_;
    }
  }

  // TypedArray (Float32Array, Int32Array, etc.)
  if (value.IsTypedArray()) {
    Napi::TypedArray typed = value.As<Napi::TypedArray>();
    size_t length = typed.ElementLength();

    switch (typed.TypedArrayType()) {
      case napi_float32_array: {
        Napi::Float32Array arr = typed.As<Napi::Float32Array>();
        std::vector<float> data(arr.Data(), arr.Data() + length);
        return mx::array(data.begin(), {static_cast<int>(length)}, mx::float32);
      }
      case napi_float64_array: {
        Napi::Float64Array arr = typed.As<Napi::Float64Array>();
        std::vector<double> data(arr.Data(), arr.Data() + length);
        return mx::array(data.begin(), {static_cast<int>(length)}, mx::float64);
      }
      case napi_int32_array: {
        Napi::Int32Array arr = typed.As<Napi::Int32Array>();
        std::vector<int32_t> data(arr.Data(), arr.Data() + length);
        return mx::array(data.begin(), {static_cast<int>(length)}, mx::int32);
      }
      case napi_int16_array: {
        Napi::Int16Array arr = typed.As<Napi::Int16Array>();
        std::vector<int16_t> data(arr.Data(), arr.Data() + length);
        return mx::array(data.begin(), {static_cast<int>(length)}, mx::int16);
      }
      case napi_uint8_array: {
        Napi::Uint8Array arr = typed.As<Napi::Uint8Array>();
        std::vector<uint8_t> data(arr.Data(), arr.Data() + length);
        return mx::array(data.begin(), {static_cast<int>(length)}, mx::uint8);
      }
      default:
        throw Napi::TypeError::New(env, "Unsupported TypedArray type");
    }
  }

  // JavaScript Array - could be nested
  if (value.IsArray()) {
    Napi::Array arr = value.As<Napi::Array>();
    uint32_t length = arr.Length();
    if (length == 0) {
      return mx::array({}, mx::float32);
    }

    Napi::Value first = arr.Get(static_cast<uint32_t>(0));

    // Array of TypedArrays -> 2D array
    if (first.IsTypedArray()) {
      Napi::TypedArray firstTyped = first.As<Napi::TypedArray>();
      size_t innerLength = firstTyped.ElementLength();
      mx::Shape shape = {static_cast<int>(length), static_cast<int>(innerLength)};

      if (firstTyped.TypedArrayType() == napi_float32_array) {
        std::vector<float> data;
        data.reserve(length * innerLength);
        for (uint32_t i = 0; i < length; i++) {
          Napi::Float32Array typed = arr.Get(i).As<Napi::Float32Array>();
          for (size_t j = 0; j < typed.ElementLength(); j++) {
            data.push_back(typed[j]);
          }
        }
        return mx::array(data.begin(), shape, mx::float32);
      }
    }

    // Nested JS arrays -> try to create ND array
    if (first.IsArray()) {
      // Flatten and determine shape
      std::vector<float> data;
      std::vector<int> shape;

      std::function<void(Napi::Array, int)> flatten = [&](Napi::Array a, int depth) {
        if (depth >= static_cast<int>(shape.size())) {
          shape.push_back(a.Length());
        }
        for (uint32_t i = 0; i < a.Length(); i++) {
          Napi::Value v = a.Get(i);
          if (v.IsArray()) {
            flatten(v.As<Napi::Array>(), depth + 1);
          } else if (v.IsNumber()) {
            data.push_back(v.As<Napi::Number>().FloatValue());
          }
        }
      };

      flatten(arr, 0);
      mx::Shape mlxShape(shape.begin(), shape.end());
      return mx::array(data.begin(), mlxShape, mx::float32);
    }

    // 1D array of numbers
    std::vector<float> data;
    data.reserve(length);
    for (uint32_t i = 0; i < length; i++) {
      data.push_back(arr.Get(i).As<Napi::Number>().FloatValue());
    }
    return mx::array(data.begin(), {static_cast<int>(length)}, mx::float32);
  }

  // Scalar number
  if (value.IsNumber()) {
    double val = value.As<Napi::Number>().DoubleValue();
    return mx::array(static_cast<float>(val));
  }

  // Boolean
  if (value.IsBoolean()) {
    bool val = value.As<Napi::Boolean>().Value();
    return mx::array(val);
  }

  throw Napi::TypeError::New(env, "Cannot convert value to MLX array");
}

// Convert MLX array to Napi value (wrapped)
Napi::Value ArrayToNapi(Napi::Env env, const mx::array& arr) {
  Napi::Object obj = constructor.New({});
  MLXArray* wrapper = Napi::ObjectWrap<MLXArray>::Unwrap(obj);
  wrapper->array_ = arr;
  return obj;
}

// Convert Napi array to Shape
mx::Shape NapiToShape(const Napi::Value& value) {
  mx::Shape shape;
  if (value.IsArray()) {
    Napi::Array arr = value.As<Napi::Array>();
    for (uint32_t i = 0; i < arr.Length(); i++) {
      shape.push_back(arr.Get(i).As<Napi::Number>().Int32Value());
    }
  }
  return shape;
}

// Convert Napi value to vector<int>
std::vector<int> NapiToVecInt(const Napi::Value& value) {
  std::vector<int> vec;
  if (value.IsArray()) {
    Napi::Array arr = value.As<Napi::Array>();
    for (uint32_t i = 0; i < arr.Length(); i++) {
      vec.push_back(arr.Get(i).As<Napi::Number>().Int32Value());
    }
  } else if (value.IsNumber()) {
    vec.push_back(value.As<Napi::Number>().Int32Value());
  }
  return vec;
}

// Convert Napi value to vector<array>
std::vector<mx::array> NapiToVecArray(const Napi::Value& value) {
  std::vector<mx::array> vec;
  if (value.IsArray()) {
    Napi::Array arr = value.As<Napi::Array>();
    for (uint32_t i = 0; i < arr.Length(); i++) {
      vec.push_back(NapiToArray(arr.Get(i)));
    }
  }
  return vec;
}

// Convert vector<array> to Napi array
Napi::Value VecArrayToNapi(Napi::Env env, const std::vector<mx::array>& vec) {
  Napi::Array arr = Napi::Array::New(env, vec.size());
  for (size_t i = 0; i < vec.size(); i++) {
    arr.Set(i, ArrayToNapi(env, vec[i]));
  }
  return arr;
}

// Convert Napi value to Dtype
mx::Dtype NapiToDtype(const Napi::Value& value) {
  if (value.IsString()) {
    std::string s = value.As<Napi::String>().Utf8Value();
    if (s == "bool") return mx::bool_;
    if (s == "uint8") return mx::uint8;
    if (s == "uint16") return mx::uint16;
    if (s == "uint32") return mx::uint32;
    if (s == "uint64") return mx::uint64;
    if (s == "int8") return mx::int8;
    if (s == "int16") return mx::int16;
    if (s == "int32") return mx::int32;
    if (s == "int64") return mx::int64;
    if (s == "float16") return mx::float16;
    if (s == "float32") return mx::float32;
    if (s == "float64") return mx::float64;
    if (s == "bfloat16") return mx::bfloat16;
    if (s == "complex64") return mx::complex64;
  }
  return mx::float32;  // default
}

// Convert Napi value to StreamOrDevice
mx::StreamOrDevice NapiToStreamOrDevice(const Napi::Value& value) {
  // For now, just return default stream
  return {};
}
`;
  }

  /**
   * Generate MLXArray class wrapper
   */
  private generateArrayClass(): string {
    return `// ============================================================================
// MLXArray Class Wrapper
// ============================================================================

class MLXArray : public Napi::ObjectWrap<MLXArray> {
public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports);
  MLXArray(const Napi::CallbackInfo& info);

  mx::array array_;

private:
  // Properties
  Napi::Value GetShape(const Napi::CallbackInfo& info);
  Napi::Value GetNdim(const Napi::CallbackInfo& info);
  Napi::Value GetSize(const Napi::CallbackInfo& info);
  Napi::Value GetDtype(const Napi::CallbackInfo& info);
  Napi::Value GetItemsize(const Napi::CallbackInfo& info);
  Napi::Value GetNbytes(const Napi::CallbackInfo& info);

  // Methods
  Napi::Value ToList(const Napi::CallbackInfo& info);
  Napi::Value Item(const Napi::CallbackInfo& info);
  Napi::Value Reshape(const Napi::CallbackInfo& info);
  Napi::Value Astype(const Napi::CallbackInfo& info);
};

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
}

MLXArray::MLXArray(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<MLXArray>(info), array_(mx::array({}, mx::float32)) {
  if (info.Length() > 0 && !info[0].IsUndefined()) {
    array_ = NapiToArray(info[0]);
    if (info.Length() > 1 && !info[1].IsUndefined()) {
      mx::Dtype dtype = NapiToDtype(info[1]);
      array_ = mx::astype(array_, dtype);
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
  Napi::Env env = info.Env();
  mx::Dtype dtype = array_.dtype();
  if (dtype == mx::bool_) return Napi::String::New(env, "bool");
  if (dtype == mx::uint8) return Napi::String::New(env, "uint8");
  if (dtype == mx::uint16) return Napi::String::New(env, "uint16");
  if (dtype == mx::uint32) return Napi::String::New(env, "uint32");
  if (dtype == mx::uint64) return Napi::String::New(env, "uint64");
  if (dtype == mx::int8) return Napi::String::New(env, "int8");
  if (dtype == mx::int16) return Napi::String::New(env, "int16");
  if (dtype == mx::int32) return Napi::String::New(env, "int32");
  if (dtype == mx::int64) return Napi::String::New(env, "int64");
  if (dtype == mx::float16) return Napi::String::New(env, "float16");
  if (dtype == mx::float32) return Napi::String::New(env, "float32");
  if (dtype == mx::float64) return Napi::String::New(env, "float64");
  if (dtype == mx::bfloat16) return Napi::String::New(env, "bfloat16");
  if (dtype == mx::complex64) return Napi::String::New(env, "complex64");
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
  mx::eval(array_);

  size_t size = array_.size();
  Napi::Array result = Napi::Array::New(env, size);

  mx::Dtype dtype = array_.dtype();
  if (dtype == mx::float32) {
    const float* data = array_.data<float>();
    for (size_t i = 0; i < size; i++) {
      result.Set(i, Napi::Number::New(env, data[i]));
    }
  } else if (dtype == mx::float64) {
    const double* data = array_.data<double>();
    for (size_t i = 0; i < size; i++) {
      result.Set(i, Napi::Number::New(env, data[i]));
    }
  } else if (dtype == mx::int32) {
    const int32_t* data = array_.data<int32_t>();
    for (size_t i = 0; i < size; i++) {
      result.Set(i, Napi::Number::New(env, data[i]));
    }
  } else if (dtype == mx::int64) {
    const int64_t* data = array_.data<int64_t>();
    for (size_t i = 0; i < size; i++) {
      result.Set(i, Napi::Number::New(env, static_cast<double>(data[i])));
    }
  } else if (dtype == mx::uint32) {
    const uint32_t* data = array_.data<uint32_t>();
    for (size_t i = 0; i < size; i++) {
      result.Set(i, Napi::Number::New(env, data[i]));
    }
  } else if (dtype == mx::bool_) {
    const bool* data = array_.data<bool>();
    for (size_t i = 0; i < size; i++) {
      result.Set(i, Napi::Boolean::New(env, data[i]));
    }
  } else {
    // Fallback: convert to float32 first
    mx::array converted = mx::astype(array_, mx::float32);
    mx::eval(converted);
    const float* data = converted.data<float>();
    for (size_t i = 0; i < size; i++) {
      result.Set(i, Napi::Number::New(env, data[i]));
    }
  }

  return result;
}

Napi::Value MLXArray::Item(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::eval(array_);

  if (array_.size() != 1) {
    throw Napi::Error::New(env, "item() only works for arrays with exactly one element");
  }

  mx::Dtype dtype = array_.dtype();
  if (dtype == mx::float32) {
    return Napi::Number::New(env, array_.data<float>()[0]);
  } else if (dtype == mx::float64) {
    return Napi::Number::New(env, array_.data<double>()[0]);
  } else if (dtype == mx::int32) {
    return Napi::Number::New(env, array_.data<int32_t>()[0]);
  } else if (dtype == mx::bool_) {
    return Napi::Boolean::New(env, array_.data<bool>()[0]);
  }

  // Fallback
  mx::array converted = mx::astype(array_, mx::float32);
  mx::eval(converted);
  return Napi::Number::New(env, converted.data<float>()[0]);
}

Napi::Value MLXArray::Reshape(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 1) {
    throw Napi::TypeError::New(env, "reshape requires shape argument");
  }
  mx::Shape shape = NapiToShape(info[0]);
  mx::array result = mx::reshape(array_, shape);
  return ArrayToNapi(env, result);
}

Napi::Value MLXArray::Astype(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 1) {
    throw Napi::TypeError::New(env, "astype requires dtype argument");
  }
  mx::Dtype dtype = NapiToDtype(info[0]);
  mx::array result = mx::astype(array_, dtype);
  return ArrayToNapi(env, result);
}
`;
  }

  /**
   * Generate function wrappers for all exported functions
   */
  private generateFunctionWrappers(): string {
    const lines: string[] = [];
    lines.push('// ============================================================================');
    lines.push('// Function Wrappers');
    lines.push('// ============================================================================');
    lines.push('');

    for (const [name, exported] of this.exports) {
      const overloads = this.functions.get(name);
      if (!overloads || overloads.length === 0) {
        // Function not found in C++ headers - skip or generate stub
        lines.push(`// ${name}: Not found in C++ headers`);
        continue;
      }

      lines.push(this.generateFunctionWrapper(name, overloads));
      lines.push('');
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

    // For functions with multiple overloads, generate dispatch logic
    lines.push(`Napi::Value Wrap_${name}(const Napi::CallbackInfo& info) {`);
    lines.push('  Napi::Env env = info.Env();');

    if (sorted.length === 1) {
      // Single overload - straightforward
      lines.push(this.generateSingleOverloadBody(sorted[0], '  '));
    } else {
      // Multiple overloads - need dispatch
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
    const requiredCount = fn.params.filter(p => !p.defaultValue).length;

    // Parameter extraction
    for (let i = 0; i < fn.params.length; i++) {
      const param = fn.params[i];
      lines.push(this.generateParamExtraction(param, i, indent));
    }

    // Function call - use correct namespace
    const args = fn.params.map(p => p.name).join(', ');
    // Map namespace to the correct C++ namespace
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
    const lines: string[] = [];

    // Find the most flexible overload (fewest required params)
    const primary = overloads[0];
    const maxParams = Math.max(...overloads.map(o => o.params.length));

    // Special case: arange - dispatch based on argument count
    if (name === 'arange') {
      return this.generateArangeDispatch(name, overloads, indent);
    }

    // For common patterns, generate smart dispatch
    // Pattern 1: sum(array), sum(array, axis), sum(array, axes) - MUST have keepdims
    const hasAxisOverloads = overloads.some(o =>
      o.params.some(p => p.type === 'int' && p.name.includes('axis'))
    );
    const hasAxesOverloads = overloads.some(o =>
      o.params.some(p => p.type === 'std::vector<int>' && p.name.includes('axes'))
    );
    // Critical: Only treat as reduction if it has keepdims parameter
    const hasKeepdims = overloads.some(o =>
      o.params.some(p => p.name === 'keepdims')
    );

    // Check for var/std which have ddof parameter IN ADDITION TO keepdims
    const hasDdof = overloads.some(o =>
      o.params.some(p => p.name === 'ddof')
    );

    // var/std special case - must check BEFORE regular reductions
    if (hasAxisOverloads && hasAxesOverloads && hasKeepdims && hasDdof) {
      return this.generateVarianceDispatch(name, overloads, indent);
    }

    if (hasAxisOverloads && hasAxesOverloads && hasKeepdims) {
      // Regular reduction functions (sum, mean, max, min, etc.) - no ddof
      return this.generateReductionDispatch(name, overloads, indent);
    }

    // Default: use the most general overload
    return this.generateSingleOverloadBody(primary, indent);
  }

  /**
   * Generate dispatch for arange function - argument count based dispatch
   */
  private generateArangeDispatch(name: string, overloads: CppFunction[], indent: string): string {
    const lines: string[] = [];

    lines.push(`${indent}mx::StreamOrDevice s = {};`);
    lines.push('');
    lines.push(`${indent}// Dispatch based on argument count`);
    lines.push(`${indent}if (info.Length() == 1) {`);
    lines.push(`${indent}  // arange(stop)`);
    lines.push(`${indent}  double stop = info[0].As<Napi::Number>().DoubleValue();`);
    lines.push(`${indent}  return ArrayToNapi(env, mx::arange(stop, s));`);
    lines.push(`${indent}}`);
    lines.push('');
    lines.push(`${indent}if (info.Length() == 2) {`);
    lines.push(`${indent}  // arange(start, stop)`);
    lines.push(`${indent}  double start = info[0].As<Napi::Number>().DoubleValue();`);
    lines.push(`${indent}  double stop = info[1].As<Napi::Number>().DoubleValue();`);
    lines.push(`${indent}  return ArrayToNapi(env, mx::arange(start, stop, 1.0, s));`);
    lines.push(`${indent}}`);
    lines.push('');
    lines.push(`${indent}if (info.Length() >= 3) {`);
    lines.push(`${indent}  // arange(start, stop, step)`);
    lines.push(`${indent}  double start = info[0].As<Napi::Number>().DoubleValue();`);
    lines.push(`${indent}  double stop = info[1].As<Napi::Number>().DoubleValue();`);
    lines.push(`${indent}  double step = info[2].As<Napi::Number>().DoubleValue();`);
    lines.push(`${indent}  return ArrayToNapi(env, mx::arange(start, stop, step, s));`);
    lines.push(`${indent}}`);
    lines.push('');
    lines.push(`${indent}// Default fallback`);
    lines.push(`${indent}return env.Undefined();`);

    return lines.join('\n');
  }

  /**
   * Generate dispatch for reduction functions (sum, mean, max, etc.)
   */
  private generateReductionDispatch(name: string, overloads: CppFunction[], indent: string): string {
    const lines: string[] = [];

    // Find overloads
    const allOverload = overloads.find(o => !o.params.some(p => p.name.includes('axis')));
    const axisOverload = overloads.find(o => o.params.some(p => p.type === 'int' && p.name === 'axis'));
    const axesOverload = overloads.find(o => o.params.some(p => p.type.includes('vector') && p.name === 'axes'));

    lines.push(`${indent}mx::array a = NapiToArray(info[0]);`);
    lines.push(`${indent}bool keepdims = false;`);
    lines.push(`${indent}mx::StreamOrDevice s = {};`);
    lines.push('');
    lines.push(`${indent}// Dispatch based on arguments`);
    lines.push(`${indent}if (info.Length() == 1 || info[1].IsUndefined()) {`);
    lines.push(`${indent}  // ${name}(array) - reduce all`);
    lines.push(`${indent}  return ArrayToNapi(env, mx::${name}(a, keepdims, s));`);
    lines.push(`${indent}}`);
    lines.push('');
    lines.push(`${indent}if (info[1].IsNumber()) {`);
    lines.push(`${indent}  // ${name}(array, axis)`);
    lines.push(`${indent}  int axis = info[1].As<Napi::Number>().Int32Value();`);
    lines.push(`${indent}  if (info.Length() > 2 && info[2].IsBoolean()) {`);
    lines.push(`${indent}    keepdims = info[2].As<Napi::Boolean>().Value();`);
    lines.push(`${indent}  }`);
    lines.push(`${indent}  return ArrayToNapi(env, mx::${name}(a, axis, keepdims, s));`);
    lines.push(`${indent}}`);
    lines.push('');
    lines.push(`${indent}if (info[1].IsArray()) {`);
    lines.push(`${indent}  // ${name}(array, axes)`);
    lines.push(`${indent}  std::vector<int> axes = NapiToVecInt(info[1]);`);
    lines.push(`${indent}  if (info.Length() > 2 && info[2].IsBoolean()) {`);
    lines.push(`${indent}    keepdims = info[2].As<Napi::Boolean>().Value();`);
    lines.push(`${indent}  }`);
    lines.push(`${indent}  return ArrayToNapi(env, mx::${name}(a, axes, keepdims, s));`);
    lines.push(`${indent}}`);
    lines.push('');
    lines.push(`${indent}return ArrayToNapi(env, mx::${name}(a, keepdims, s));`);

    return lines.join('\n');
  }

  /**
   * Generate dispatch for variance functions (var, std) which have ddof instead of keepdims
   */
  private generateVarianceDispatch(name: string, overloads: CppFunction[], indent: string): string {
    const lines: string[] = [];

    lines.push(`${indent}mx::array a = NapiToArray(info[0]);`);
    lines.push(`${indent}bool keepdims = false;`);
    lines.push(`${indent}int ddof = 0;`);
    lines.push(`${indent}mx::StreamOrDevice s = {};`);
    lines.push('');
    lines.push(`${indent}// Dispatch based on arguments`);
    lines.push(`${indent}if (info.Length() == 1 || info[1].IsUndefined()) {`);
    lines.push(`${indent}  // ${name}(array) - reduce all`);
    lines.push(`${indent}  return ArrayToNapi(env, mx::${name}(a, keepdims, ddof, s));`);
    lines.push(`${indent}}`);
    lines.push('');
    lines.push(`${indent}if (info[1].IsNumber()) {`);
    lines.push(`${indent}  // ${name}(array, axis) or ${name}(array, axis, keepdims, ddof)`);
    lines.push(`${indent}  int axis = info[1].As<Napi::Number>().Int32Value();`);
    lines.push(`${indent}  if (info.Length() > 2 && info[2].IsBoolean()) {`);
    lines.push(`${indent}    keepdims = info[2].As<Napi::Boolean>().Value();`);
    lines.push(`${indent}  }`);
    lines.push(`${indent}  if (info.Length() > 3 && info[3].IsNumber()) {`);
    lines.push(`${indent}    ddof = info[3].As<Napi::Number>().Int32Value();`);
    lines.push(`${indent}  }`);
    lines.push(`${indent}  return ArrayToNapi(env, mx::${name}(a, axis, keepdims, ddof, s));`);
    lines.push(`${indent}}`);
    lines.push('');
    lines.push(`${indent}if (info[1].IsArray()) {`);
    lines.push(`${indent}  // ${name}(array, axes)`);
    lines.push(`${indent}  std::vector<int> axes = NapiToVecInt(info[1]);`);
    lines.push(`${indent}  if (info.Length() > 2 && info[2].IsBoolean()) {`);
    lines.push(`${indent}    keepdims = info[2].As<Napi::Boolean>().Value();`);
    lines.push(`${indent}  }`);
    lines.push(`${indent}  if (info.Length() > 3 && info[3].IsNumber()) {`);
    lines.push(`${indent}    ddof = info[3].As<Napi::Number>().Int32Value();`);
    lines.push(`${indent}  }`);
    lines.push(`${indent}  return ArrayToNapi(env, mx::${name}(a, axes, keepdims, ddof, s));`);
    lines.push(`${indent}}`);
    lines.push('');
    lines.push(`${indent}return ArrayToNapi(env, mx::${name}(a, keepdims, ddof, s));`);

    return lines.join('\n');
  }

  /**
   * Generate parameter extraction code
   */
  private generateParamExtraction(param: CppParam, index: number, indent: string): string {
    const { name, type, defaultValue } = param;
    const hasDefault = !!defaultValue;

    // Common type mappings
    if (type === 'array' || type === 'mx::array') {
      if (hasDefault) {
        return `${indent}mx::array ${name} = info.Length() > ${index} && !info[${index}].IsUndefined() ? NapiToArray(info[${index}]) : ${defaultValue};`;
      }
      return `${indent}mx::array ${name} = NapiToArray(info[${index}]);`;
    }

    if (type === 'Shape' || type === 'mx::Shape') {
      if (hasDefault) {
        return `${indent}mx::Shape ${name} = info.Length() > ${index} && !info[${index}].IsUndefined() ? NapiToShape(info[${index}]) : mx::Shape${defaultValue};`;
      }
      return `${indent}mx::Shape ${name} = NapiToShape(info[${index}]);`;
    }

    if (type === 'std::vector<int>') {
      if (hasDefault) {
        return `${indent}std::vector<int> ${name} = info.Length() > ${index} && !info[${index}].IsUndefined() ? NapiToVecInt(info[${index}]) : std::vector<int>${defaultValue};`;
      }
      return `${indent}std::vector<int> ${name} = NapiToVecInt(info[${index}]);`;
    }

    if (type === 'std::vector<array>' || type === 'std::vector<mx::array>') {
      return `${indent}std::vector<mx::array> ${name} = NapiToVecArray(info[${index}]);`;
    }

    if (type === 'Dtype' || type === 'mx::Dtype') {
      let def = defaultValue || 'float32';
      // Ensure dtype defaults are properly qualified with mx::
      if (def && !def.startsWith('mx::')) {
        def = `mx::${def}`;
      }
      return `${indent}mx::Dtype ${name} = info.Length() > ${index} && !info[${index}].IsUndefined() ? NapiToDtype(info[${index}]) : ${def};`;
    }

    if (type === 'StreamOrDevice' || type === 'mx::StreamOrDevice') {
      return `${indent}mx::StreamOrDevice ${name} = {};`;
    }

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

    // String types
    if (type === 'std::string' || type === 'string') {
      const def = defaultValue ? `"${defaultValue.replace(/"/g, '')}"` : '""';
      return `${indent}std::string ${name} = info.Length() > ${index} && !info[${index}].IsUndefined() ? info[${index}].As<Napi::String>().Utf8Value() : ${def};`;
    }

    // Optional array
    if (type === 'std::optional<array>' || type.includes('optional<array>')) {
      return `${indent}std::optional<mx::array> ${name} = info.Length() > ${index} && !info[${index}].IsUndefined() && !info[${index}].IsNull() ? std::optional<mx::array>(NapiToArray(info[${index}])) : std::nullopt;`;
    }

    // Strides (usually vector<size_t>)
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

    // std::pair<int, int> for conv2d stride/padding
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

    // std::tuple<int, int, int> for conv3d
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

    // Handle optional types
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

    // uint64_t type
    if (type === 'uint64_t') {
      const def = defaultValue || '0';
      return `${indent}uint64_t ${name} = info.Length() > ${index} && !info[${index}].IsUndefined() ? static_cast<uint64_t>(info[${index}].As<Napi::Number>().Int64Value()) : ${def};`;
    }

    // Default fallback - generate a stub that at least compiles
    console.warn(`Unhandled type: ${type} for param ${name}`);
    // Use int as a placeholder that will compile but may not work correctly
    return `${indent}// FIXME: Unhandled type ${type} for param ${name}
${indent}int ${name}_UNHANDLED = 0; (void)${name}_UNHANDLED; // Placeholder`;
  }

  /**
   * Generate module initialization
   */
  private generateModuleInit(): string {
    const lines: string[] = [];

    lines.push('// ============================================================================');
    lines.push('// Module Initialization');
    lines.push('// ============================================================================');
    lines.push('');
    lines.push('Napi::Object Init(Napi::Env env, Napi::Object exports) {');
    lines.push('  // Initialize array class');
    lines.push('  MLXArray::Init(env, exports);');
    lines.push('');

    // Dtype constants
    lines.push('  // Dtype constants');
    const dtypes = ['bool', 'uint8', 'uint16', 'uint32', 'uint64',
      'int8', 'int16', 'int32', 'int64',
      'float16', 'float32', 'float64', 'bfloat16', 'complex64'];
    for (const dtype of dtypes) {
      lines.push(`  exports.Set("${dtype}", Napi::String::New(env, "${dtype}"));`);
    }
    lines.push('');

    // Export all functions
    lines.push('  // Functions');
    for (const [name, _] of this.exports) {
      if (this.functions.has(name)) {
        lines.push(`  exports.Set("${name}", Napi::Function::New(env, Wrap_${name}));`);
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
