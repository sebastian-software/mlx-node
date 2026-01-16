/**
 * SentencePiece N-API Bindings for Node.js
 *
 * Reference: https://github.com/google/sentencepiece
 *
 * Provides tokenization for LLM inference:
 * - Load .model files (SentencePiece format)
 * - Encode text to token IDs
 * - Decode token IDs to text
 */

#include <napi.h>
#include <sentencepiece_processor.h>

#include <memory>
#include <string>
#include <vector>

// =============================================================================
// SentencePieceTokenizer Class
// =============================================================================

class SentencePieceTokenizer : public Napi::ObjectWrap<SentencePieceTokenizer> {
 public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports);
  SentencePieceTokenizer(const Napi::CallbackInfo& info);

 private:
  sentencepiece::SentencePieceProcessor processor_;

  // Model loading
  Napi::Value Load(const Napi::CallbackInfo& info);
  Napi::Value LoadFromBuffer(const Napi::CallbackInfo& info);

  // Encoding (text → ids)
  Napi::Value Encode(const Napi::CallbackInfo& info);
  Napi::Value EncodeAsIds(const Napi::CallbackInfo& info);
  Napi::Value EncodeAsPieces(const Napi::CallbackInfo& info);

  // Decoding (ids → text)
  Napi::Value Decode(const Napi::CallbackInfo& info);
  Napi::Value DecodeIds(const Napi::CallbackInfo& info);
  Napi::Value DecodePieces(const Napi::CallbackInfo& info);

  // Vocabulary access
  Napi::Value GetPieceSize(const Napi::CallbackInfo& info);
  Napi::Value PieceToId(const Napi::CallbackInfo& info);
  Napi::Value IdToPiece(const Napi::CallbackInfo& info);

  // Special tokens
  Napi::Value BosId(const Napi::CallbackInfo& info);
  Napi::Value EosId(const Napi::CallbackInfo& info);
  Napi::Value PadId(const Napi::CallbackInfo& info);
  Napi::Value UnkId(const Napi::CallbackInfo& info);
};

Napi::Object SentencePieceTokenizer::Init(Napi::Env env, Napi::Object exports) {
  Napi::Function func = DefineClass(
      env, "SentencePieceTokenizer",
      {
          // Model loading
          InstanceMethod("load", &SentencePieceTokenizer::Load),
          InstanceMethod("loadFromBuffer", &SentencePieceTokenizer::LoadFromBuffer),

          // Encoding
          InstanceMethod("encode", &SentencePieceTokenizer::Encode),
          InstanceMethod("encodeAsIds", &SentencePieceTokenizer::EncodeAsIds),
          InstanceMethod("encodeAsPieces", &SentencePieceTokenizer::EncodeAsPieces),

          // Decoding
          InstanceMethod("decode", &SentencePieceTokenizer::Decode),
          InstanceMethod("decodeIds", &SentencePieceTokenizer::DecodeIds),
          InstanceMethod("decodePieces", &SentencePieceTokenizer::DecodePieces),

          // Vocabulary
          InstanceMethod("getPieceSize", &SentencePieceTokenizer::GetPieceSize),
          InstanceMethod("pieceToId", &SentencePieceTokenizer::PieceToId),
          InstanceMethod("idToPiece", &SentencePieceTokenizer::IdToPiece),

          // Special tokens
          InstanceMethod("bosId", &SentencePieceTokenizer::BosId),
          InstanceMethod("eosId", &SentencePieceTokenizer::EosId),
          InstanceMethod("padId", &SentencePieceTokenizer::PadId),
          InstanceMethod("unkId", &SentencePieceTokenizer::UnkId),
      });

  exports.Set("SentencePieceTokenizer", func);
  return exports;
}

SentencePieceTokenizer::SentencePieceTokenizer(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<SentencePieceTokenizer>(info) {
  // Optionally load model from constructor
  if (info.Length() > 0 && info[0].IsString()) {
    std::string path = info[0].As<Napi::String>().Utf8Value();
    auto status = processor_.Load(path);
    if (!status.ok()) {
      throw Napi::Error::New(info.Env(), status.ToString());
    }
  }
}

// =============================================================================
// Model Loading
// =============================================================================

Napi::Value SentencePieceTokenizer::Load(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 1 || !info[0].IsString()) {
    throw Napi::TypeError::New(env, "load() requires a file path string");
  }

  std::string path = info[0].As<Napi::String>().Utf8Value();
  auto status = processor_.Load(path);

  if (!status.ok()) {
    throw Napi::Error::New(env, status.ToString());
  }

  return env.Undefined();
}

Napi::Value SentencePieceTokenizer::LoadFromBuffer(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 1 || !info[0].IsBuffer()) {
    throw Napi::TypeError::New(env, "loadFromBuffer() requires a Buffer");
  }

  Napi::Buffer<char> buffer = info[0].As<Napi::Buffer<char>>();
  absl::string_view data(buffer.Data(), buffer.Length());
  auto status = processor_.LoadFromSerializedProto(data);

  if (!status.ok()) {
    throw Napi::Error::New(env, status.ToString());
  }

  return env.Undefined();
}

