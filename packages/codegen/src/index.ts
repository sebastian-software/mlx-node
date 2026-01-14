/**
 * @mlx-node/codegen
 *
 * Code generators for mlx-node.
 * Parses C++ headers directly for accurate type information.
 */

export {
  parseCppHeader,
  groupByName,
  selectBestOverload,
  cppTypeToNapi,
  type CppFunction,
  type CppParam,
  type CppHeader,
} from './cpp-header-parser.js';

export {
  parseExportList,
  parseAllExports,
  type ExportedFunction,
} from './export-list-parser.js';

export {
  CppNapiGenerator,
  type GeneratorOptions,
} from './cpp-napi-generator.js';
