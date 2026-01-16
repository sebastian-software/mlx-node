try {
  mx::array a = NapiToArray(info[0]);
  bool keepdims = false;
  int ddof = 0;
  mx::StreamOrDevice s = {};
  if (info.Length() == 1 || info[1].IsUndefined()) {
    return ArrayToNapi(env, mx::@@NAME@@(a, keepdims, ddof, s));
  }
  if (info[1].IsNumber()) {
    int axis = info[1].As<Napi::Number>().Int32Value();
    if (info.Length() > 2 && info[2].IsBoolean()) {
      keepdims = info[2].As<Napi::Boolean>().Value();
    }
    if (info.Length() > 3 && info[3].IsNumber()) {
      ddof = info[3].As<Napi::Number>().Int32Value();
    }
    return ArrayToNapi(env, mx::@@NAME@@(a, axis, keepdims, ddof, s));
  }
  if (info[1].IsArray()) {
    std::vector<int> axes = NapiToVecInt(info[1]);
    if (info.Length() > 2 && info[2].IsBoolean()) {
      keepdims = info[2].As<Napi::Boolean>().Value();
    }
    if (info.Length() > 3 && info[3].IsNumber()) {
      ddof = info[3].As<Napi::Number>().Int32Value();
    }
    return ArrayToNapi(env, mx::@@NAME@@(a, axes, keepdims, ddof, s));
  }
  return ArrayToNapi(env, mx::@@NAME@@(a, keepdims, ddof, s));
} catch (const std::exception& e) {
  throw Napi::Error::New(env, e.what());
}
