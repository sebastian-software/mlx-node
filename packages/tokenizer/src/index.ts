/**
 * SentencePiece Tokenizer Bindings for Node.js
 *
 * Reference: https://github.com/google/sentencepiece
 */

import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Load native addon
const binding = require(join(__dirname, '..', 'build', 'Release', 'mlx-tokenizer.node'));

/**
 * Native SentencePiece tokenizer interface
 */
interface NativeSentencePieceTokenizer {
  load(path: string): void;
  loadFromBuffer(buffer: Buffer): void;
  encode(text: string): number[];
  encodeAsIds(text: string): number[];
  encodeAsPieces(text: string): string[];
  decode(ids: number[]): string;
  decodeIds(ids: number[]): string;
  decodePieces(pieces: string[]): string;
  getPieceSize(): number;
  pieceToId(piece: string): number;
  idToPiece(id: number): string;
  bosId(): number;
  eosId(): number;
  padId(): number;
  unkId(): number;
}

/**
 * SentencePiece tokenizer for LLM inference.
 *
 * Provides fast tokenization using Google's SentencePiece library.
 * Supports loading .model files and encoding/decoding text to/from token IDs.
 *
 * @example
 * ```typescript
 * import { SentencePieceTokenizer } from '@mlx-node/tokenizer';
 *
 * const tokenizer = new SentencePieceTokenizer();
 * tokenizer.load('path/to/tokenizer.model');
 *
 * const ids = tokenizer.encode('Hello, world!');
 * const text = tokenizer.decode(ids);
 * ```
 */
export class SentencePieceTokenizer {
  private native: NativeSentencePieceTokenizer;

  /**
   * Create a new SentencePiece tokenizer.
   *
   * @param modelPath - Optional path to a .model file to load immediately
   */
  constructor(modelPath?: string) {
    this.native = new binding.SentencePieceTokenizer(modelPath);
  }

  /**
   * Load a SentencePiece model from a file.
   *
   * @param path - Path to the .model file
   */
  load(path: string): void {
    this.native.load(path);
  }

  /**
   * Load a SentencePiece model from a buffer.
   *
   * @param buffer - Buffer containing the serialized model proto
   */
  loadFromBuffer(buffer: Buffer): void {
    this.native.loadFromBuffer(buffer);
  }

  /**
   * Encode text to token IDs.
   *
   * @param text - Text to encode
   * @returns Array of token IDs
   */
  encode(text: string): number[] {
    return this.native.encode(text);
  }

  /**
   * Encode text to token IDs (alias for encode).
   *
   * @param text - Text to encode
   * @returns Array of token IDs
   */
  encodeAsIds(text: string): number[] {
    return this.native.encodeAsIds(text);
  }

  /**
   * Encode text to subword pieces.
   *
   * @param text - Text to encode
   * @returns Array of subword pieces (strings)
   */
  encodeAsPieces(text: string): string[] {
    return this.native.encodeAsPieces(text);
  }

  /**
   * Decode token IDs to text.
   *
   * @param ids - Array of token IDs
   * @returns Decoded text
   */
  decode(ids: number[]): string {
    return this.native.decode(ids);
  }

  /**
   * Decode token IDs to text (alias for decode).
   *
   * @param ids - Array of token IDs
   * @returns Decoded text
   */
  decodeIds(ids: number[]): string {
    return this.native.decodeIds(ids);
  }

  /**
   * Decode subword pieces to text.
   *
   * @param pieces - Array of subword pieces
   * @returns Decoded text
   */
  decodePieces(pieces: string[]): string {
    return this.native.decodePieces(pieces);
  }

  /**
   * Get the vocabulary size.
   *
   * @returns Number of pieces in the vocabulary
   */
  get vocabSize(): number {
    return this.native.getPieceSize();
  }

  /**
   * Get the vocabulary size (alias for vocabSize).
   *
   * @returns Number of pieces in the vocabulary
   */
  getPieceSize(): number {
    return this.native.getPieceSize();
  }

  /**
   * Convert a piece (subword) to its ID.
   *
   * @param piece - The piece string
   * @returns The token ID
   */
  pieceToId(piece: string): number {
    return this.native.pieceToId(piece);
  }

  /**
   * Convert a token ID to its piece (subword).
   *
   * @param id - The token ID
   * @returns The piece string
   */
  idToPiece(id: number): string {
    return this.native.idToPiece(id);
  }

  /**
   * Get the beginning-of-sequence token ID.
   *
   * @returns BOS token ID (-1 if not defined)
   */
  get bosId(): number {
    return this.native.bosId();
  }

  /**
   * Get the end-of-sequence token ID.
   *
   * @returns EOS token ID (-1 if not defined)
   */
  get eosId(): number {
    return this.native.eosId();
  }

  /**
   * Get the padding token ID.
   *
   * @returns PAD token ID (-1 if not defined)
   */
  get padId(): number {
    return this.native.padId();
  }

  /**
   * Get the unknown token ID.
   *
   * @returns UNK token ID
   */
  get unkId(): number {
    return this.native.unkId();
  }
}

export default SentencePieceTokenizer;
