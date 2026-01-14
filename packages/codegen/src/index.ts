/**
 * @mlx-node/codegen
 *
 * Code generators for mlx-node.
 */

// =============================================================================
// New C++ Based Generators (Recommended)
// =============================================================================
// These parse C++ headers directly for accurate type information

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
  type GeneratorOptions as CppGeneratorOptions,
} from './cpp-napi-generator.js';

// =============================================================================
// Legacy Generators (Deprecated)
// =============================================================================
// These parse Python pybind11 bindings - kept for backwards compatibility
// Use the C++ based generators above for new projects

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
