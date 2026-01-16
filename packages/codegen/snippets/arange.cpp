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
