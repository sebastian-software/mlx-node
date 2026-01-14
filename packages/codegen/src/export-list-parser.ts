/**
 * Export List Parser
 *
 * Extracts the list of exported function names from Python pybind11 bindings.
 * This tells us WHICH functions should be public in the Node.js API.
 */

export interface ExportedFunction {
  name: string;
  module: string;  // 'ops', 'linalg', 'fft', etc.
}

/**
 * Parse Python binding file to extract exported function names
 */
export function parseExportList(content: string, moduleName: string): ExportedFunction[] {
  const exports: ExportedFunction[] = [];
  const seen = new Set<string>();

  // Pattern: m.def("function_name", ...
  // This is how pybind11/nanobind defines exported functions
  const defPattern = /m\.def\(\s*"([a-z_][a-z0-9_]*)"/gi;

  let match;
  while ((match = defPattern.exec(content)) !== null) {
    const name = match[1];
    if (!seen.has(name)) {
      seen.add(name);
      exports.push({ name, module: moduleName });
    }
  }

  return exports;
}

/**
 * Parse all Python binding files and combine export lists
 */
export function parseAllExports(files: { content: string; name: string }[]): Map<string, ExportedFunction> {
  const allExports = new Map<string, ExportedFunction>();

  for (const file of files) {
    // Extract module name from filename (e.g., "ops.cpp" -> "ops")
    const moduleName = file.name.replace(/\.cpp$/, '');
    const exports = parseExportList(file.content, moduleName);

    for (const exp of exports) {
      // If duplicate, prefer ops module
      if (!allExports.has(exp.name) || moduleName === 'ops') {
        allExports.set(exp.name, exp);
      }
    }
  }

  return allExports;
}

/**
 * Known function categories for better organization
 */
export const FUNCTION_CATEGORIES = {
  creation: ['zeros', 'ones', 'full', 'empty', 'eye', 'identity', 'arange', 'linspace', 'tri', 'tril', 'triu'],
  manipulation: ['reshape', 'flatten', 'squeeze', 'expand_dims', 'transpose', 'swapaxes', 'moveaxis', 'atleast_1d', 'atleast_2d', 'atleast_3d'],
  indexing: ['take', 'take_along_axis', 'put_along_axis', 'slice', 'split', 'array_split', 'concatenate', 'stack', 'vstack', 'hstack'],
  math: ['add', 'subtract', 'multiply', 'divide', 'power', 'sqrt', 'square', 'abs', 'negative', 'exp', 'log', 'sin', 'cos', 'tan'],
  reduction: ['sum', 'prod', 'mean', 'var', 'std', 'min', 'max', 'argmin', 'argmax', 'all', 'any'],
  linalg: ['matmul', 'inner', 'outer', 'dot', 'tensordot', 'einsum', 'norm', 'qr', 'svd', 'inv', 'cholesky'],
  nn: ['softmax', 'sigmoid', 'relu', 'gelu', 'silu', 'conv1d', 'conv2d'],
};
