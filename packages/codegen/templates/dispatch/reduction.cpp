mx::array a = NapiToArray(info[0]);
bool keepdims = false;
mx::StreamOrDevice s = {};
if (info.Length() == 1 || info[1].IsUndefined()) {
  return ArrayToNapi(env, mx::@@NAME@@(a, keepdims, s));
}
if (info[1].IsNumber()) {
  int axis = info[1].As<Napi::Number>().Int32Value();
  if (info.Length() > 2 && info[2].IsBoolean()) {
    keepdims = info[2].As<Napi::Boolean>().Value();
  }
  return ArrayToNapi(env, mx::@@NAME@@(a, axis, keepdims, s));
}
if (info[1].IsArray()) {
  std::vector<int> axes = NapiToVecInt(info[1]);
  if (info.Length() > 2 && info[2].IsBoolean()) {
    keepdims = info[2].As<Napi::Boolean>().Value();
  }
  return ArrayToNapi(env, mx::@@NAME@@(a, axes, keepdims, s));
}
return ArrayToNapi(env, mx::@@NAME@@(a, keepdims, s));
