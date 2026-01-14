// Auto-generated N-API bindings for MLX
// Generated from C++ headers - DO NOT EDIT

#include <mlx/mlx.h>
#include <napi.h>

#include <functional>
#include <optional>
#include <string>
#include <vector>

namespace mx = mlx::core;

// ============================================================================
// Forward Declarations
// ============================================================================

Napi::FunctionReference constructor;

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

// ============================================================================
// MLXArray Class
// ============================================================================

class MLXArray : public Napi::ObjectWrap<MLXArray> {
 public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports);
  MLXArray(const Napi::CallbackInfo& info);

  mx::array array_;

 private:
  Napi::Value GetShape(const Napi::CallbackInfo& info);
  Napi::Value GetNdim(const Napi::CallbackInfo& info);
  Napi::Value GetSize(const Napi::CallbackInfo& info);
  Napi::Value GetDtype(const Napi::CallbackInfo& info);
  Napi::Value GetItemsize(const Napi::CallbackInfo& info);
  Napi::Value GetNbytes(const Napi::CallbackInfo& info);
  Napi::Value ToList(const Napi::CallbackInfo& info);
  Napi::Value Item(const Napi::CallbackInfo& info);
  Napi::Value Reshape(const Napi::CallbackInfo& info);
  Napi::Value Astype(const Napi::CallbackInfo& info);
};

Napi::Object MLXArray::Init(Napi::Env env, Napi::Object exports) {
  Napi::Function func =
      DefineClass(env, "MLXArray",
                  {
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
  if (dtype == mx::bool_)
    return Napi::String::New(env, "bool");
  if (dtype == mx::uint8)
    return Napi::String::New(env, "uint8");
  if (dtype == mx::uint16)
    return Napi::String::New(env, "uint16");
  if (dtype == mx::uint32)
    return Napi::String::New(env, "uint32");
  if (dtype == mx::uint64)
    return Napi::String::New(env, "uint64");
  if (dtype == mx::int8)
    return Napi::String::New(env, "int8");
  if (dtype == mx::int16)
    return Napi::String::New(env, "int16");
  if (dtype == mx::int32)
    return Napi::String::New(env, "int32");
  if (dtype == mx::int64)
    return Napi::String::New(env, "int64");
  if (dtype == mx::float16)
    return Napi::String::New(env, "float16");
  if (dtype == mx::float32)
    return Napi::String::New(env, "float32");
  if (dtype == mx::float64)
    return Napi::String::New(env, "float64");
  if (dtype == mx::bfloat16)
    return Napi::String::New(env, "bfloat16");
  if (dtype == mx::complex64)
    return Napi::String::New(env, "complex64");
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

// ============================================================================
// Type Conversion Helpers
// ============================================================================

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

Napi::Value ArrayToNapi(Napi::Env env, const mx::array& arr) {
  Napi::Object obj = constructor.New({});
  MLXArray* wrapper = Napi::ObjectWrap<MLXArray>::Unwrap(obj);
  wrapper->array_ = arr;
  return obj;
}

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

Napi::Value VecArrayToNapi(Napi::Env env, const std::vector<mx::array>& vec) {
  Napi::Array arr = Napi::Array::New(env, vec.size());
  for (size_t i = 0; i < vec.size(); i++) {
    arr.Set(i, ArrayToNapi(env, vec[i]));
  }
  return arr;
}

mx::Dtype NapiToDtype(const Napi::Value& value) {
  if (value.IsString()) {
    std::string s = value.As<Napi::String>().Utf8Value();
    if (s == "bool")
      return mx::bool_;
    if (s == "uint8")
      return mx::uint8;
    if (s == "uint16")
      return mx::uint16;
    if (s == "uint32")
      return mx::uint32;
    if (s == "uint64")
      return mx::uint64;
    if (s == "int8")
      return mx::int8;
    if (s == "int16")
      return mx::int16;
    if (s == "int32")
      return mx::int32;
    if (s == "int64")
      return mx::int64;
    if (s == "float16")
      return mx::float16;
    if (s == "float32")
      return mx::float32;
    if (s == "float64")
      return mx::float64;
    if (s == "bfloat16")
      return mx::bfloat16;
    if (s == "complex64")
      return mx::complex64;
  }
  return mx::float32;
}

mx::StreamOrDevice NapiToStreamOrDevice(const Napi::Value& value) {
  return {};
}

// ============================================================================
// Generated Function Wrappers
// ============================================================================

// @@FUNCTION_WRAPPERS@@

// ============================================================================
// Module Initialization
// ============================================================================

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  MLXArray::Init(env, exports);

  // Dtype constants
  exports.Set("bool", Napi::String::New(env, "bool"));
  exports.Set("uint8", Napi::String::New(env, "uint8"));
  exports.Set("uint16", Napi::String::New(env, "uint16"));
  exports.Set("uint32", Napi::String::New(env, "uint32"));
  exports.Set("uint64", Napi::String::New(env, "uint64"));
  exports.Set("int8", Napi::String::New(env, "int8"));
  exports.Set("int16", Napi::String::New(env, "int16"));
  exports.Set("int32", Napi::String::New(env, "int32"));
  exports.Set("int64", Napi::String::New(env, "int64"));
  exports.Set("float16", Napi::String::New(env, "float16"));
  exports.Set("float32", Napi::String::New(env, "float32"));
  exports.Set("float64", Napi::String::New(env, "float64"));
  exports.Set("bfloat16", Napi::String::New(env, "bfloat16"));
  exports.Set("complex64", Napi::String::New(env, "complex64"));

  // Module metadata
  exports.Set("__version__", Napi::String::New(env, "0.1.0"));
  exports.Set("__mlx_available__", Napi::Boolean::New(env, true));

  // Functions
  // @@EXPORTS@@

  return exports;
}

NODE_API_MODULE(mlx_node, Init)
