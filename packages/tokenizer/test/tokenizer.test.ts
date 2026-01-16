import { describe, test, expect, beforeAll } from 'bun:test';
import { readFileSync } from 'node:fs';
import { SentencePieceTokenizer } from '../dist/index.js';

// Use the test model that comes with SentencePiece
const TEST_MODEL_PATH = new URL(
  '../build/_deps/sentencepiece-src/python/test/test_model.model',
  import.meta.url
).pathname;

describe('SentencePieceTokenizer', () => {
  let tokenizer: SentencePieceTokenizer;

  beforeAll(() => {
    tokenizer = new SentencePieceTokenizer(TEST_MODEL_PATH);
  });

  describe('model loading', () => {
    test('load from path', () => {
      const t = new SentencePieceTokenizer();
      t.load(TEST_MODEL_PATH);
      expect(t.vocabSize).toBeGreaterThan(0);
    });

    test('load from buffer', () => {
      const buffer = readFileSync(TEST_MODEL_PATH);
      const t = new SentencePieceTokenizer();
      t.loadFromBuffer(buffer);
      expect(t.vocabSize).toBeGreaterThan(0);
    });

    test('load from constructor', () => {
      const t = new SentencePieceTokenizer(TEST_MODEL_PATH);
      expect(t.vocabSize).toBeGreaterThan(0);
    });
  });

  describe('vocabulary', () => {
    test('vocabSize returns vocabulary size', () => {
      expect(tokenizer.vocabSize).toBe(1000);
    });

    test('getPieceSize returns vocabulary size', () => {
      expect(tokenizer.getPieceSize()).toBe(1000);
    });

    test('pieceToId converts piece to ID', () => {
      const id = tokenizer.pieceToId('▁world');
      expect(id).toBeGreaterThan(0);
    });

    test('idToPiece converts ID to piece', () => {
      const piece = tokenizer.idToPiece(887);
      expect(piece).toBe('▁world');
    });

    test('pieceToId and idToPiece are inverses', () => {
      const id = tokenizer.pieceToId('▁world');
      const piece = tokenizer.idToPiece(id);
      expect(piece).toBe('▁world');
    });
  });

  describe('special tokens', () => {
    test('bosId returns BOS token ID', () => {
      expect(tokenizer.bosId).toBe(1);
    });

    test('eosId returns EOS token ID', () => {
      expect(tokenizer.eosId).toBe(2);
    });

    test('unkId returns UNK token ID', () => {
      expect(tokenizer.unkId).toBe(0);
    });
  });

  describe('encoding', () => {
    test('encode returns token IDs', () => {
      const ids = tokenizer.encode('Hello, world!');
      expect(Array.isArray(ids)).toBe(true);
      expect(ids.length).toBeGreaterThan(0);
      expect(ids.every(id => typeof id === 'number')).toBe(true);
    });

    test('encodeAsIds returns token IDs', () => {
      const ids = tokenizer.encodeAsIds('Hello, world!');
      expect(Array.isArray(ids)).toBe(true);
      expect(ids.length).toBeGreaterThan(0);
    });

    test('encode and encodeAsIds return same result', () => {
      const text = 'Hello, world!';
      const ids1 = tokenizer.encode(text);
      const ids2 = tokenizer.encodeAsIds(text);
      expect(ids1).toEqual(ids2);
    });

    test('encodeAsPieces returns string pieces', () => {
      const pieces = tokenizer.encodeAsPieces('Hello, world!');
      expect(Array.isArray(pieces)).toBe(true);
      expect(pieces.length).toBeGreaterThan(0);
      expect(pieces.every(p => typeof p === 'string')).toBe(true);
    });
  });

  describe('decoding', () => {
    test('decode returns text from IDs', () => {
      const ids = tokenizer.encode('Hello, world!');
      const text = tokenizer.decode(ids);
      expect(text).toBe('Hello, world!');
    });

    test('decodeIds returns text from IDs', () => {
      const ids = tokenizer.encode('Hello, world!');
      const text = tokenizer.decodeIds(ids);
      expect(text).toBe('Hello, world!');
    });

    test('decodePieces returns text from pieces', () => {
      const pieces = tokenizer.encodeAsPieces('Hello, world!');
      const text = tokenizer.decodePieces(pieces);
      expect(text).toBe('Hello, world!');
    });
  });

  describe('roundtrip', () => {
    test('encode/decode roundtrip preserves text', () => {
      const original = 'The quick brown fox jumps over the lazy dog.';
      const ids = tokenizer.encode(original);
      const decoded = tokenizer.decode(ids);
      expect(decoded).toBe(original);
    });

    test('handles empty string', () => {
      const ids = tokenizer.encode('');
      expect(ids).toEqual([]);
      const decoded = tokenizer.decode([]);
      expect(decoded).toBe('');
    });

    test('handles special characters', () => {
      // Test model has limited vocabulary - test with supported characters
      const original = 'Hello! How are you?';
      const ids = tokenizer.encode(original);
      const decoded = tokenizer.decode(ids);
      expect(decoded).toBe(original);
    });
  });
});
