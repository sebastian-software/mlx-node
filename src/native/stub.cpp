/**
 * MLX Node.js Stub Implementation
 *
 * Provides a minimal implementation when MLX is not available.
 * Useful for testing the binding infrastructure.
 */

#include <napi.h>
#include <vector>
#include <string>

namespace mlx_node_stub {

class MLXArrayStub : public Napi::ObjectWrap<MLXArrayStub> {
 public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports) {
    Napi::Function func = DefineClass(env, "array", {
      InstanceAccessor("shape", &MLXArrayStub::GetShape, nullptr),
      InstanceAccessor("ndim", &MLXArrayStub::GetNdim, nullptr),
      InstanceAccessor("size", &MLXArrayStub::GetSize, nullptr),
      InstanceAccessor("dtype", &MLXArrayStub::GetDtype, nullptr),
      InstanceMethod("tolist", &MLXArrayStub::ToList),
      InstanceMethod("item", &MLXArrayStub::Item),
      InstanceMethod("reshape", &MLXArrayStub::Reshape),
    });

    Napi::FunctionReference* constructor = new Napi::FunctionReference();
    *constructor = Napi::Persistent(func);
    env.SetInstanceData(constructor);

    exports.Set("array", func);
    return exports;
  }

  MLXArrayStub(const Napi::CallbackInfo& info)
      : Napi::ObjectWrap<MLXArrayStub>(info) {
    Napi::Env env = info.Env();

    // Parse input data
    if (info.Length() > 0 && info[0].IsArray()) {
      Napi::Array arr = info[0].As<Napi::Array>();
      size_ = arr.Length();
      shape_.push_back(static_cast<int>(size_));
      data_.resize(size_);

      for (size_t i = 0; i < size_; i++) {
        Napi::Value elem = arr.Get(static_cast<uint32_t>(i));
        if (elem.IsNumber()) {
          data_[i] = elem.As<Napi::Number>().DoubleValue();
        }
      }
    } else if (info.Length() > 0 && info[0].IsNumber()) {
      size_ = 1;
      data_.push_back(info[0].As<Napi::Number>().DoubleValue());
    }

    // Parse dtype
    if (info.Length() > 1 && info[1].IsString()) {
      dtype_ = info[1].As<Napi::String>().Utf8Value();
    }
  }

 private:
  std::vector<double> data_;
  std::vector<int> shape_ = {0};
  size_t size_ = 0;
  std::string dtype_ = "float32";

  Napi::Value GetShape(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    Napi::Array result = Napi::Array::New(env, shape_.size());
    for (size_t i = 0; i < shape_.size(); i++) {
      result.Set(i, Napi::Number::New(env, shape_[i]));
    }
    return result;
  }

  Napi::Value GetNdim(const Napi::CallbackInfo& info) {
    return Napi::Number::New(info.Env(), static_cast<int>(shape_.size()));
  }

  Napi::Value GetSize(const Napi::CallbackInfo& info) {
    return Napi::Number::New(info.Env(), static_cast<int>(size_));
  }

  Napi::Value GetDtype(const Napi::CallbackInfo& info) {
    return Napi::String::New(info.Env(), dtype_);
  }

  Napi::Value ToList(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    Napi::Array result = Napi::Array::New(env, data_.size());
    for (size_t i = 0; i < data_.size(); i++) {
      result.Set(i, Napi::Number::New(env, data_[i]));
    }
    return result;
  }

  Napi::Value Item(const Napi::CallbackInfo& info) {
    if (data_.empty()) {
      return info.Env().Undefined();
    }
    return Napi::Number::New(info.Env(), data_[0]);
  }

  Napi::Value Reshape(const Napi::CallbackInfo& info) {
    // For stub, just return self
    return info.This();
  }
};

// Stub functions
Napi::Value StubAdd(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  // Stub: just return first argument
  if (info.Length() > 0) {
    return info[0];
  }
  return env.Undefined();
}

Napi::Value StubSubtract(const Napi::CallbackInfo& info) {
  return StubAdd(info);
}

Napi::Value StubMultiply(const Napi::CallbackInfo& info) {
  return StubAdd(info);
}

Napi::Value StubDivide(const Napi::CallbackInfo& info) {
  return StubAdd(info);
}

Napi::Value StubMatmul(const Napi::CallbackInfo& info) {
  return StubAdd(info);
}

Napi::Value StubZeros(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  // Create an array of zeros
  Napi::FunctionReference* constructor =
      env.GetInstanceData<Napi::FunctionReference>();
  return constructor->New({Napi::Array::New(env, 0)});
}

Napi::Value StubOnes(const Napi::CallbackInfo& info) {
  return StubZeros(info);
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  // Array class
  MLXArrayStub::Init(env, exports);

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

  // Stub functions
  exports.Set("add", Napi::Function::New(env, StubAdd));
  exports.Set("subtract", Napi::Function::New(env, StubSubtract));
  exports.Set("multiply", Napi::Function::New(env, StubMultiply));
  exports.Set("divide", Napi::Function::New(env, StubDivide));
  exports.Set("matmul", Napi::Function::New(env, StubMatmul));
  exports.Set("zeros", Napi::Function::New(env, StubZeros));
  exports.Set("ones", Napi::Function::New(env, StubOnes));

  // Version info
  exports.Set("__version__", Napi::String::New(env, "0.1.0-stub"));
  exports.Set("__mlx_available__", Napi::Boolean::New(env, false));

  return exports;
}

}  // namespace mlx_node_stub

Napi::Object InitModule(Napi::Env env, Napi::Object exports) {
  return mlx_node_stub::Init(env, exports);
}

NODE_API_MODULE(mlx_node, InitModule)