// =============================================================================
// Encoding
// =============================================================================

Napi::Value SentencePieceTokenizer::Encode(const Napi::CallbackInfo& info) {
  // Alias for encodeAsIds (most common use case)
  return EncodeAsIds(info);
}

Napi::Value SentencePieceTokenizer::EncodeAsIds(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 1 || !info[0].IsString()) {
    throw Napi::TypeError::New(env, "encodeAsIds() requires a string");
  }

  std::string text = info[0].As<Napi::String>().Utf8Value();
  std::vector<int> ids;
  auto status = processor_.Encode(text, &ids);

  if (!status.ok()) {
    throw Napi::Error::New(env, status.ToString());
  }

  Napi::Array result = Napi::Array::New(env, ids.size());
  for (size_t i = 0; i < ids.size(); i++) {
    result.Set(i, Napi::Number::New(env, ids[i]));
  }

  return result;
}

Napi::Value SentencePieceTokenizer::EncodeAsPieces(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 1 || !info[0].IsString()) {
    throw Napi::TypeError::New(env, "encodeAsPieces() requires a string");
  }

  std::string text = info[0].As<Napi::String>().Utf8Value();
  std::vector<std::string> pieces;
  auto status = processor_.Encode(text, &pieces);

  if (!status.ok()) {
    throw Napi::Error::New(env, status.ToString());
  }

  Napi::Array result = Napi::Array::New(env, pieces.size());
  for (size_t i = 0; i < pieces.size(); i++) {
    result.Set(i, Napi::String::New(env, pieces[i]));
  }

  return result;
}

// =============================================================================
// Decoding
// =============================================================================

Napi::Value SentencePieceTokenizer::Decode(const Napi::CallbackInfo& info) {
  // Alias for decodeIds (most common use case)
  return DecodeIds(info);
}

Napi::Value SentencePieceTokenizer::DecodeIds(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 1 || !info[0].IsArray()) {
    throw Napi::TypeError::New(env, "decodeIds() requires an array of integers");
  }

  Napi::Array arr = info[0].As<Napi::Array>();
  std::vector<int> ids;
  ids.reserve(arr.Length());

  for (uint32_t i = 0; i < arr.Length(); i++) {
    ids.push_back(arr.Get(i).As<Napi::Number>().Int32Value());
  }

  std::string text;
  auto status = processor_.Decode(ids, &text);

  if (!status.ok()) {
    throw Napi::Error::New(env, status.ToString());
  }

  return Napi::String::New(env, text);
}

Napi::Value SentencePieceTokenizer::DecodePieces(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 1 || !info[0].IsArray()) {
    throw Napi::TypeError::New(env, "decodePieces() requires an array of strings");
  }

  Napi::Array arr = info[0].As<Napi::Array>();
  std::vector<std::string> pieces;
  pieces.reserve(arr.Length());

  for (uint32_t i = 0; i < arr.Length(); i++) {
    pieces.push_back(arr.Get(i).As<Napi::String>().Utf8Value());
  }

  std::string text;
  auto status = processor_.Decode(pieces, &text);

  if (!status.ok()) {
    throw Napi::Error::New(env, status.ToString());
  }

  return Napi::String::New(env, text);
}

// =============================================================================
// Vocabulary Access
// =============================================================================

Napi::Value SentencePieceTokenizer::GetPieceSize(const Napi::CallbackInfo& info) {
  return Napi::Number::New(info.Env(), processor_.GetPieceSize());
}

Napi::Value SentencePieceTokenizer::PieceToId(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 1 || !info[0].IsString()) {
    throw Napi::TypeError::New(env, "pieceToId() requires a string");
  }

  std::string piece = info[0].As<Napi::String>().Utf8Value();
  return Napi::Number::New(env, processor_.PieceToId(piece));
}

Napi::Value SentencePieceTokenizer::IdToPiece(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 1 || !info[0].IsNumber()) {
    throw Napi::TypeError::New(env, "idToPiece() requires an integer");
  }

  int id = info[0].As<Napi::Number>().Int32Value();
  return Napi::String::New(env, processor_.IdToPiece(id));
}

// =============================================================================
// Special Tokens
// =============================================================================

Napi::Value SentencePieceTokenizer::BosId(const Napi::CallbackInfo& info) {
  return Napi::Number::New(info.Env(), processor_.bos_id());
}

Napi::Value SentencePieceTokenizer::EosId(const Napi::CallbackInfo& info) {
  return Napi::Number::New(info.Env(), processor_.eos_id());
}

Napi::Value SentencePieceTokenizer::PadId(const Napi::CallbackInfo& info) {
  return Napi::Number::New(info.Env(), processor_.pad_id());
}

Napi::Value SentencePieceTokenizer::UnkId(const Napi::CallbackInfo& info) {
  return Napi::Number::New(info.Env(), processor_.unk_id());
}

// =============================================================================
// Module Initialization
// =============================================================================

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  SentencePieceTokenizer::Init(env, exports);
  return exports;
}

NODE_API_MODULE(mlx_tokenizer, Init)
