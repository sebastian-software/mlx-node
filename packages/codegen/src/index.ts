/**
 * @mlx-node/codegen
 *
 * Code generators for mlx-node.
 */

export {
  TypeScriptGenerator,
  type GeneratorOptions,
} from './ts-generator.js';

export {
  NapiGenerator,
  type NapiGeneratorOptions,
} from './napi-generator.js';

export {
  pythonToTypeScript,
  toCamelCase,
  isOptional,
} from './type-mapper.js';
