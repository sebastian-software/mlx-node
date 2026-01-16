/**
 * I/O Functions for MLX Node.js bindings
 *
 * Reference implementation:
 * https://github.com/ml-explore/mlx/blob/main/mlx/io.h
 * https://github.com/ml-explore/mlx/blob/main/python/src/load.cpp
 */

// Helper: Convert JS object {key: MLXArray} to std::unordered_map<string, array>
std::unordered_map<std::string, mx::array> NapiToArrayMap(const Napi::Value& value) {
  std::unordered_map<std::string, mx::array> result;
  if (value.IsObject() && !value.IsArray()) {
    Napi::Object obj = value.As<Napi::Object>();
    Napi::Array keys = obj.GetPropertyNames();
    for (uint32_t i = 0; i < keys.Length(); i++) {
      std::string key = keys.Get(i).As<Napi::String>().Utf8Value();
      result[key] = NapiToArray(obj.Get(key));
    }
  }
  return result;
}

// Helper: Convert JS object {key: string} to std::unordered_map<string, string>
std::unordered_map<std::string, std::string> NapiToStringMap(const Napi::Value& value) {
  std::unordered_map<std::string, std::string> result;
  if (value.IsObject() && !value.IsArray()) {
    Napi::Object obj = value.As<Napi::Object>();
    Napi::Array keys = obj.GetPropertyNames();
    for (uint32_t i = 0; i < keys.Length(); i++) {
      std::string key = keys.Get(i).As<Napi::String>().Utf8Value();
      Napi::Value val = obj.Get(key);
      if (val.IsString()) {
        result[key] = val.As<Napi::String>().Utf8Value();
      }
    }
  }
  return result;
}

// Helper: Convert std::unordered_map<string, array> to JS object
Napi::Value ArrayMapToNapi(Napi::Env env, const std::unordered_map<std::string, mx::array>& map) {
  Napi::Object obj = Napi::Object::New(env);
  for (const auto& [key, arr] : map) {
    obj.Set(key, ArrayToNapi(env, arr));
  }
  return obj;
}

// Helper: Convert std::unordered_map<string, string> to JS object
Napi::Value StringMapToNapi(Napi::Env env, const std::unordered_map<std::string, std::string>& map) {
  Napi::Object obj = Napi::Object::New(env);
  for (const auto& [key, val] : map) {
    obj.Set(key, Napi::String::New(env, val));
  }
  return obj;
}

/**
 * Load array(s) from a binary file.
 *
 * Supports .npy format (single array).
 * For .safetensors, use load_safetensors instead.
 *
 * @param file - Path to the file
 * @returns MLXArray for .npy files
 */
Napi::Value Wrap_load(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  try {
    if (info.Length() < 1 || !info[0].IsString()) {
      throw Napi::TypeError::New(env, "load() requires a file path string");
    }
    std::string file = info[0].As<Napi::String>().Utf8Value();
    mx::StreamOrDevice s = {};

    mx::array result = mx::load(file, s);
    return ArrayToNapi(env, result);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

/**
 * Load arrays from a .safetensors file.
 *
 * Reference: https://github.com/ml-explore/mlx/blob/main/python/src/load.cpp
 *
 * @param file - Path to the .safetensors file
 * @param returnMetadata - If true, returns { arrays, metadata }, otherwise just arrays
 * @returns Object with array weights, optionally with metadata
 */
Napi::Value Wrap_load_safetensors(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  try {
    if (info.Length() < 1 || !info[0].IsString()) {
      throw Napi::TypeError::New(env, "load_safetensors() requires a file path string");
    }
    std::string file = info[0].As<Napi::String>().Utf8Value();
    bool returnMetadata = info.Length() > 1 && info[1].IsBoolean() && info[1].As<Napi::Boolean>().Value();
    mx::StreamOrDevice s = {};

    auto [arrays, metadata] = mx::load_safetensors(file, s);

    if (returnMetadata) {
      Napi::Object result = Napi::Object::New(env);
      result.Set("arrays", ArrayMapToNapi(env, arrays));
      result.Set("metadata", StringMapToNapi(env, metadata));
      return result;
    }

    return ArrayMapToNapi(env, arrays);
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

/**
 * Save arrays to a .safetensors file.
 *
 * Reference: https://github.com/ml-explore/mlx/blob/main/python/src/load.cpp
 *
 * @param file - Path to save the file
 * @param arrays - Object mapping names to MLXArrays
 * @param metadata - Optional object mapping names to string values
 */
Napi::Value Wrap_save_safetensors(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  try {
    if (info.Length() < 2) {
      throw Napi::TypeError::New(env, "save_safetensors() requires file path and arrays object");
    }
    if (!info[0].IsString()) {
      throw Napi::TypeError::New(env, "save_safetensors() first argument must be a file path string");
    }
    if (!info[1].IsObject()) {
      throw Napi::TypeError::New(env, "save_safetensors() second argument must be an object of arrays");
    }

    std::string file = info[0].As<Napi::String>().Utf8Value();
    auto arrays = NapiToArrayMap(info[1]);
    std::unordered_map<std::string, std::string> metadata;

    if (info.Length() > 2 && info[2].IsObject()) {
      metadata = NapiToStringMap(info[2]);
    }

    mx::save_safetensors(file, arrays, metadata);
    return env.Undefined();
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}

/**
 * Save a single array to a .npy file.
 *
 * @param file - Path to save the file
 * @param array - The array to save
 */
Napi::Value Wrap_save(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  try {
    if (info.Length() < 2) {
      throw Napi::TypeError::New(env, "save() requires file path and array");
    }
    if (!info[0].IsString()) {
      throw Napi::TypeError::New(env, "save() first argument must be a file path string");
    }

    std::string file = info[0].As<Napi::String>().Utf8Value();
    mx::array arr = NapiToArray(info[1]);

    mx::save(file, arr);
    return env.Undefined();
  } catch (const std::exception& e) {
    throw Napi::Error::New(env, e.what());
  }
}
