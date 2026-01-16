/**
 * Model architectures
 *
 * TypeScript translations of mlx-lm model implementations.
 * See individual model files for attribution and license information.
 */

export {
  Gemma3Model,
  loadGemma3,
  GEMMA3_4B_CONFIG,
  type Gemma3Config,
  type QuantizationConfig
} from './gemma3.js';

// Note: parseGemma3Config is exported from loading/index.ts

// GPT-OSS and Phi3 will be added here
// export { GptOssModel, loadGptOss, parseGptOssConfig } from './gpt-oss.js';
// export { Phi3Model, loadPhi3, parsePhi3Config } from './phi3.js';
