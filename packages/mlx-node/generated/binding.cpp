// Auto-generated N-API bindings for MLX
// Generated from C++ headers - DO NOT EDIT

#include <mlx/fast.h>
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
mx::Strides NapiToStrides(const Napi::Value& value);
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
  try {
    if (info.Length() > 0 && !info[0].IsUndefined()) {
      array_ = NapiToArray(info[0]);
      if (info.Length() > 1 && !info[1].IsUndefined()) {
        mx::Dtype dtype = NapiToDtype(info[1]);
        array_ = mx::astype(array_, dtype);
      }
    }
  } catch (const std::exception& e) {
    throw Napi::Error::New(info.Env(), e.what());
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
  try {
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
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value MLXArray::Item(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  try {
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
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value MLXArray::Reshape(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  try {
    if (info.Length() < 1) {
      throw Napi::TypeError::New(env, "reshape requires shape argument");
    }
    mx::Shape shape = NapiToShape(info[0]);
    mx::array result = mx::reshape(array_, shape);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value MLXArray::Astype(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  try {
    if (info.Length() < 1) {
      throw Napi::TypeError::New(env, "astype requires dtype argument");
    }
    mx::Dtype dtype = NapiToDtype(info[0]);
    mx::array result = mx::astype(array_, dtype);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
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

mx::Strides NapiToStrides(const Napi::Value& value) {
  mx::Strides strides;
  if (value.IsArray()) {
    Napi::Array arr = value.As<Napi::Array>();
    for (uint32_t i = 0; i < arr.Length(); i++) {
      strides.push_back(static_cast<size_t>(arr.Get(i).As<Napi::Number>().Int64Value()));
    }
  }
  return strides;
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

Napi::Value Wrap_reshape(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::Shape shape = NapiToShape(info[1]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::reshape(a, shape, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_flatten(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::flatten(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_unflatten(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  int axis = info[1].As<Napi::Number>().Int32Value();
  mx::Shape shape = NapiToShape(info[2]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::unflatten(a, axis, shape, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_squeeze(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::squeeze(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_expand_dims(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  std::vector<int> axes = NapiToVecInt(info[1]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::expand_dims(a, axes, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_abs(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::abs(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_sign(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::sign(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_negative(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::negative(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_add(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::array b = NapiToArray(info[1]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::add(a, b, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_subtract(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::array b = NapiToArray(info[1]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::subtract(a, b, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_multiply(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::array b = NapiToArray(info[1]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::multiply(a, b, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_divide(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::array b = NapiToArray(info[1]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::divide(a, b, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_divmod(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::array b = NapiToArray(info[1]);
  mx::StreamOrDevice s = {};
  try {
    std::vector<mx::array> result = mx::divmod(a, b, s);
    return VecArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_floor_divide(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::array b = NapiToArray(info[1]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::floor_divide(a, b, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_remainder(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::array b = NapiToArray(info[1]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::remainder(a, b, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_equal(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::array b = NapiToArray(info[1]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::equal(a, b, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_not_equal(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::array b = NapiToArray(info[1]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::not_equal(a, b, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_less(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::array b = NapiToArray(info[1]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::less(a, b, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_less_equal(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::array b = NapiToArray(info[1]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::less_equal(a, b, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_greater(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::array b = NapiToArray(info[1]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::greater(a, b, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_greater_equal(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::array b = NapiToArray(info[1]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::greater_equal(a, b, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_array_equal(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::array b = NapiToArray(info[1]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::array_equal(a, b, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_matmul(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::array b = NapiToArray(info[1]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::matmul(a, b, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_square(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::square(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_sqrt(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::sqrt(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_rsqrt(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::rsqrt(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_reciprocal(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::reciprocal(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_logical_not(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::logical_not(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_logical_and(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::array b = NapiToArray(info[1]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::logical_and(a, b, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_logical_or(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::array b = NapiToArray(info[1]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::logical_or(a, b, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_logaddexp(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::array b = NapiToArray(info[1]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::logaddexp(a, b, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_exp(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::exp(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_expm1(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::expm1(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_erf(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::erf(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_erfinv(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::erfinv(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_sin(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::sin(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_cos(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::cos(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_tan(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::tan(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_arcsin(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::arcsin(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_arccos(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::arccos(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_arctan(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::arctan(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_arctan2(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::array b = NapiToArray(info[1]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::arctan2(a, b, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_sinh(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::sinh(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_cosh(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::cosh(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_tanh(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::tanh(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_arcsinh(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::arcsinh(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_arccosh(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::arccosh(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_arctanh(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::arctanh(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_degrees(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::degrees(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_radians(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::radians(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_log(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::log(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_log2(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::log2(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_log10(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::log10(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_log1p(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::log1p(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_stop_gradient(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::stop_gradient(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_sigmoid(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::sigmoid(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_power(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::array b = NapiToArray(info[1]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::power(a, b, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_arange(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  try {
    mx::StreamOrDevice s = {};
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
    return env.Undefined();
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_linspace(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  double start = info[0].As<Napi::Number>().DoubleValue();
  double stop = info[1].As<Napi::Number>().DoubleValue();
  int num =
      info.Length() > 2 && !info[2].IsUndefined() ? info[2].As<Napi::Number>().Int32Value() : 50;
  mx::Dtype dtype =
      info.Length() > 3 && !info[3].IsUndefined() ? NapiToDtype(info[3]) : mx::float32;
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::linspace(start, stop, num, dtype, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_kron(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::array b = NapiToArray(info[1]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::kron(a, b, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_take(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::array indices = NapiToArray(info[1]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::take(a, indices, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_take_along_axis(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::array indices = NapiToArray(info[1]);
  int axis = info[2].As<Napi::Number>().Int32Value();
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::take_along_axis(a, indices, axis, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_put_along_axis(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::array indices = NapiToArray(info[1]);
  mx::array values = NapiToArray(info[2]);
  int axis = info[3].As<Napi::Number>().Int32Value();
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::put_along_axis(a, indices, values, axis, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_full(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::Shape shape = NapiToShape(info[0]);
  mx::array vals = NapiToArray(info[1]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::full(shape, vals, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_zeros(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::Shape shape = NapiToShape(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::zeros(shape, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

// asarray: Not found in C++ headers
Napi::Value Wrap_zeros_like(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::zeros_like(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_ones(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::Shape shape = NapiToShape(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::ones(shape, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_ones_like(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::ones_like(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_eye(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  int n = info[0].As<Napi::Number>().Int32Value();
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::eye(n, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_identity(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  int n = info[0].As<Napi::Number>().Int32Value();
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::identity(n, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_tri(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  int n = info[0].As<Napi::Number>().Int32Value();
  mx::Dtype type = NapiToDtype(info[1]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::tri(n, type, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_tril(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array x = NapiToArray(info[0]);
  int k = info.Length() > 1 && !info[1].IsUndefined() ? info[1].As<Napi::Number>().Int32Value() : 0;
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::tril(x, k, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_triu(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array x = NapiToArray(info[0]);
  int k = info.Length() > 1 && !info[1].IsUndefined() ? info[1].As<Napi::Number>().Int32Value() : 0;
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::triu(x, k, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_allclose(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::array b = NapiToArray(info[1]);
  double rtol =
      info.Length() > 2 && !info[2].IsUndefined() ? info[2].As<Napi::Number>().DoubleValue() : 1e-5;
  double atol =
      info.Length() > 3 && !info[3].IsUndefined() ? info[3].As<Napi::Number>().DoubleValue() : 1e-8;
  bool equal_nan =
      info.Length() > 4 && !info[4].IsUndefined() ? info[4].As<Napi::Boolean>().Value() : false;
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::allclose(a, b, rtol, atol, equal_nan, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_isclose(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::array b = NapiToArray(info[1]);
  double rtol =
      info.Length() > 2 && !info[2].IsUndefined() ? info[2].As<Napi::Number>().DoubleValue() : 1e-5;
  double atol =
      info.Length() > 3 && !info[3].IsUndefined() ? info[3].As<Napi::Number>().DoubleValue() : 1e-8;
  bool equal_nan =
      info.Length() > 4 && !info[4].IsUndefined() ? info[4].As<Napi::Boolean>().Value() : false;
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::isclose(a, b, rtol, atol, equal_nan, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_all(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  try {
    mx::array a = NapiToArray(info[0]);
    bool keepdims = false;
    mx::StreamOrDevice s = {};
    if (info.Length() == 1 || info[1].IsUndefined()) {
      return ArrayToNapi(env, mx::all(a, keepdims, s));
    }
    if (info[1].IsNumber()) {
      int axis = info[1].As<Napi::Number>().Int32Value();
      if (info.Length() > 2 && info[2].IsBoolean()) {
        keepdims = info[2].As<Napi::Boolean>().Value();
      }
      return ArrayToNapi(env, mx::all(a, axis, keepdims, s));
    }
    if (info[1].IsArray()) {
      std::vector<int> axes = NapiToVecInt(info[1]);
      if (info.Length() > 2 && info[2].IsBoolean()) {
        keepdims = info[2].As<Napi::Boolean>().Value();
      }
      return ArrayToNapi(env, mx::all(a, axes, keepdims, s));
    }
    return ArrayToNapi(env, mx::all(a, keepdims, s));
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_any(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  try {
    mx::array a = NapiToArray(info[0]);
    bool keepdims = false;
    mx::StreamOrDevice s = {};
    if (info.Length() == 1 || info[1].IsUndefined()) {
      return ArrayToNapi(env, mx::any(a, keepdims, s));
    }
    if (info[1].IsNumber()) {
      int axis = info[1].As<Napi::Number>().Int32Value();
      if (info.Length() > 2 && info[2].IsBoolean()) {
        keepdims = info[2].As<Napi::Boolean>().Value();
      }
      return ArrayToNapi(env, mx::any(a, axis, keepdims, s));
    }
    if (info[1].IsArray()) {
      std::vector<int> axes = NapiToVecInt(info[1]);
      if (info.Length() > 2 && info[2].IsBoolean()) {
        keepdims = info[2].As<Napi::Boolean>().Value();
      }
      return ArrayToNapi(env, mx::any(a, axes, keepdims, s));
    }
    return ArrayToNapi(env, mx::any(a, keepdims, s));
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_minimum(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::array b = NapiToArray(info[1]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::minimum(a, b, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_maximum(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::array b = NapiToArray(info[1]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::maximum(a, b, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_floor(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::floor(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_ceil(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::ceil(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_isnan(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::isnan(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_isinf(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::isinf(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_isfinite(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::isfinite(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_isposinf(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::isposinf(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_isneginf(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::isneginf(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_moveaxis(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  int source = info[1].As<Napi::Number>().Int32Value();
  int destination = info[2].As<Napi::Number>().Int32Value();
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::moveaxis(a, source, destination, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_swapaxes(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  int axis1 = info[1].As<Napi::Number>().Int32Value();
  int axis2 = info[2].As<Napi::Number>().Int32Value();
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::swapaxes(a, axis1, axis2, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_transpose(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::transpose(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

// permute_dims: Not found in C++ headers
Napi::Value Wrap_sum(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  try {
    mx::array a = NapiToArray(info[0]);
    bool keepdims = false;
    mx::StreamOrDevice s = {};
    if (info.Length() == 1 || info[1].IsUndefined()) {
      return ArrayToNapi(env, mx::sum(a, keepdims, s));
    }
    if (info[1].IsNumber()) {
      int axis = info[1].As<Napi::Number>().Int32Value();
      if (info.Length() > 2 && info[2].IsBoolean()) {
        keepdims = info[2].As<Napi::Boolean>().Value();
      }
      return ArrayToNapi(env, mx::sum(a, axis, keepdims, s));
    }
    if (info[1].IsArray()) {
      std::vector<int> axes = NapiToVecInt(info[1]);
      if (info.Length() > 2 && info[2].IsBoolean()) {
        keepdims = info[2].As<Napi::Boolean>().Value();
      }
      return ArrayToNapi(env, mx::sum(a, axes, keepdims, s));
    }
    return ArrayToNapi(env, mx::sum(a, keepdims, s));
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_prod(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  try {
    mx::array a = NapiToArray(info[0]);
    bool keepdims = false;
    mx::StreamOrDevice s = {};
    if (info.Length() == 1 || info[1].IsUndefined()) {
      return ArrayToNapi(env, mx::prod(a, keepdims, s));
    }
    if (info[1].IsNumber()) {
      int axis = info[1].As<Napi::Number>().Int32Value();
      if (info.Length() > 2 && info[2].IsBoolean()) {
        keepdims = info[2].As<Napi::Boolean>().Value();
      }
      return ArrayToNapi(env, mx::prod(a, axis, keepdims, s));
    }
    if (info[1].IsArray()) {
      std::vector<int> axes = NapiToVecInt(info[1]);
      if (info.Length() > 2 && info[2].IsBoolean()) {
        keepdims = info[2].As<Napi::Boolean>().Value();
      }
      return ArrayToNapi(env, mx::prod(a, axes, keepdims, s));
    }
    return ArrayToNapi(env, mx::prod(a, keepdims, s));
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_min(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  try {
    mx::array a = NapiToArray(info[0]);
    bool keepdims = false;
    mx::StreamOrDevice s = {};
    if (info.Length() == 1 || info[1].IsUndefined()) {
      return ArrayToNapi(env, mx::min(a, keepdims, s));
    }
    if (info[1].IsNumber()) {
      int axis = info[1].As<Napi::Number>().Int32Value();
      if (info.Length() > 2 && info[2].IsBoolean()) {
        keepdims = info[2].As<Napi::Boolean>().Value();
      }
      return ArrayToNapi(env, mx::min(a, axis, keepdims, s));
    }
    if (info[1].IsArray()) {
      std::vector<int> axes = NapiToVecInt(info[1]);
      if (info.Length() > 2 && info[2].IsBoolean()) {
        keepdims = info[2].As<Napi::Boolean>().Value();
      }
      return ArrayToNapi(env, mx::min(a, axes, keepdims, s));
    }
    return ArrayToNapi(env, mx::min(a, keepdims, s));
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_max(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  try {
    mx::array a = NapiToArray(info[0]);
    bool keepdims = false;
    mx::StreamOrDevice s = {};
    if (info.Length() == 1 || info[1].IsUndefined()) {
      return ArrayToNapi(env, mx::max(a, keepdims, s));
    }
    if (info[1].IsNumber()) {
      int axis = info[1].As<Napi::Number>().Int32Value();
      if (info.Length() > 2 && info[2].IsBoolean()) {
        keepdims = info[2].As<Napi::Boolean>().Value();
      }
      return ArrayToNapi(env, mx::max(a, axis, keepdims, s));
    }
    if (info[1].IsArray()) {
      std::vector<int> axes = NapiToVecInt(info[1]);
      if (info.Length() > 2 && info[2].IsBoolean()) {
        keepdims = info[2].As<Napi::Boolean>().Value();
      }
      return ArrayToNapi(env, mx::max(a, axes, keepdims, s));
    }
    return ArrayToNapi(env, mx::max(a, keepdims, s));
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_logcumsumexp(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  bool reverse =
      info.Length() > 1 && !info[1].IsUndefined() ? info[1].As<Napi::Boolean>().Value() : false;
  bool inclusive =
      info.Length() > 2 && !info[2].IsUndefined() ? info[2].As<Napi::Boolean>().Value() : true;
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::logcumsumexp(a, reverse, inclusive, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_logsumexp(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  try {
    mx::array a = NapiToArray(info[0]);
    bool keepdims = false;
    mx::StreamOrDevice s = {};
    if (info.Length() == 1 || info[1].IsUndefined()) {
      return ArrayToNapi(env, mx::logsumexp(a, keepdims, s));
    }
    if (info[1].IsNumber()) {
      int axis = info[1].As<Napi::Number>().Int32Value();
      if (info.Length() > 2 && info[2].IsBoolean()) {
        keepdims = info[2].As<Napi::Boolean>().Value();
      }
      return ArrayToNapi(env, mx::logsumexp(a, axis, keepdims, s));
    }
    if (info[1].IsArray()) {
      std::vector<int> axes = NapiToVecInt(info[1]);
      if (info.Length() > 2 && info[2].IsBoolean()) {
        keepdims = info[2].As<Napi::Boolean>().Value();
      }
      return ArrayToNapi(env, mx::logsumexp(a, axes, keepdims, s));
    }
    return ArrayToNapi(env, mx::logsumexp(a, keepdims, s));
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_mean(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  try {
    mx::array a = NapiToArray(info[0]);
    bool keepdims = false;
    mx::StreamOrDevice s = {};
    if (info.Length() == 1 || info[1].IsUndefined()) {
      return ArrayToNapi(env, mx::mean(a, keepdims, s));
    }
    if (info[1].IsNumber()) {
      int axis = info[1].As<Napi::Number>().Int32Value();
      if (info.Length() > 2 && info[2].IsBoolean()) {
        keepdims = info[2].As<Napi::Boolean>().Value();
      }
      return ArrayToNapi(env, mx::mean(a, axis, keepdims, s));
    }
    if (info[1].IsArray()) {
      std::vector<int> axes = NapiToVecInt(info[1]);
      if (info.Length() > 2 && info[2].IsBoolean()) {
        keepdims = info[2].As<Napi::Boolean>().Value();
      }
      return ArrayToNapi(env, mx::mean(a, axes, keepdims, s));
    }
    return ArrayToNapi(env, mx::mean(a, keepdims, s));
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_median(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  try {
    mx::array a = NapiToArray(info[0]);
    bool keepdims = false;
    mx::StreamOrDevice s = {};
    if (info.Length() == 1 || info[1].IsUndefined()) {
      return ArrayToNapi(env, mx::median(a, keepdims, s));
    }
    if (info[1].IsNumber()) {
      int axis = info[1].As<Napi::Number>().Int32Value();
      if (info.Length() > 2 && info[2].IsBoolean()) {
        keepdims = info[2].As<Napi::Boolean>().Value();
      }
      return ArrayToNapi(env, mx::median(a, axis, keepdims, s));
    }
    if (info[1].IsArray()) {
      std::vector<int> axes = NapiToVecInt(info[1]);
      if (info.Length() > 2 && info[2].IsBoolean()) {
        keepdims = info[2].As<Napi::Boolean>().Value();
      }
      return ArrayToNapi(env, mx::median(a, axes, keepdims, s));
    }
    return ArrayToNapi(env, mx::median(a, keepdims, s));
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_var(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  try {
    mx::array a = NapiToArray(info[0]);
    bool keepdims = false;
    int ddof = 0;
    mx::StreamOrDevice s = {};
    if (info.Length() == 1 || info[1].IsUndefined()) {
      return ArrayToNapi(env, mx::var(a, keepdims, ddof, s));
    }
    if (info[1].IsNumber()) {
      int axis = info[1].As<Napi::Number>().Int32Value();
      if (info.Length() > 2 && info[2].IsBoolean()) {
        keepdims = info[2].As<Napi::Boolean>().Value();
      }
      if (info.Length() > 3 && info[3].IsNumber()) {
        ddof = info[3].As<Napi::Number>().Int32Value();
      }
      return ArrayToNapi(env, mx::var(a, axis, keepdims, ddof, s));
    }
    if (info[1].IsArray()) {
      std::vector<int> axes = NapiToVecInt(info[1]);
      if (info.Length() > 2 && info[2].IsBoolean()) {
        keepdims = info[2].As<Napi::Boolean>().Value();
      }
      if (info.Length() > 3 && info[3].IsNumber()) {
        ddof = info[3].As<Napi::Number>().Int32Value();
      }
      return ArrayToNapi(env, mx::var(a, axes, keepdims, ddof, s));
    }
    return ArrayToNapi(env, mx::var(a, keepdims, ddof, s));
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_std(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  try {
    mx::array a = NapiToArray(info[0]);
    bool keepdims = false;
    int ddof = 0;
    mx::StreamOrDevice s = {};
    if (info.Length() == 1 || info[1].IsUndefined()) {
      return ArrayToNapi(env, mx::std(a, keepdims, ddof, s));
    }
    if (info[1].IsNumber()) {
      int axis = info[1].As<Napi::Number>().Int32Value();
      if (info.Length() > 2 && info[2].IsBoolean()) {
        keepdims = info[2].As<Napi::Boolean>().Value();
      }
      if (info.Length() > 3 && info[3].IsNumber()) {
        ddof = info[3].As<Napi::Number>().Int32Value();
      }
      return ArrayToNapi(env, mx::std(a, axis, keepdims, ddof, s));
    }
    if (info[1].IsArray()) {
      std::vector<int> axes = NapiToVecInt(info[1]);
      if (info.Length() > 2 && info[2].IsBoolean()) {
        keepdims = info[2].As<Napi::Boolean>().Value();
      }
      if (info.Length() > 3 && info[3].IsNumber()) {
        ddof = info[3].As<Napi::Number>().Int32Value();
      }
      return ArrayToNapi(env, mx::std(a, axes, keepdims, ddof, s));
    }
    return ArrayToNapi(env, mx::std(a, keepdims, ddof, s));
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_split(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  int num_splits = info[1].As<Napi::Number>().Int32Value();
  mx::StreamOrDevice s = {};
  try {
    std::vector<mx::array> result = mx::split(a, num_splits, s);
    return VecArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_argmin(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::argmin(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_argmax(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::argmax(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_sort(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::sort(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_argsort(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::argsort(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_partition(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  int kth = info[1].As<Napi::Number>().Int32Value();
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::partition(a, kth, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_argpartition(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  int kth = info[1].As<Napi::Number>().Int32Value();
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::argpartition(a, kth, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_topk(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  int k = info[1].As<Napi::Number>().Int32Value();
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::topk(a, k, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_broadcast_to(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::Shape shape = NapiToShape(info[1]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::broadcast_to(a, shape, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_broadcast_arrays(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  std::vector<mx::array> inputs = NapiToVecArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    std::vector<mx::array> result = mx::broadcast_arrays(inputs, s);
    return VecArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_softmax(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  bool precise =
      info.Length() > 1 && !info[1].IsUndefined() ? info[1].As<Napi::Boolean>().Value() : false;
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::softmax(a, precise, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_concatenate(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  std::vector<mx::array> arrays = NapiToVecArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::concatenate(arrays, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

// concat: Not found in C++ headers
Napi::Value Wrap_stack(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  std::vector<mx::array> arrays = NapiToVecArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::stack(arrays, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_meshgrid(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  std::vector<mx::array> arrays = NapiToVecArray(info[0]);
  bool sparse =
      info.Length() > 1 && !info[1].IsUndefined() ? info[1].As<Napi::Boolean>().Value() : false;
  std::string indexing =
      info.Length() > 2 && !info[2].IsUndefined() ? info[2].As<Napi::String>().Utf8Value() : "xy";
  mx::StreamOrDevice s = {};
  try {
    std::vector<mx::array> result = mx::meshgrid(arrays, sparse, indexing, s);
    return VecArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_repeat(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array arr = NapiToArray(info[0]);
  int repeats = info[1].As<Napi::Number>().Int32Value();
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::repeat(arr, repeats, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_clip(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  std::optional<mx::array> a_min = info.Length() > 1 && !info[1].IsUndefined() && !info[1].IsNull()
                                       ? std::optional<mx::array>(NapiToArray(info[1]))
                                       : std::nullopt;
  std::optional<mx::array> a_max = info.Length() > 2 && !info[2].IsUndefined() && !info[2].IsNull()
                                       ? std::optional<mx::array>(NapiToArray(info[2]))
                                       : std::nullopt;
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::clip(a, a_min, a_max, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

// pad: Not found in C++ headers
Napi::Value Wrap_as_strided(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::Shape shape = NapiToShape(info[1]);
  mx::Strides strides = NapiToStrides(info[2]);
  size_t offset = static_cast<size_t>(info[3].As<Napi::Number>().Int64Value());
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::as_strided(a, shape, strides, offset, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_cumsum(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  bool reverse =
      info.Length() > 1 && !info[1].IsUndefined() ? info[1].As<Napi::Boolean>().Value() : false;
  bool inclusive =
      info.Length() > 2 && !info[2].IsUndefined() ? info[2].As<Napi::Boolean>().Value() : true;
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::cumsum(a, reverse, inclusive, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_cumprod(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  bool reverse =
      info.Length() > 1 && !info[1].IsUndefined() ? info[1].As<Napi::Boolean>().Value() : false;
  bool inclusive =
      info.Length() > 2 && !info[2].IsUndefined() ? info[2].As<Napi::Boolean>().Value() : true;
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::cumprod(a, reverse, inclusive, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_cummax(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  bool reverse =
      info.Length() > 1 && !info[1].IsUndefined() ? info[1].As<Napi::Boolean>().Value() : false;
  bool inclusive =
      info.Length() > 2 && !info[2].IsUndefined() ? info[2].As<Napi::Boolean>().Value() : true;
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::cummax(a, reverse, inclusive, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_cummin(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  bool reverse =
      info.Length() > 1 && !info[1].IsUndefined() ? info[1].As<Napi::Boolean>().Value() : false;
  bool inclusive =
      info.Length() > 2 && !info[2].IsUndefined() ? info[2].As<Napi::Boolean>().Value() : true;
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::cummin(a, reverse, inclusive, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

// conj: Not found in C++ headers
Napi::Value Wrap_conjugate(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::conjugate(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

// convolve: Not found in C++ headers
Napi::Value Wrap_conv1d(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array input = NapiToArray(info[0]);
  mx::array weight = NapiToArray(info[1]);
  int stride =
      info.Length() > 2 && !info[2].IsUndefined() ? info[2].As<Napi::Number>().Int32Value() : 1;
  int padding =
      info.Length() > 3 && !info[3].IsUndefined() ? info[3].As<Napi::Number>().Int32Value() : 0;
  int dilation =
      info.Length() > 4 && !info[4].IsUndefined() ? info[4].As<Napi::Number>().Int32Value() : 1;
  int groups =
      info.Length() > 5 && !info[5].IsUndefined() ? info[5].As<Napi::Number>().Int32Value() : 1;
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::conv1d(input, weight, stride, padding, dilation, groups, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_conv2d(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array input = NapiToArray(info[0]);
  mx::array weight = NapiToArray(info[1]);
  std::pair<int, int> stride =
      info.Length() > 2 && !info[2].IsUndefined() ? [&]() {
        if (info[2].IsArray()) {
          Napi::Array arr = info[2].As<Napi::Array>();
          return std::pair<int, int>{arr.Get(0u).As<Napi::Number>().Int32Value(),
                                     arr.Get(1u).As<Napi::Number>().Int32Value()};
        }
        return std::pair<int, int>{1, 1};
      }()
                                                  : std::pair<int, int>{1, 1};
  std::pair<int, int> padding =
      info.Length() > 3 && !info[3].IsUndefined() ? [&]() {
        if (info[3].IsArray()) {
          Napi::Array arr = info[3].As<Napi::Array>();
          return std::pair<int, int>{arr.Get(0u).As<Napi::Number>().Int32Value(),
                                     arr.Get(1u).As<Napi::Number>().Int32Value()};
        }
        return std::pair<int, int>{0, 0};
      }()
                                                  : std::pair<int, int>{0, 0};
  std::pair<int, int> dilation =
      info.Length() > 4 && !info[4].IsUndefined() ? [&]() {
        if (info[4].IsArray()) {
          Napi::Array arr = info[4].As<Napi::Array>();
          return std::pair<int, int>{arr.Get(0u).As<Napi::Number>().Int32Value(),
                                     arr.Get(1u).As<Napi::Number>().Int32Value()};
        }
        return std::pair<int, int>{1, 1};
      }()
                                                  : std::pair<int, int>{1, 1};
  int groups =
      info.Length() > 5 && !info[5].IsUndefined() ? info[5].As<Napi::Number>().Int32Value() : 1;
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::conv2d(input, weight, stride, padding, dilation, groups, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_conv3d(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array input = NapiToArray(info[0]);
  mx::array weight = NapiToArray(info[1]);
  std::tuple<int, int, int> stride =
      info.Length() > 2 && !info[2].IsUndefined() ? [&]() {
        if (info[2].IsArray()) {
          Napi::Array arr = info[2].As<Napi::Array>();
          return std::tuple<int, int, int>{arr.Get(0u).As<Napi::Number>().Int32Value(),
                                           arr.Get(1u).As<Napi::Number>().Int32Value(),
                                           arr.Get(2u).As<Napi::Number>().Int32Value()};
        }
        return std::tuple<int, int, int>{1, 1, 1};
      }()
                                                  : std::tuple<int, int, int>{1, 1, 1};
  std::tuple<int, int, int> padding =
      info.Length() > 3 && !info[3].IsUndefined() ? [&]() {
        if (info[3].IsArray()) {
          Napi::Array arr = info[3].As<Napi::Array>();
          return std::tuple<int, int, int>{arr.Get(0u).As<Napi::Number>().Int32Value(),
                                           arr.Get(1u).As<Napi::Number>().Int32Value(),
                                           arr.Get(2u).As<Napi::Number>().Int32Value()};
        }
        return std::tuple<int, int, int>{0, 0, 0};
      }()
                                                  : std::tuple<int, int, int>{0, 0, 0};
  std::tuple<int, int, int> dilation =
      info.Length() > 4 && !info[4].IsUndefined() ? [&]() {
        if (info[4].IsArray()) {
          Napi::Array arr = info[4].As<Napi::Array>();
          return std::tuple<int, int, int>{arr.Get(0u).As<Napi::Number>().Int32Value(),
                                           arr.Get(1u).As<Napi::Number>().Int32Value(),
                                           arr.Get(2u).As<Napi::Number>().Int32Value()};
        }
        return std::tuple<int, int, int>{1, 1, 1};
      }()
                                                  : std::tuple<int, int, int>{1, 1, 1};
  int groups =
      info.Length() > 5 && !info[5].IsUndefined() ? info[5].As<Napi::Number>().Int32Value() : 1;
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::conv3d(input, weight, stride, padding, dilation, groups, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_conv_transpose1d(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array input = NapiToArray(info[0]);
  mx::array weight = NapiToArray(info[1]);
  int stride =
      info.Length() > 2 && !info[2].IsUndefined() ? info[2].As<Napi::Number>().Int32Value() : 1;
  int padding =
      info.Length() > 3 && !info[3].IsUndefined() ? info[3].As<Napi::Number>().Int32Value() : 0;
  int dilation =
      info.Length() > 4 && !info[4].IsUndefined() ? info[4].As<Napi::Number>().Int32Value() : 1;
  int output_padding =
      info.Length() > 5 && !info[5].IsUndefined() ? info[5].As<Napi::Number>().Int32Value() : 0;
  int groups =
      info.Length() > 6 && !info[6].IsUndefined() ? info[6].As<Napi::Number>().Int32Value() : 1;
  mx::StreamOrDevice s = {};
  try {
    mx::array result =
        mx::conv_transpose1d(input, weight, stride, padding, dilation, output_padding, groups, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_conv_transpose2d(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array input = NapiToArray(info[0]);
  mx::array weight = NapiToArray(info[1]);
  std::pair<int, int> stride =
      info.Length() > 2 && !info[2].IsUndefined() ? [&]() {
        if (info[2].IsArray()) {
          Napi::Array arr = info[2].As<Napi::Array>();
          return std::pair<int, int>{arr.Get(0u).As<Napi::Number>().Int32Value(),
                                     arr.Get(1u).As<Napi::Number>().Int32Value()};
        }
        return std::pair<int, int>{1, 1};
      }()
                                                  : std::pair<int, int>{1, 1};
  std::pair<int, int> padding =
      info.Length() > 3 && !info[3].IsUndefined() ? [&]() {
        if (info[3].IsArray()) {
          Napi::Array arr = info[3].As<Napi::Array>();
          return std::pair<int, int>{arr.Get(0u).As<Napi::Number>().Int32Value(),
                                     arr.Get(1u).As<Napi::Number>().Int32Value()};
        }
        return std::pair<int, int>{0, 0};
      }()
                                                  : std::pair<int, int>{0, 0};
  std::pair<int, int> dilation =
      info.Length() > 4 && !info[4].IsUndefined() ? [&]() {
        if (info[4].IsArray()) {
          Napi::Array arr = info[4].As<Napi::Array>();
          return std::pair<int, int>{arr.Get(0u).As<Napi::Number>().Int32Value(),
                                     arr.Get(1u).As<Napi::Number>().Int32Value()};
        }
        return std::pair<int, int>{1, 1};
      }()
                                                  : std::pair<int, int>{1, 1};
  std::pair<int, int> output_padding =
      info.Length() > 5 && !info[5].IsUndefined() ? [&]() {
        if (info[5].IsArray()) {
          Napi::Array arr = info[5].As<Napi::Array>();
          return std::pair<int, int>{arr.Get(0u).As<Napi::Number>().Int32Value(),
                                     arr.Get(1u).As<Napi::Number>().Int32Value()};
        }
        return std::pair<int, int>{0, 0};
      }()
                                                  : std::pair<int, int>{0, 0};
  int groups =
      info.Length() > 6 && !info[6].IsUndefined() ? info[6].As<Napi::Number>().Int32Value() : 1;
  mx::StreamOrDevice s = {};
  try {
    mx::array result =
        mx::conv_transpose2d(input, weight, stride, padding, dilation, output_padding, groups, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_conv_transpose3d(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array input = NapiToArray(info[0]);
  mx::array weight = NapiToArray(info[1]);
  std::tuple<int, int, int> stride =
      info.Length() > 2 && !info[2].IsUndefined() ? [&]() {
        if (info[2].IsArray()) {
          Napi::Array arr = info[2].As<Napi::Array>();
          return std::tuple<int, int, int>{arr.Get(0u).As<Napi::Number>().Int32Value(),
                                           arr.Get(1u).As<Napi::Number>().Int32Value(),
                                           arr.Get(2u).As<Napi::Number>().Int32Value()};
        }
        return std::tuple<int, int, int>{1, 1, 1};
      }()
                                                  : std::tuple<int, int, int>{1, 1, 1};
  std::tuple<int, int, int> padding =
      info.Length() > 3 && !info[3].IsUndefined() ? [&]() {
        if (info[3].IsArray()) {
          Napi::Array arr = info[3].As<Napi::Array>();
          return std::tuple<int, int, int>{arr.Get(0u).As<Napi::Number>().Int32Value(),
                                           arr.Get(1u).As<Napi::Number>().Int32Value(),
                                           arr.Get(2u).As<Napi::Number>().Int32Value()};
        }
        return std::tuple<int, int, int>{0, 0, 0};
      }()
                                                  : std::tuple<int, int, int>{0, 0, 0};
  std::tuple<int, int, int> dilation =
      info.Length() > 4 && !info[4].IsUndefined() ? [&]() {
        if (info[4].IsArray()) {
          Napi::Array arr = info[4].As<Napi::Array>();
          return std::tuple<int, int, int>{arr.Get(0u).As<Napi::Number>().Int32Value(),
                                           arr.Get(1u).As<Napi::Number>().Int32Value(),
                                           arr.Get(2u).As<Napi::Number>().Int32Value()};
        }
        return std::tuple<int, int, int>{1, 1, 1};
      }()
                                                  : std::tuple<int, int, int>{1, 1, 1};
  std::tuple<int, int, int> output_padding =
      info.Length() > 5 && !info[5].IsUndefined() ? [&]() {
        if (info[5].IsArray()) {
          Napi::Array arr = info[5].As<Napi::Array>();
          return std::tuple<int, int, int>{arr.Get(0u).As<Napi::Number>().Int32Value(),
                                           arr.Get(1u).As<Napi::Number>().Int32Value(),
                                           arr.Get(2u).As<Napi::Number>().Int32Value()};
        }
        return std::tuple<int, int, int>{0, 0, 0};
      }()
                                                  : std::tuple<int, int, int>{0, 0, 0};
  int groups =
      info.Length() > 6 && !info[6].IsUndefined() ? info[6].As<Napi::Number>().Int32Value() : 1;
  mx::StreamOrDevice s = {};
  try {
    mx::array result =
        mx::conv_transpose3d(input, weight, stride, padding, dilation, output_padding, groups, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_conv_general(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array input = NapiToArray(info[0]);
  mx::array weight = NapiToArray(info[1]);
  std::vector<int> stride =
      info.Length() > 2 && !info[2].IsUndefined() ? NapiToVecInt(info[2]) : std::vector<int>{};
  std::vector<int> padding_lo =
      info.Length() > 3 && !info[3].IsUndefined() ? NapiToVecInt(info[3]) : std::vector<int>{};
  std::vector<int> padding_hi =
      info.Length() > 4 && !info[4].IsUndefined() ? NapiToVecInt(info[4]) : std::vector<int>{};
  std::vector<int> kernel_dilation =
      info.Length() > 5 && !info[5].IsUndefined() ? NapiToVecInt(info[5]) : std::vector<int>{};
  std::vector<int> input_dilation =
      info.Length() > 6 && !info[6].IsUndefined() ? NapiToVecInt(info[6]) : std::vector<int>{};
  int groups =
      info.Length() > 7 && !info[7].IsUndefined() ? info[7].As<Napi::Number>().Int32Value() : 1;
  bool flip =
      info.Length() > 8 && !info[8].IsUndefined() ? info[8].As<Napi::Boolean>().Value() : false;
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::conv_general(input, weight, stride, padding_lo, padding_hi,
                                        kernel_dilation, input_dilation, groups, flip, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

// save: Not found in C++ headers
// savez: Not found in C++ headers
// savez_compressed: Not found in C++ headers
// load: Not found in C++ headers
// save_safetensors: Not found in C++ headers
// save_gguf: Not found in C++ headers
Napi::Value Wrap_where(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array condition = NapiToArray(info[0]);
  mx::array x = NapiToArray(info[1]);
  mx::array y = NapiToArray(info[2]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::where(condition, x, y, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_nan_to_num(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  double nan =
      info.Length() > 1 && !info[1].IsUndefined() ? info[1].As<Napi::Number>().DoubleValue() : 0.0f;
  std::optional<float> posinf = info.Length() > 2 && !info[2].IsUndefined() && !info[2].IsNull()
                                    ? std::optional<float>(info[2].As<Napi::Number>().FloatValue())
                                    : std::nullopt;
  std::optional<float> neginf = info.Length() > 3 && !info[3].IsUndefined() && !info[3].IsNull()
                                    ? std::optional<float>(info[3].As<Napi::Number>().FloatValue())
                                    : std::nullopt;
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::nan_to_num(a, nan, posinf, neginf, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_round(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::round(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_quantized_matmul(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array x = NapiToArray(info[0]);
  mx::array w = NapiToArray(info[1]);
  mx::array scales = NapiToArray(info[2]);
  std::optional<mx::array> biases = info.Length() > 3 && !info[3].IsUndefined() && !info[3].IsNull()
                                        ? std::optional<mx::array>(NapiToArray(info[3]))
                                        : std::nullopt;
  bool transpose =
      info.Length() > 4 && !info[4].IsUndefined() ? info[4].As<Napi::Boolean>().Value() : true;
  std::optional<int> group_size = info.Length() > 5 && !info[5].IsUndefined() && !info[5].IsNull()
                                      ? std::optional<int>(info[5].As<Napi::Number>().Int32Value())
                                      : std::nullopt;
  std::optional<int> bits = info.Length() > 6 && !info[6].IsUndefined() && !info[6].IsNull()
                                ? std::optional<int>(info[6].As<Napi::Number>().Int32Value())
                                : std::nullopt;
  std::string mode = info.Length() > 7 && !info[7].IsUndefined()
                         ? info[7].As<Napi::String>().Utf8Value()
                         : "affine";
  mx::StreamOrDevice s = {};
  try {
    mx::array result =
        mx::quantized_matmul(x, w, scales, biases, transpose, group_size, bits, mode, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_quantize(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array w = NapiToArray(info[0]);
  std::optional<int> group_size = info.Length() > 1 && !info[1].IsUndefined() && !info[1].IsNull()
                                      ? std::optional<int>(info[1].As<Napi::Number>().Int32Value())
                                      : std::nullopt;
  std::optional<int> bits = info.Length() > 2 && !info[2].IsUndefined() && !info[2].IsNull()
                                ? std::optional<int>(info[2].As<Napi::Number>().Int32Value())
                                : std::nullopt;
  std::string mode = info.Length() > 3 && !info[3].IsUndefined()
                         ? info[3].As<Napi::String>().Utf8Value()
                         : "affine";
  mx::StreamOrDevice s = {};
  try {
    std::vector<mx::array> result = mx::quantize(w, group_size, bits, mode, s);
    return VecArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_dequantize(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array w = NapiToArray(info[0]);
  mx::array scales = NapiToArray(info[1]);
  std::optional<mx::array> biases = info.Length() > 2 && !info[2].IsUndefined() && !info[2].IsNull()
                                        ? std::optional<mx::array>(NapiToArray(info[2]))
                                        : std::nullopt;
  std::optional<int> group_size = info.Length() > 3 && !info[3].IsUndefined() && !info[3].IsNull()
                                      ? std::optional<int>(info[3].As<Napi::Number>().Int32Value())
                                      : std::nullopt;
  std::optional<int> bits = info.Length() > 4 && !info[4].IsUndefined() && !info[4].IsNull()
                                ? std::optional<int>(info[4].As<Napi::Number>().Int32Value())
                                : std::nullopt;
  std::string mode = info.Length() > 5 && !info[5].IsUndefined()
                         ? info[5].As<Napi::String>().Utf8Value()
                         : "affine";
  std::optional<mx::Dtype> dtype = info.Length() > 6 && !info[6].IsUndefined() && !info[6].IsNull()
                                       ? std::optional<mx::Dtype>(NapiToDtype(info[6]))
                                       : std::nullopt;
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::dequantize(w, scales, biases, group_size, bits, mode, dtype, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_gather_qmm(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array x = NapiToArray(info[0]);
  mx::array w = NapiToArray(info[1]);
  mx::array scales = NapiToArray(info[2]);
  std::optional<mx::array> biases = info.Length() > 3 && !info[3].IsUndefined() && !info[3].IsNull()
                                        ? std::optional<mx::array>(NapiToArray(info[3]))
                                        : std::nullopt;
  std::optional<mx::array> lhs_indices =
      info.Length() > 4 && !info[4].IsUndefined() && !info[4].IsNull()
          ? std::optional<mx::array>(NapiToArray(info[4]))
          : std::nullopt;
  std::optional<mx::array> rhs_indices =
      info.Length() > 5 && !info[5].IsUndefined() && !info[5].IsNull()
          ? std::optional<mx::array>(NapiToArray(info[5]))
          : std::nullopt;
  bool transpose =
      info.Length() > 6 && !info[6].IsUndefined() ? info[6].As<Napi::Boolean>().Value() : true;
  std::optional<int> group_size = info.Length() > 7 && !info[7].IsUndefined() && !info[7].IsNull()
                                      ? std::optional<int>(info[7].As<Napi::Number>().Int32Value())
                                      : std::nullopt;
  std::optional<int> bits = info.Length() > 8 && !info[8].IsUndefined() && !info[8].IsNull()
                                ? std::optional<int>(info[8].As<Napi::Number>().Int32Value())
                                : std::nullopt;
  std::string mode = info.Length() > 9 && !info[9].IsUndefined()
                         ? info[9].As<Napi::String>().Utf8Value()
                         : "affine";
  bool sorted_indices =
      info.Length() > 10 && !info[10].IsUndefined() ? info[10].As<Napi::Boolean>().Value() : false;
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::gather_qmm(x, w, scales, biases, lhs_indices, rhs_indices, transpose,
                                      group_size, bits, mode, sorted_indices, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_segmented_mm(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::array b = NapiToArray(info[1]);
  mx::array segments = NapiToArray(info[2]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::segmented_mm(a, b, segments, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_tensordot(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::array b = NapiToArray(info[1]);
  int axis =
      info.Length() > 2 && !info[2].IsUndefined() ? info[2].As<Napi::Number>().Int32Value() : 2;
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::tensordot(a, b, axis, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_inner(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::array b = NapiToArray(info[1]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::inner(a, b, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_outer(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::array b = NapiToArray(info[1]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::outer(a, b, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_tile(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array arr = NapiToArray(info[0]);
  std::vector<int> reps = NapiToVecInt(info[1]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::tile(arr, reps, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_addmm(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array c = NapiToArray(info[0]);
  mx::array a = NapiToArray(info[1]);
  mx::array b = NapiToArray(info[2]);
  double alpha =
      info.Length() > 3 && !info[3].IsUndefined() ? info[3].As<Napi::Number>().DoubleValue() : 1.f;
  double beta =
      info.Length() > 4 && !info[4].IsUndefined() ? info[4].As<Napi::Number>().DoubleValue() : 1.f;
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::addmm(c, a, b, alpha, beta, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_block_masked_mm(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::array b = NapiToArray(info[1]);
  int block_size = info[2].As<Napi::Number>().Int32Value();
  std::optional<mx::array> mask_out =
      info.Length() > 3 && !info[3].IsUndefined() && !info[3].IsNull()
          ? std::optional<mx::array>(NapiToArray(info[3]))
          : std::nullopt;
  std::optional<mx::array> mask_lhs =
      info.Length() > 4 && !info[4].IsUndefined() && !info[4].IsNull()
          ? std::optional<mx::array>(NapiToArray(info[4]))
          : std::nullopt;
  std::optional<mx::array> mask_rhs =
      info.Length() > 5 && !info[5].IsUndefined() && !info[5].IsNull()
          ? std::optional<mx::array>(NapiToArray(info[5]))
          : std::nullopt;
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::block_masked_mm(a, b, block_size, mask_out, mask_lhs, mask_rhs, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_gather_mm(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::array b = NapiToArray(info[1]);
  std::optional<mx::array> lhs_indices =
      info.Length() > 2 && !info[2].IsUndefined() && !info[2].IsNull()
          ? std::optional<mx::array>(NapiToArray(info[2]))
          : std::nullopt;
  std::optional<mx::array> rhs_indices =
      info.Length() > 3 && !info[3].IsUndefined() && !info[3].IsNull()
          ? std::optional<mx::array>(NapiToArray(info[3]))
          : std::nullopt;
  bool sorted_indices =
      info.Length() > 4 && !info[4].IsUndefined() ? info[4].As<Napi::Boolean>().Value() : false;
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::gather_mm(a, b, lhs_indices, rhs_indices, sorted_indices, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_diagonal(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  int offset =
      info.Length() > 1 && !info[1].IsUndefined() ? info[1].As<Napi::Number>().Int32Value() : 0;
  int axis1 =
      info.Length() > 2 && !info[2].IsUndefined() ? info[2].As<Napi::Number>().Int32Value() : 0;
  int axis2 =
      info.Length() > 3 && !info[3].IsUndefined() ? info[3].As<Napi::Number>().Int32Value() : 1;
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::diagonal(a, offset, axis1, axis2, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_diag(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  int k = info.Length() > 1 && !info[1].IsUndefined() ? info[1].As<Napi::Number>().Int32Value() : 0;
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::diag(a, k, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_trace(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::trace(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_atleast_1d(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::atleast_1d(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_atleast_2d(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::atleast_2d(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_atleast_3d(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::atleast_3d(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

// issubdtype: Not found in C++ headers
Napi::Value Wrap_bitwise_and(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::array b = NapiToArray(info[1]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::bitwise_and(a, b, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_bitwise_or(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::array b = NapiToArray(info[1]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::bitwise_or(a, b, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_bitwise_xor(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::array b = NapiToArray(info[1]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::bitwise_xor(a, b, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_left_shift(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::array b = NapiToArray(info[1]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::left_shift(a, b, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_right_shift(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::array b = NapiToArray(info[1]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::right_shift(a, b, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_bitwise_invert(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::bitwise_invert(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_view(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::Dtype dtype = NapiToDtype(info[1]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::view(a, dtype, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_hadamard_transform(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  std::optional<float> scale = info.Length() > 1 && !info[1].IsUndefined() && !info[1].IsNull()
                                   ? std::optional<float>(info[1].As<Napi::Number>().FloatValue())
                                   : std::nullopt;
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::hadamard_transform(a, scale, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

// einsum_path: Not found in C++ headers
// einsum: Not found in C++ headers
Napi::Value Wrap_roll(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  int shift = info[1].As<Napi::Number>().Int32Value();
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::roll(a, shift, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_real(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::real(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_imag(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::imag(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_slice(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::Shape start = NapiToShape(info[1]);
  mx::Shape stop = NapiToShape(info[2]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::slice(a, start, stop, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_slice_update(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array src = NapiToArray(info[0]);
  mx::array update = NapiToArray(info[1]);
  mx::Shape start = NapiToShape(info[2]);
  mx::Shape stop = NapiToShape(info[3]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::slice_update(src, update, start, stop, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_contiguous(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  bool allow_col_major =
      info.Length() > 1 && !info[1].IsUndefined() ? info[1].As<Napi::Boolean>().Value() : false;
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::contiguous(a, allow_col_major, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

// broadcast_shapes: Not found in C++ headers
Napi::Value Wrap_depends(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  std::vector<mx::array> inputs = NapiToVecArray(info[0]);
  std::vector<mx::array> dependencies = NapiToVecArray(info[1]);
  try {
    std::vector<mx::array> result = mx::depends(inputs, dependencies);
    return VecArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_qqmm(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array x = NapiToArray(info[0]);
  mx::array w = NapiToArray(info[1]);
  std::optional<mx::array> w_scales =
      info.Length() > 2 && !info[2].IsUndefined() && !info[2].IsNull()
          ? std::optional<mx::array>(NapiToArray(info[2]))
          : std::nullopt;
  std::optional<int> group_size = info.Length() > 3 && !info[3].IsUndefined() && !info[3].IsNull()
                                      ? std::optional<int>(info[3].As<Napi::Number>().Int32Value())
                                      : std::nullopt;
  std::optional<int> bits = info.Length() > 4 && !info[4].IsUndefined() && !info[4].IsNull()
                                ? std::optional<int>(info[4].As<Napi::Number>().Int32Value())
                                : std::nullopt;
  std::string mode = info.Length() > 5 && !info[5].IsUndefined()
                         ? info[5].As<Napi::String>().Utf8Value()
                         : "nvfp4";
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::qqmm(x, w, w_scales, group_size, bits, mode, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_norm(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  std::optional<std::vector<int>> axis =
      info.Length() > 1 && !info[1].IsUndefined() && !info[1].IsNull()
          ? std::optional<std::vector<int>>(NapiToVecInt(info[1]))
          : std::nullopt;
  bool keepdims =
      info.Length() > 2 && !info[2].IsUndefined() ? info[2].As<Napi::Boolean>().Value() : false;
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::linalg::norm(a, axis, keepdims, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

// qr: Not found in C++ headers
Napi::Value Wrap_svd(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    std::vector<mx::array> result = mx::linalg::svd(a, s);
    return VecArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_inv(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::linalg::inv(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_tri_inv(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  bool upper =
      info.Length() > 1 && !info[1].IsUndefined() ? info[1].As<Napi::Boolean>().Value() : false;
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::linalg::tri_inv(a, upper, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_cholesky(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  bool upper =
      info.Length() > 1 && !info[1].IsUndefined() ? info[1].As<Napi::Boolean>().Value() : false;
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::linalg::cholesky(a, upper, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_cholesky_inv(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  bool upper =
      info.Length() > 1 && !info[1].IsUndefined() ? info[1].As<Napi::Boolean>().Value() : false;
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::linalg::cholesky_inv(a, upper, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_pinv(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::linalg::pinv(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_cross(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::array b = NapiToArray(info[1]);
  int axis =
      info.Length() > 2 && !info[2].IsUndefined() ? info[2].As<Napi::Number>().Int32Value() : -1;
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::linalg::cross(a, b, axis, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_eigvals(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::linalg::eigvals(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

// eig: Not found in C++ headers
Napi::Value Wrap_eigvalsh(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  std::string UPLO =
      info.Length() > 1 && !info[1].IsUndefined() ? info[1].As<Napi::String>().Utf8Value() : "L";
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::linalg::eigvalsh(a, UPLO, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

// eigh: Not found in C++ headers
Napi::Value Wrap_lu(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    std::vector<mx::array> result = mx::linalg::lu(a, s);
    return VecArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

// lu_factor: Not found in C++ headers
Napi::Value Wrap_solve(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::array b = NapiToArray(info[1]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::linalg::solve(a, b, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_solve_triangular(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::array b = NapiToArray(info[1]);
  bool upper =
      info.Length() > 2 && !info[2].IsUndefined() ? info[2].As<Napi::Boolean>().Value() : false;
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::linalg::solve_triangular(a, b, upper, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_fft(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  int axis =
      info.Length() > 1 && !info[1].IsUndefined() ? info[1].As<Napi::Number>().Int32Value() : -1;
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::fft::fft(a, axis, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_ifft(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  int axis =
      info.Length() > 1 && !info[1].IsUndefined() ? info[1].As<Napi::Number>().Int32Value() : -1;
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::fft::ifft(a, axis, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_fft2(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  std::vector<int> axes = info.Length() > 1 && !info[1].IsUndefined() ? NapiToVecInt(info[1])
                                                                      : std::vector<int>{-2, -1};
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::fft::fft2(a, axes, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_ifft2(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  std::vector<int> axes = info.Length() > 1 && !info[1].IsUndefined() ? NapiToVecInt(info[1])
                                                                      : std::vector<int>{-2, -1};
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::fft::ifft2(a, axes, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_fftn(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::fft::fftn(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_ifftn(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::fft::ifftn(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_rfft(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  int axis =
      info.Length() > 1 && !info[1].IsUndefined() ? info[1].As<Napi::Number>().Int32Value() : -1;
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::fft::rfft(a, axis, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_irfft(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  int axis =
      info.Length() > 1 && !info[1].IsUndefined() ? info[1].As<Napi::Number>().Int32Value() : -1;
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::fft::irfft(a, axis, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_rfft2(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  std::vector<int> axes = info.Length() > 1 && !info[1].IsUndefined() ? NapiToVecInt(info[1])
                                                                      : std::vector<int>{-2, -1};
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::fft::rfft2(a, axes, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_irfft2(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  std::vector<int> axes = info.Length() > 1 && !info[1].IsUndefined() ? NapiToVecInt(info[1])
                                                                      : std::vector<int>{-2, -1};
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::fft::irfft2(a, axes, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_rfftn(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::fft::rfftn(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_irfftn(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::fft::irfftn(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_fftshift(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::fft::fftshift(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_ifftshift(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array a = NapiToArray(info[0]);
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::fft::ifftshift(a, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_seed(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  uint64_t seed = static_cast<uint64_t>(info[0].As<Napi::Number>().Int64Value());
  try {
    mx::random::seed(seed);
    return env.Undefined();
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_key(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  uint64_t seed = static_cast<uint64_t>(info[0].As<Napi::Number>().Int64Value());
  try {
    mx::array result = mx::random::key(seed);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_uniform(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::Shape shape = NapiToShape(info[0]);
  std::optional<mx::array> key = info.Length() > 1 && !info[1].IsUndefined() && !info[1].IsNull()
                                     ? std::optional<mx::array>(NapiToArray(info[1]))
                                     : std::nullopt;
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::random::uniform(shape, key, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_normal(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::Shape shape = NapiToShape(info[0]);
  std::optional<mx::array> key = info.Length() > 1 && !info[1].IsUndefined() && !info[1].IsNull()
                                     ? std::optional<mx::array>(NapiToArray(info[1]))
                                     : std::nullopt;
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::random::normal(shape, key, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_multivariate_normal(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array mean = NapiToArray(info[0]);
  mx::array cov = NapiToArray(info[1]);
  mx::Shape shape = NapiToShape(info[2]);
  mx::Dtype dtype = NapiToDtype(info[3]);
  std::optional<mx::array> key = info.Length() > 4 && !info[4].IsUndefined() && !info[4].IsNull()
                                     ? std::optional<mx::array>(NapiToArray(info[4]))
                                     : std::nullopt;
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::random::multivariate_normal(mean, cov, shape, dtype, key, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_randint(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array low = NapiToArray(info[0]);
  mx::array high = NapiToArray(info[1]);
  mx::Shape shape = NapiToShape(info[2]);
  mx::Dtype dtype = info.Length() > 3 && !info[3].IsUndefined() ? NapiToDtype(info[3]) : mx::int32;
  std::optional<mx::array> key = info.Length() > 4 && !info[4].IsUndefined() && !info[4].IsNull()
                                     ? std::optional<mx::array>(NapiToArray(info[4]))
                                     : std::nullopt;
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::random::randint(low, high, shape, dtype, key, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_bernoulli(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  std::optional<mx::array> key = info.Length() > 0 && !info[0].IsUndefined() && !info[0].IsNull()
                                     ? std::optional<mx::array>(NapiToArray(info[0]))
                                     : std::nullopt;
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::random::bernoulli(key, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_truncated_normal(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array lower = NapiToArray(info[0]);
  mx::array upper = NapiToArray(info[1]);
  mx::Dtype dtype =
      info.Length() > 2 && !info[2].IsUndefined() ? NapiToDtype(info[2]) : mx::float32;
  std::optional<mx::array> key = info.Length() > 3 && !info[3].IsUndefined() && !info[3].IsNull()
                                     ? std::optional<mx::array>(NapiToArray(info[3]))
                                     : std::nullopt;
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::random::truncated_normal(lower, upper, dtype, key, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_gumbel(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::Shape shape = NapiToShape(info[0]);
  mx::Dtype dtype =
      info.Length() > 1 && !info[1].IsUndefined() ? NapiToDtype(info[1]) : mx::float32;
  std::optional<mx::array> key = info.Length() > 2 && !info[2].IsUndefined() && !info[2].IsNull()
                                     ? std::optional<mx::array>(NapiToArray(info[2]))
                                     : std::nullopt;
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::random::gumbel(shape, dtype, key, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_categorical(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array logits = NapiToArray(info[0]);
  int axis =
      info.Length() > 1 && !info[1].IsUndefined() ? info[1].As<Napi::Number>().Int32Value() : -1;
  std::optional<mx::array> key = info.Length() > 2 && !info[2].IsUndefined() && !info[2].IsNull()
                                     ? std::optional<mx::array>(NapiToArray(info[2]))
                                     : std::nullopt;
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::random::categorical(logits, axis, key, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_laplace(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::Shape shape = NapiToShape(info[0]);
  std::optional<mx::array> key = info.Length() > 1 && !info[1].IsUndefined() && !info[1].IsNull()
                                     ? std::optional<mx::array>(NapiToArray(info[1]))
                                     : std::nullopt;
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::random::laplace(shape, key, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_permutation(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array x = NapiToArray(info[0]);
  int axis =
      info.Length() > 1 && !info[1].IsUndefined() ? info[1].As<Napi::Number>().Int32Value() : 0;
  std::optional<mx::array> key = info.Length() > 2 && !info[2].IsUndefined() && !info[2].IsNull()
                                     ? std::optional<mx::array>(NapiToArray(info[2]))
                                     : std::nullopt;
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::random::permutation(x, axis, key, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_rms_norm(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array x = NapiToArray(info[0]);
  std::optional<mx::array> weight = info.Length() > 1 && !info[1].IsUndefined() && !info[1].IsNull()
                                        ? std::optional<mx::array>(NapiToArray(info[1]))
                                        : std::nullopt;
  double eps = info[2].As<Napi::Number>().DoubleValue();
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::fast::rms_norm(x, weight, eps, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_layer_norm(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array x = NapiToArray(info[0]);
  std::optional<mx::array> weight = info.Length() > 1 && !info[1].IsUndefined() && !info[1].IsNull()
                                        ? std::optional<mx::array>(NapiToArray(info[1]))
                                        : std::nullopt;
  std::optional<mx::array> bias = info.Length() > 2 && !info[2].IsUndefined() && !info[2].IsNull()
                                      ? std::optional<mx::array>(NapiToArray(info[2]))
                                      : std::nullopt;
  double eps = info[3].As<Napi::Number>().DoubleValue();
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::fast::layer_norm(x, weight, bias, eps, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_rope(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array x = NapiToArray(info[0]);
  int dims = info[1].As<Napi::Number>().Int32Value();
  bool traditional = info[2].As<Napi::Boolean>().Value();
  std::optional<float> base = info.Length() > 3 && !info[3].IsUndefined() && !info[3].IsNull()
                                  ? std::optional<float>(info[3].As<Napi::Number>().FloatValue())
                                  : std::nullopt;
  double scale = info[4].As<Napi::Number>().DoubleValue();
  int offset = info[5].As<Napi::Number>().Int32Value();
  std::optional<mx::array> freqs = info.Length() > 6 && !info[6].IsUndefined() && !info[6].IsNull()
                                       ? std::optional<mx::array>(NapiToArray(info[6]))
                                       : std::nullopt;
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::fast::rope(x, dims, traditional, base, scale, offset, freqs, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

Napi::Value Wrap_scaled_dot_product_attention(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  mx::array queries = NapiToArray(info[0]);
  mx::array keys = NapiToArray(info[1]);
  mx::array values = NapiToArray(info[2]);
  double scale = info[3].As<Napi::Number>().DoubleValue();
  std::string mask_mode =
      info.Length() > 4 && !info[4].IsUndefined() ? info[4].As<Napi::String>().Utf8Value() : "";
  std::optional<mx::array> mask_arr =
      info.Length() > 5 && !info[5].IsUndefined() && !info[5].IsNull()
          ? std::optional<mx::array>(NapiToArray(info[5]))
          : std::nullopt;
  std::optional<mx::array> sinks = info.Length() > 6 && !info[6].IsUndefined() && !info[6].IsNull()
                                       ? std::optional<mx::array>(NapiToArray(info[6]))
                                       : std::nullopt;
  mx::StreamOrDevice s = {};
  try {
    mx::array result = mx::fast::scaled_dot_product_attention(queries, keys, values, scale,
                                                              mask_mode, mask_arr, sinks, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

// metal_kernel: Skipped (unsupported parameter types)
// cuda_kernel: Skipped (unsupported parameter types)
// precompiled_cuda_kernel: Skipped (unsupported parameter types)

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
  exports.Set("reshape", Napi::Function::New(env, Wrap_reshape));
  exports.Set("flatten", Napi::Function::New(env, Wrap_flatten));
  exports.Set("unflatten", Napi::Function::New(env, Wrap_unflatten));
  exports.Set("squeeze", Napi::Function::New(env, Wrap_squeeze));
  exports.Set("expand_dims", Napi::Function::New(env, Wrap_expand_dims));
  exports.Set("abs", Napi::Function::New(env, Wrap_abs));
  exports.Set("sign", Napi::Function::New(env, Wrap_sign));
  exports.Set("negative", Napi::Function::New(env, Wrap_negative));
  exports.Set("add", Napi::Function::New(env, Wrap_add));
  exports.Set("subtract", Napi::Function::New(env, Wrap_subtract));
  exports.Set("multiply", Napi::Function::New(env, Wrap_multiply));
  exports.Set("divide", Napi::Function::New(env, Wrap_divide));
  exports.Set("divmod", Napi::Function::New(env, Wrap_divmod));
  exports.Set("floor_divide", Napi::Function::New(env, Wrap_floor_divide));
  exports.Set("remainder", Napi::Function::New(env, Wrap_remainder));
  exports.Set("equal", Napi::Function::New(env, Wrap_equal));
  exports.Set("not_equal", Napi::Function::New(env, Wrap_not_equal));
  exports.Set("less", Napi::Function::New(env, Wrap_less));
  exports.Set("less_equal", Napi::Function::New(env, Wrap_less_equal));
  exports.Set("greater", Napi::Function::New(env, Wrap_greater));
  exports.Set("greater_equal", Napi::Function::New(env, Wrap_greater_equal));
  exports.Set("array_equal", Napi::Function::New(env, Wrap_array_equal));
  exports.Set("matmul", Napi::Function::New(env, Wrap_matmul));
  exports.Set("square", Napi::Function::New(env, Wrap_square));
  exports.Set("sqrt", Napi::Function::New(env, Wrap_sqrt));
  exports.Set("rsqrt", Napi::Function::New(env, Wrap_rsqrt));
  exports.Set("reciprocal", Napi::Function::New(env, Wrap_reciprocal));
  exports.Set("logical_not", Napi::Function::New(env, Wrap_logical_not));
  exports.Set("logical_and", Napi::Function::New(env, Wrap_logical_and));
  exports.Set("logical_or", Napi::Function::New(env, Wrap_logical_or));
  exports.Set("logaddexp", Napi::Function::New(env, Wrap_logaddexp));
  exports.Set("exp", Napi::Function::New(env, Wrap_exp));
  exports.Set("expm1", Napi::Function::New(env, Wrap_expm1));
  exports.Set("erf", Napi::Function::New(env, Wrap_erf));
  exports.Set("erfinv", Napi::Function::New(env, Wrap_erfinv));
  exports.Set("sin", Napi::Function::New(env, Wrap_sin));
  exports.Set("cos", Napi::Function::New(env, Wrap_cos));
  exports.Set("tan", Napi::Function::New(env, Wrap_tan));
  exports.Set("arcsin", Napi::Function::New(env, Wrap_arcsin));
  exports.Set("arccos", Napi::Function::New(env, Wrap_arccos));
  exports.Set("arctan", Napi::Function::New(env, Wrap_arctan));
  exports.Set("arctan2", Napi::Function::New(env, Wrap_arctan2));
  exports.Set("sinh", Napi::Function::New(env, Wrap_sinh));
  exports.Set("cosh", Napi::Function::New(env, Wrap_cosh));
  exports.Set("tanh", Napi::Function::New(env, Wrap_tanh));
  exports.Set("arcsinh", Napi::Function::New(env, Wrap_arcsinh));
  exports.Set("arccosh", Napi::Function::New(env, Wrap_arccosh));
  exports.Set("arctanh", Napi::Function::New(env, Wrap_arctanh));
  exports.Set("degrees", Napi::Function::New(env, Wrap_degrees));
  exports.Set("radians", Napi::Function::New(env, Wrap_radians));
  exports.Set("log", Napi::Function::New(env, Wrap_log));
  exports.Set("log2", Napi::Function::New(env, Wrap_log2));
  exports.Set("log10", Napi::Function::New(env, Wrap_log10));
  exports.Set("log1p", Napi::Function::New(env, Wrap_log1p));
  exports.Set("stop_gradient", Napi::Function::New(env, Wrap_stop_gradient));
  exports.Set("sigmoid", Napi::Function::New(env, Wrap_sigmoid));
  exports.Set("power", Napi::Function::New(env, Wrap_power));
  exports.Set("arange", Napi::Function::New(env, Wrap_arange));
  exports.Set("linspace", Napi::Function::New(env, Wrap_linspace));
  exports.Set("kron", Napi::Function::New(env, Wrap_kron));
  exports.Set("take", Napi::Function::New(env, Wrap_take));
  exports.Set("take_along_axis", Napi::Function::New(env, Wrap_take_along_axis));
  exports.Set("put_along_axis", Napi::Function::New(env, Wrap_put_along_axis));
  exports.Set("full", Napi::Function::New(env, Wrap_full));
  exports.Set("zeros", Napi::Function::New(env, Wrap_zeros));
  exports.Set("zeros_like", Napi::Function::New(env, Wrap_zeros_like));
  exports.Set("ones", Napi::Function::New(env, Wrap_ones));
  exports.Set("ones_like", Napi::Function::New(env, Wrap_ones_like));
  exports.Set("eye", Napi::Function::New(env, Wrap_eye));
  exports.Set("identity", Napi::Function::New(env, Wrap_identity));
  exports.Set("tri", Napi::Function::New(env, Wrap_tri));
  exports.Set("tril", Napi::Function::New(env, Wrap_tril));
  exports.Set("triu", Napi::Function::New(env, Wrap_triu));
  exports.Set("allclose", Napi::Function::New(env, Wrap_allclose));
  exports.Set("isclose", Napi::Function::New(env, Wrap_isclose));
  exports.Set("all", Napi::Function::New(env, Wrap_all));
  exports.Set("any", Napi::Function::New(env, Wrap_any));
  exports.Set("minimum", Napi::Function::New(env, Wrap_minimum));
  exports.Set("maximum", Napi::Function::New(env, Wrap_maximum));
  exports.Set("floor", Napi::Function::New(env, Wrap_floor));
  exports.Set("ceil", Napi::Function::New(env, Wrap_ceil));
  exports.Set("isnan", Napi::Function::New(env, Wrap_isnan));
  exports.Set("isinf", Napi::Function::New(env, Wrap_isinf));
  exports.Set("isfinite", Napi::Function::New(env, Wrap_isfinite));
  exports.Set("isposinf", Napi::Function::New(env, Wrap_isposinf));
  exports.Set("isneginf", Napi::Function::New(env, Wrap_isneginf));
  exports.Set("moveaxis", Napi::Function::New(env, Wrap_moveaxis));
  exports.Set("swapaxes", Napi::Function::New(env, Wrap_swapaxes));
  exports.Set("transpose", Napi::Function::New(env, Wrap_transpose));
  exports.Set("sum", Napi::Function::New(env, Wrap_sum));
  exports.Set("prod", Napi::Function::New(env, Wrap_prod));
  exports.Set("min", Napi::Function::New(env, Wrap_min));
  exports.Set("max", Napi::Function::New(env, Wrap_max));
  exports.Set("logcumsumexp", Napi::Function::New(env, Wrap_logcumsumexp));
  exports.Set("logsumexp", Napi::Function::New(env, Wrap_logsumexp));
  exports.Set("mean", Napi::Function::New(env, Wrap_mean));
  exports.Set("median", Napi::Function::New(env, Wrap_median));
  exports.Set("var", Napi::Function::New(env, Wrap_var));
  exports.Set("std", Napi::Function::New(env, Wrap_std));
  exports.Set("split", Napi::Function::New(env, Wrap_split));
  exports.Set("argmin", Napi::Function::New(env, Wrap_argmin));
  exports.Set("argmax", Napi::Function::New(env, Wrap_argmax));
  exports.Set("sort", Napi::Function::New(env, Wrap_sort));
  exports.Set("argsort", Napi::Function::New(env, Wrap_argsort));
  exports.Set("partition", Napi::Function::New(env, Wrap_partition));
  exports.Set("argpartition", Napi::Function::New(env, Wrap_argpartition));
  exports.Set("topk", Napi::Function::New(env, Wrap_topk));
  exports.Set("broadcast_to", Napi::Function::New(env, Wrap_broadcast_to));
  exports.Set("broadcast_arrays", Napi::Function::New(env, Wrap_broadcast_arrays));
  exports.Set("softmax", Napi::Function::New(env, Wrap_softmax));
  exports.Set("concatenate", Napi::Function::New(env, Wrap_concatenate));
  exports.Set("stack", Napi::Function::New(env, Wrap_stack));
  exports.Set("meshgrid", Napi::Function::New(env, Wrap_meshgrid));
  exports.Set("repeat", Napi::Function::New(env, Wrap_repeat));
  exports.Set("clip", Napi::Function::New(env, Wrap_clip));
  exports.Set("as_strided", Napi::Function::New(env, Wrap_as_strided));
  exports.Set("cumsum", Napi::Function::New(env, Wrap_cumsum));
  exports.Set("cumprod", Napi::Function::New(env, Wrap_cumprod));
  exports.Set("cummax", Napi::Function::New(env, Wrap_cummax));
  exports.Set("cummin", Napi::Function::New(env, Wrap_cummin));
  exports.Set("conjugate", Napi::Function::New(env, Wrap_conjugate));
  exports.Set("conv1d", Napi::Function::New(env, Wrap_conv1d));
  exports.Set("conv2d", Napi::Function::New(env, Wrap_conv2d));
  exports.Set("conv3d", Napi::Function::New(env, Wrap_conv3d));
  exports.Set("conv_transpose1d", Napi::Function::New(env, Wrap_conv_transpose1d));
  exports.Set("conv_transpose2d", Napi::Function::New(env, Wrap_conv_transpose2d));
  exports.Set("conv_transpose3d", Napi::Function::New(env, Wrap_conv_transpose3d));
  exports.Set("conv_general", Napi::Function::New(env, Wrap_conv_general));
  exports.Set("where", Napi::Function::New(env, Wrap_where));
  exports.Set("nan_to_num", Napi::Function::New(env, Wrap_nan_to_num));
  exports.Set("round", Napi::Function::New(env, Wrap_round));
  exports.Set("quantized_matmul", Napi::Function::New(env, Wrap_quantized_matmul));
  exports.Set("quantize", Napi::Function::New(env, Wrap_quantize));
  exports.Set("dequantize", Napi::Function::New(env, Wrap_dequantize));
  exports.Set("gather_qmm", Napi::Function::New(env, Wrap_gather_qmm));
  exports.Set("segmented_mm", Napi::Function::New(env, Wrap_segmented_mm));
  exports.Set("tensordot", Napi::Function::New(env, Wrap_tensordot));
  exports.Set("inner", Napi::Function::New(env, Wrap_inner));
  exports.Set("outer", Napi::Function::New(env, Wrap_outer));
  exports.Set("tile", Napi::Function::New(env, Wrap_tile));
  exports.Set("addmm", Napi::Function::New(env, Wrap_addmm));
  exports.Set("block_masked_mm", Napi::Function::New(env, Wrap_block_masked_mm));
  exports.Set("gather_mm", Napi::Function::New(env, Wrap_gather_mm));
  exports.Set("diagonal", Napi::Function::New(env, Wrap_diagonal));
  exports.Set("diag", Napi::Function::New(env, Wrap_diag));
  exports.Set("trace", Napi::Function::New(env, Wrap_trace));
  exports.Set("atleast_1d", Napi::Function::New(env, Wrap_atleast_1d));
  exports.Set("atleast_2d", Napi::Function::New(env, Wrap_atleast_2d));
  exports.Set("atleast_3d", Napi::Function::New(env, Wrap_atleast_3d));
  exports.Set("bitwise_and", Napi::Function::New(env, Wrap_bitwise_and));
  exports.Set("bitwise_or", Napi::Function::New(env, Wrap_bitwise_or));
  exports.Set("bitwise_xor", Napi::Function::New(env, Wrap_bitwise_xor));
  exports.Set("left_shift", Napi::Function::New(env, Wrap_left_shift));
  exports.Set("right_shift", Napi::Function::New(env, Wrap_right_shift));
  exports.Set("bitwise_invert", Napi::Function::New(env, Wrap_bitwise_invert));
  exports.Set("view", Napi::Function::New(env, Wrap_view));
  exports.Set("hadamard_transform", Napi::Function::New(env, Wrap_hadamard_transform));
  exports.Set("roll", Napi::Function::New(env, Wrap_roll));
  exports.Set("real", Napi::Function::New(env, Wrap_real));
  exports.Set("imag", Napi::Function::New(env, Wrap_imag));
  exports.Set("slice", Napi::Function::New(env, Wrap_slice));
  exports.Set("slice_update", Napi::Function::New(env, Wrap_slice_update));
  exports.Set("contiguous", Napi::Function::New(env, Wrap_contiguous));
  exports.Set("depends", Napi::Function::New(env, Wrap_depends));
  exports.Set("qqmm", Napi::Function::New(env, Wrap_qqmm));
  exports.Set("norm", Napi::Function::New(env, Wrap_norm));
  exports.Set("svd", Napi::Function::New(env, Wrap_svd));
  exports.Set("inv", Napi::Function::New(env, Wrap_inv));
  exports.Set("tri_inv", Napi::Function::New(env, Wrap_tri_inv));
  exports.Set("cholesky", Napi::Function::New(env, Wrap_cholesky));
  exports.Set("cholesky_inv", Napi::Function::New(env, Wrap_cholesky_inv));
  exports.Set("pinv", Napi::Function::New(env, Wrap_pinv));
  exports.Set("cross", Napi::Function::New(env, Wrap_cross));
  exports.Set("eigvals", Napi::Function::New(env, Wrap_eigvals));
  exports.Set("eigvalsh", Napi::Function::New(env, Wrap_eigvalsh));
  exports.Set("lu", Napi::Function::New(env, Wrap_lu));
  exports.Set("solve", Napi::Function::New(env, Wrap_solve));
  exports.Set("solve_triangular", Napi::Function::New(env, Wrap_solve_triangular));
  exports.Set("fft", Napi::Function::New(env, Wrap_fft));
  exports.Set("ifft", Napi::Function::New(env, Wrap_ifft));
  exports.Set("fft2", Napi::Function::New(env, Wrap_fft2));
  exports.Set("ifft2", Napi::Function::New(env, Wrap_ifft2));
  exports.Set("fftn", Napi::Function::New(env, Wrap_fftn));
  exports.Set("ifftn", Napi::Function::New(env, Wrap_ifftn));
  exports.Set("rfft", Napi::Function::New(env, Wrap_rfft));
  exports.Set("irfft", Napi::Function::New(env, Wrap_irfft));
  exports.Set("rfft2", Napi::Function::New(env, Wrap_rfft2));
  exports.Set("irfft2", Napi::Function::New(env, Wrap_irfft2));
  exports.Set("rfftn", Napi::Function::New(env, Wrap_rfftn));
  exports.Set("irfftn", Napi::Function::New(env, Wrap_irfftn));
  exports.Set("fftshift", Napi::Function::New(env, Wrap_fftshift));
  exports.Set("ifftshift", Napi::Function::New(env, Wrap_ifftshift));
  exports.Set("seed", Napi::Function::New(env, Wrap_seed));
  exports.Set("key", Napi::Function::New(env, Wrap_key));
  exports.Set("uniform", Napi::Function::New(env, Wrap_uniform));
  exports.Set("normal", Napi::Function::New(env, Wrap_normal));
  exports.Set("multivariate_normal", Napi::Function::New(env, Wrap_multivariate_normal));
  exports.Set("randint", Napi::Function::New(env, Wrap_randint));
  exports.Set("bernoulli", Napi::Function::New(env, Wrap_bernoulli));
  exports.Set("truncated_normal", Napi::Function::New(env, Wrap_truncated_normal));
  exports.Set("gumbel", Napi::Function::New(env, Wrap_gumbel));
  exports.Set("categorical", Napi::Function::New(env, Wrap_categorical));
  exports.Set("laplace", Napi::Function::New(env, Wrap_laplace));
  exports.Set("permutation", Napi::Function::New(env, Wrap_permutation));
  exports.Set("rms_norm", Napi::Function::New(env, Wrap_rms_norm));
  exports.Set("layer_norm", Napi::Function::New(env, Wrap_layer_norm));
  exports.Set("rope", Napi::Function::New(env, Wrap_rope));
  exports.Set("scaled_dot_product_attention",
              Napi::Function::New(env, Wrap_scaled_dot_product_attention));

  return exports;
}

NODE_API_MODULE(mlx_node, Init)
