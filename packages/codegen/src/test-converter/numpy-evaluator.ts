/**
 * Numpy Expression Evaluator
 *
 * Evaluates numpy expressions at conversion time using Python
 * and returns the pre-computed values for injection into TypeScript tests.
 */

import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Get the package root directory (handles both src and dist paths)
function getPackageRoot(): string {
  // __dirname could be:
  // - /path/to/codegen/src/test-converter (during development)
  // - /path/to/codegen/dist/test-converter (when compiled)
  // We need to find the package root that contains the .venv and src folders
  let dir = __dirname;
  while (dir !== '/') {
    if (fs.existsSync(path.join(dir, 'package.json'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return path.join(__dirname, '..', '..');
}

// Find Python interpreter - prefer venv if available
function getPythonPath(): string {
  const packageRoot = getPackageRoot();
  const venvPython = path.join(packageRoot, '.venv', 'bin', 'python3');
  if (fs.existsSync(venvPython)) {
    return venvPython;
  }
  return 'python3';
}

interface EvalResult {
  expr: string;
  type: 'array' | 'bool' | 'int' | 'float' | 'nan' | 'inf' | 'list' | 'null' | 'string' | 'error';
  value?: any;
  dtype?: string;
  shape?: number[];
  error?: string;
}

/**
 * Evaluate numpy expressions using Python.
 *
 * @param expressions - Array of numpy expressions to evaluate
 * @returns Map of expression to result
 */
export function evaluateNumpyExpressions(expressions: string[]): Map<string, EvalResult> {
  if (expressions.length === 0) {
    return new Map();
  }

  const packageRoot = getPackageRoot();
  const pythonScript = path.join(packageRoot, 'src', 'test-converter', 'numpy-evaluator.py');
  const pythonPath = getPythonPath();
  const input = expressions.join('\n');

  try {
    const output = execSync(`"${pythonPath}" "${pythonScript}"`, {
      input,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      timeout: 120000, // 2 minute timeout (mlx import can be slow)
    });

    const results: EvalResult[] = JSON.parse(output);
    const resultMap = new Map<string, EvalResult>();

    for (const result of results) {
      resultMap.set(result.expr, result);
    }

    return resultMap;
  } catch (error) {
    console.warn('Failed to evaluate numpy expressions:', error);
    return new Map();
  }
}

/**
 * Convert a numpy evaluation result to TypeScript code.
 *
 * @param result - The evaluation result
 * @returns TypeScript code representing the value
 */
export function resultToTypeScript(result: EvalResult): string {
  switch (result.type) {
    case 'array':
      return JSON.stringify(result.value);
    case 'bool':
      return result.value ? 'true' : 'false';
    case 'int':
    case 'float':
      return String(result.value);
    case 'nan':
      return 'NaN';
    case 'inf':
      return result.value! > 0 ? 'Infinity' : '-Infinity';
    case 'list':
      return JSON.stringify(result.value);
    case 'null':
      return 'null';
    case 'string':
      return JSON.stringify(result.value);
    case 'error':
      return `/* EVAL_ERROR: ${result.error} */`;
    default:
      return `/* UNKNOWN_TYPE: ${result.type} */`;
  }
}

/**
 * Extract numpy expressions from Python source code.
 *
 * Finds expressions like:
 * - np.array([1, 2, 3])
 * - np.allclose(a, b)
 * - np.zeros((3, 3))
 * - np.arange(10)
 *
 * @param source - Python source code
 * @returns Array of numpy expressions found
 */
export function extractNumpyExpressions(source: string): string[] {
  const expressions: string[] = [];

  // Match np.function_name(...) with balanced parentheses
  const npPattern = /np\.\w+\s*\(/g;
  let match;

  while ((match = npPattern.exec(source)) !== null) {
    const start = match.index;
    const expr = extractBalancedExpression(source, start);
    if (expr && !expressions.includes(expr)) {
      expressions.push(expr);
    }
  }

  return expressions;
}

/**
 * Extract an expression with balanced parentheses starting at position.
 */
function extractBalancedExpression(source: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  let stringChar = '';
  let end = start;

  for (let i = start; i < source.length; i++) {
    const char = source[i];

    if (inString) {
      if (char === stringChar && source[i - 1] !== '\\') {
        inString = false;
      }
      end = i;
      continue;
    }

    if (char === '"' || char === "'") {
      inString = true;
      stringChar = char;
      end = i;
      continue;
    }

    if (char === '(') {
      depth++;
      end = i;
    } else if (char === ')') {
      depth--;
      end = i;
      if (depth === 0) {
        return source.slice(start, end + 1);
      }
    } else if (depth > 0) {
      end = i;
    }
  }

  return null;
}

/**
 * Check if an expression is a simple numpy value expression that can be pre-computed.
 * Excludes expressions that depend on runtime variables or could be expensive.
 */
export function isStaticNumpyExpression(expr: string): boolean {
  // Exclude expressions that reference variables (other than np)
  // A simple heuristic: only allow expressions with literals and np calls

  // Remove string literals first
  const withoutStrings = expr.replace(/"[^"]*"|'[^']*'/g, '""');

  // Check if there are any bareword identifiers that aren't np
  const identifiers = withoutStrings.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g) || [];

  const allowedIdentifiers = new Set([
    'np', 'True', 'False', 'None', 'inf', 'nan',
    // numpy functions
    'array', 'zeros', 'ones', 'arange', 'linspace', 'eye', 'identity',
    'empty', 'full', 'zeros_like', 'ones_like', 'empty_like', 'full_like',
    'allclose', 'isclose', 'array_equal', 'isnan', 'isinf', 'isfinite',
    'sum', 'mean', 'std', 'var', 'min', 'max', 'argmin', 'argmax',
    'reshape', 'transpose', 'flatten', 'ravel', 'squeeze', 'expand_dims',
    'concatenate', 'stack', 'vstack', 'hstack', 'split',
    'float32', 'float64', 'int32', 'int64', 'bool_', 'uint8', 'uint16', 'uint32', 'uint64',
    'dtype', 'shape', 'ndim', 'size',
    'pi', 'e', 'newaxis',
    'sin', 'cos', 'tan', 'exp', 'log', 'log2', 'log10', 'sqrt', 'abs',
    'floor', 'ceil', 'round', 'clip', 'sign',
    'dot', 'matmul', 'inner', 'outer',
    'random', 'seed', 'rand', 'randn', 'randint', 'uniform', 'normal',
  ]);

  for (const id of identifiers) {
    if (!allowedIdentifiers.has(id)) {
      return false;
    }
  }

  // Exclude expressions that could create huge arrays (more than 10000 elements)
  // Look for large numbers in size parameters
  if (/2\*\*\d{2,}/.test(expr)) {
    return false; // Skip 2**10 or larger powers
  }
  if (/\d{5,}/.test(expr)) {
    return false; // Skip numbers with 5+ digits
  }

  // Skip empty() as it's not useful for pre-computation
  if (/np\.empty\s*\(/.test(expr)) {
    return false;
  }

  // Skip functions that require other arrays as input (not literals)
  if (/np\.(zeros_like|ones_like|empty_like|full_like)\s*\(/.test(expr)) {
    return false;
  }

  return true;
}
