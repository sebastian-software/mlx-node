/**
 * Python to TypeScript Test Converter
 *
 * Converts MLX Python tests to TypeScript/Vitest format.
 */

import { extractTests, parseStatements, Statement, TestClass, TestMethod } from './python-parser.js';

// Python to TypeScript dtype mappings
const DTYPE_MAP: Record<string, string> = {
  'mx.bool_': "'bool'",
  'mx.uint8': "'uint8'",
  'mx.uint16': "'uint16'",
  'mx.uint32': "'uint32'",
  'mx.uint64': "'uint64'",
  'mx.int8': "'int8'",
  'mx.int16': "'int16'",
  'mx.int32': "'int32'",
  'mx.int64': "'int64'",
  'mx.float16': "'float16'",
  'mx.float32': "'float32'",
  'mx.float64': "'float64'",
  'mx.bfloat16': "'bfloat16'",
  'mx.complex64': "'complex64'",
};

// NumPy dtype mappings
const NP_DTYPE_MAP: Record<string, string> = {
  'np.bool_': "'bool'",
  'np.uint8': "'uint8'",
  'np.uint16': "'uint16'",
  'np.uint32': "'uint32'",
  'np.uint64': "'uint64'",
  'np.int8': "'int8'",
  'np.int16': "'int16'",
  'np.int32': "'int32'",
  'np.int64': "'int64'",
  'np.float16': "'float16'",
  'np.float32': "'float32'",
  'np.float64': "'float64'",
};

/**
 * Parse function call arguments, handling nested parentheses/brackets
 */
function parseArgs(argsStr: string): string[] {
  const args: string[] = [];
  let current = '';
  let depth = 0;
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < argsStr.length; i++) {
    const char = argsStr[i];

    if (inString) {
      current += char;
      if (char === stringChar && argsStr[i - 1] !== '\\') {
        inString = false;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inString = true;
      stringChar = char;
      current += char;
      continue;
    }

    if (char === '(' || char === '[' || char === '{') {
      depth++;
      current += char;
    } else if (char === ')' || char === ']' || char === '}') {
      depth--;
      current += char;
    } else if (char === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    args.push(current.trim());
  }

  return args;
}

/**
 * Find balanced closing paren position
 */
function findClosingParen(code: string, start: number): number {
  let depth = 1;
  let inString = false;
  let stringChar = '';

  for (let i = start; i < code.length; i++) {
    const char = code[i];

    if (inString) {
      if (char === stringChar && code[i - 1] !== '\\') {
        inString = false;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inString = true;
      stringChar = char;
      continue;
    }

    if (char === '(') {
      depth++;
    } else if (char === ')') {
      depth--;
      if (depth === 0) {
        return i;
      }
    }
  }

  return -1;
}

/**
 * Convert Python kwargs in function calls to JavaScript options objects
 */
function convertKwargs(code: string): string {
  let result = code;

  // Find function calls by looking for identifier followed by (
  // Process from right to left to handle indices correctly
  const funcCallStarts: Array<{ name: string; argsStart: number; nameStart: number }> = [];

  // Match function names (including method calls like obj.method)
  const funcNameRegex = /\b([\w.]+)\(/g;
  let match;

  while ((match = funcNameRegex.exec(code)) !== null) {
    funcCallStarts.push({
      name: match[1],
      nameStart: match.index,
      argsStart: match.index + match[0].length, // position after opening (
    });
  }

  // Process in reverse order
  for (let i = funcCallStarts.length - 1; i >= 0; i--) {
    const { name, nameStart, argsStart } = funcCallStarts[i];
    const argsEnd = findClosingParen(result, argsStart);

    if (argsEnd === -1) continue;

    const argsStr = result.slice(argsStart, argsEnd);

    // Check if this call has kwargs
    if (!/\w+=[^=]/.test(argsStr)) continue;

    const converted = convertSingleFuncCall(name, argsStr);
    if (converted) {
      result = result.slice(0, nameStart) + converted + result.slice(argsEnd + 1);
    }
  }

  // Handle chained calls like getattr(mx, op)(x, axis=axis)
  // The pattern is )( where the second call may have kwargs
  result = result.replace(
    /\)\(([^)]+)\)/g,
    (match, argsStr) => {
      // Check if this has kwargs
      if (!/\w+=[^=]/.test(argsStr)) return match;

      const args = parseArgs(argsStr);
      const positional: string[] = [];
      const kwargs: Array<{ key: string; value: string }> = [];

      for (const arg of args) {
        const kwMatch = arg.match(/^(\w+)=(?!=)(.+)$/);
        if (kwMatch) {
          kwargs.push({ key: kwMatch[1], value: kwMatch[2] });
        } else {
          positional.push(arg);
        }
      }

      if (kwargs.length === 0) return match;

      const optionEntries = kwargs.map(({ key, value }) => `${key}: ${value}`);
      const optionsObj = `{ ${optionEntries.join(', ')} }`;

      if (positional.length > 0) {
        return `)(${positional.join(', ')}, ${optionsObj})`;
      } else {
        return `)(${optionsObj})`;
      }
    }
  );

  return result;
}

/**
 * Convert a single function call with kwargs
 */
function convertSingleFuncCall(funcName: string, argsStr: string): string | null {
  const args = parseArgs(argsStr);

  const positional: string[] = [];
  const kwargs: Array<{ key: string; value: string }> = [];

  for (const arg of args) {
    // Check if this is a kwarg (key=value, not ==)
    const kwMatch = arg.match(/^(\w+)=(?!=)(.+)$/);
    if (kwMatch) {
      kwargs.push({ key: kwMatch[1], value: kwMatch[2] });
    } else {
      positional.push(arg);
    }
  }

  // If no kwargs, nothing to convert
  if (kwargs.length === 0) {
    return null;
  }

  // Convert kwargs to options object
  const optionEntries = kwargs.map(({ key, value }) => {
    // Convert the value using pythonToTypeScript rules
    let tsValue = value;
    // Apply dtype mappings
    for (const [py, ts] of Object.entries(DTYPE_MAP)) {
      tsValue = tsValue.replaceAll(py, ts);
    }
    for (const [py, ts] of Object.entries(NP_DTYPE_MAP)) {
      tsValue = tsValue.replaceAll(py, ts);
    }
    // True/False
    tsValue = tsValue.replace(/\bTrue\b/g, 'true');
    tsValue = tsValue.replace(/\bFalse\b/g, 'false');
    tsValue = tsValue.replace(/\bNone\b/g, 'null');
    // Tuples to arrays in values
    tsValue = tsValue.replace(/^\((\d+(?:,\s*\d+)*)\)$/, '[$1]');
    tsValue = tsValue.replace(/^\((\d+),\)$/, '[$1]');

    return `${key}: ${tsValue}`;
  });

  const optionsObj = `{ ${optionEntries.join(', ')} }`;

  if (positional.length > 0) {
    return `${funcName}(${positional.join(', ')}, ${optionsObj})`;
  } else {
    return `${funcName}(${optionsObj})`;
  }
}

/**
 * Convert Python expression to TypeScript
 */
export function pythonToTypeScript(code: string): string {
  let ts = code;

  // Replace dtype references
  for (const [py, tsVal] of Object.entries(DTYPE_MAP)) {
    ts = ts.replaceAll(py, tsVal);
  }

  // Python tuple (1, 2) -> JS array [1, 2]
  // Only convert tuples, not function call arguments
  ts = ts.replace(/(?<![a-zA-Z0-9_])\((\d+),\)/g, '[$1]');
  ts = ts.replace(/(?<![a-zA-Z0-9_])\((\d+(?:,\s*\d+)+)\)/g, (_, nums) => `[${nums}]`);

  // Tuple of arrays/tuples: ((...), (...)) or ([...], [...]) -> [[...], [...]]
  // This handles for-loop iterables like: for x in ((1,2), (3,4))
  ts = ts.replace(/\(\s*(\[[^\]]+\](?:\s*,\s*\[[^\]]+\])*)\s*,?\s*\)/g, '[$1]');

  // Empty tuple () -> empty array []
  ts = ts.replace(/\.toBe\(\(\)\)/g, '.toEqual([])');
  ts = ts.replace(/\.toEqual\(\(\)\)/g, '.toEqual([])');
  // Standalone empty tuple (when it's the entire expression)
  if (ts === '()') ts = '[]';

  // Python True/False -> JS true/false
  ts = ts.replace(/\bTrue\b/g, 'true');
  ts = ts.replace(/\bFalse\b/g, 'false');

  // Python None -> JS null
  ts = ts.replace(/\bNone\b/g, 'null');

  // Python float("inf") -> Infinity
  ts = ts.replace(/float\(["']inf["']\)/g, 'Infinity');
  ts = ts.replace(/float\(["']-inf["']\)/g, '-Infinity');
  ts = ts.replace(/float\(["']nan["']\)/g, 'NaN');

  // np.inf/nan -> Infinity/NaN
  ts = ts.replace(/\bnp\.inf\b/g, 'Infinity');
  ts = ts.replace(/\bnp\.nan\b/g, 'NaN');

  // np.isnan -> Number.isNaN
  ts = ts.replace(/\bnp\.isnan\(/g, 'Number.isNaN(');
  ts = ts.replace(/\bnp\.isinf\(/g, '!Number.isFinite(');

  // hasattr(obj, "prop") -> 'prop' in obj
  ts = ts.replace(/hasattr\((\w+),\s*["'](\w+)["']\)/g, "'$2' in $1");

  // isinstance checks
  ts = ts.replace(/isinstance\((\w+),\s*bool\)/g, 'typeof $1 === "boolean"');
  ts = ts.replace(/isinstance\((\w+),\s*int\)/g, 'typeof $1 === "number"');
  ts = ts.replace(/isinstance\((\w+),\s*float\)/g, 'typeof $1 === "number"');
  ts = ts.replace(/isinstance\((\w+),\s*str\)/g, 'typeof $1 === "string"');

  // mx.array(...) needs 'new' in JavaScript
  ts = ts.replace(/\bmx\.array\(/g, 'new mx.array(');

  // np.array -> new mx.array
  ts = ts.replace(/\bnp\.array\(/g, 'new mx.array(');

  // np.allclose -> use custom helper
  ts = ts.replace(/\bnp\.allclose\(/g, 'allClose(');

  // len(x) or len(x.prop) -> x.length or x.prop.length
  ts = ts.replace(/\blen\(([\w.]+)\)/g, '$1.length');

  // list(x) -> Array.from(x) (handles x.prop too)
  ts = ts.replace(/\blist\(([\w.]+)\.tolist\(\)\)/g, '$1.tolist()');
  ts = ts.replace(/\blist\(([\w.]+)\)/g, 'Array.from($1)');

  // range(n) -> [...Array(n).keys()]
  ts = ts.replace(/\brange\((\d+)\)/g, '[...Array($1).keys()]');

  // Python splat *args -> JS spread ...args (but not ** for kwargs)
  ts = ts.replace(/(?<!\*)\*(\w+)/g, '...$1');

  // Python list comprehension -> JS map
  // [expr for var in iterable] -> iterable.map(var => expr)
  // [expr for var in iterable if cond] -> iterable.filter(var => cond).map(var => expr)
  ts = ts.replace(
    /\[([^\[\]]+)\s+for\s+(\w+)\s+in\s+([^\[\]]+?)(?:\s+if\s+([^\[\]]+))?\]/g,
    (match, expr, varName, iterable, condition) => {
      const trimmedExpr = expr.trim();
      const trimmedIterable = iterable.trim();
      if (condition) {
        return `${trimmedIterable}.filter(${varName} => ${condition.trim()}).map(${varName} => ${trimmedExpr})`;
      }
      return `${trimmedIterable}.map(${varName} => ${trimmedExpr})`;
    }
  );

  // Python dict comprehension -> JS Object.fromEntries
  // {k: v for k, v in iterable} -> Object.fromEntries(iterable.map(([k, v]) => [k, v]))
  ts = ts.replace(
    /\{([^{}]+):\s*([^{}]+)\s+for\s+([^{}]+)\s+in\s+([^{}]+)\}/g,
    (match, keyExpr, valueExpr, varPattern, iterable) => {
      const vars = varPattern.trim();
      const destructure = vars.includes(',') ? `[${vars}]` : vars;
      return `Object.fromEntries(${iterable.trim()}.map(${destructure} => [${keyExpr.trim()}, ${valueExpr.trim()}]))`;
    }
  );

  // Python generator expression in function call -> .map()
  // func(expr for var in iterable) -> func(...iterable.map(var => expr))
  ts = ts.replace(
    /(\w+)\(([^()]+)\s+for\s+(\w+)\s+in\s+([^()]+)\)/g,
    (match, func, expr, varName, iterable) => {
      return `${func}(...${iterable.trim()}.map(${varName} => ${expr.trim()}))`;
    }
  );

  // Python lambda -> JS arrow function
  // lambda x: x -> (x) => x
  // lambda x: x.T -> (x) => x.T
  // lambda x, y: x + y -> (x, y) => x + y
  ts = ts.replace(
    /\blambda\s*([^:]*?):\s*([^,}\]\)]+)/g,
    (match, params, body) => {
      const trimmedParams = params.trim();
      const trimmedBody = body.trim();
      if (trimmedParams) {
        return `(${trimmedParams}) => ${trimmedBody}`;
      } else {
        return `() => ${trimmedBody}`;
      }
    }
  );

  return ts;
}

/**
 * Convert Python assertion to Vitest expect()
 */
export function convertAssertion(assertType: string, args: string[]): string {
  const convert = (s: string) => pythonToTypeScript(convertKwargs(s));

  switch (assertType) {
    case 'assertEqual':
      if (args.length >= 2) {
        const actual = convert(args[0]);
        const expected = convert(args[1]);
        // Use toEqual for arrays, objects, and empty arrays
        if (expected.startsWith('[') || expected.startsWith('{') || expected === '[]') {
          return `expect(${actual}).toEqual(${expected});`;
        }
        return `expect(${actual}).toBe(${expected});`;
      }
      break;

    case 'assertTrue':
      if (args.length >= 1) {
        return `expect(${convert(args[0])}).toBe(true);`;
      }
      break;

    case 'assertFalse':
      if (args.length >= 1) {
        return `expect(${convert(args[0])}).toBe(false);`;
      }
      break;

    case 'assertAlmostEqual':
      if (args.length >= 2) {
        const places = args[2] || '7';
        return `expect(${convert(args[0])}).toBeCloseTo(${convert(args[1])}, ${places});`;
      }
      break;

    case 'assertIsNone':
      if (args.length >= 1) {
        return `expect(${convert(args[0])}).toBeNull();`;
      }
      break;

    case 'assertIsNotNone':
      if (args.length >= 1) {
        return `expect(${convert(args[0])}).not.toBeNull();`;
      }
      break;

    case 'assertGreater':
      if (args.length >= 2) {
        return `expect(${convert(args[0])}).toBeGreaterThan(${convert(args[1])});`;
      }
      break;

    case 'assertLess':
      if (args.length >= 2) {
        return `expect(${convert(args[0])}).toBeLessThan(${convert(args[1])});`;
      }
      break;

    case 'assertGreaterEqual':
      if (args.length >= 2) {
        return `expect(${convert(args[0])}).toBeGreaterThanOrEqual(${convert(args[1])});`;
      }
      break;

    case 'assertLessEqual':
      if (args.length >= 2) {
        return `expect(${convert(args[0])}).toBeLessThanOrEqual(${convert(args[1])});`;
      }
      break;

    case 'assertIn':
      if (args.length >= 2) {
        return `expect(${convert(args[1])}).toContain(${convert(args[0])});`;
      }
      break;

    case 'assertNotIn':
      if (args.length >= 2) {
        return `expect(${convert(args[1])}).not.toContain(${convert(args[0])});`;
      }
      break;

    case 'assertListEqual':
      if (args.length >= 2) {
        return `expect(${convert(args[0])}).toEqual(${convert(args[1])});`;
      }
      break;

    case 'assertNotEqual':
      if (args.length >= 2) {
        return `expect(${convert(args[0])}).not.toBe(${convert(args[1])});`;
      }
      break;

    case 'assertTupleEqual':
    case 'assertSequenceEqual':
      if (args.length >= 2) {
        return `expect(${convert(args[0])}).toEqual(${convert(args[1])});`;
      }
      break;

    // MLX-specific assertions
    case 'assertEqualArray':
      if (args.length >= 2) {
        return `expectAllClose(${convert(args[0])}, ${convert(args[1])});`;
      }
      break;

    case 'assertCmpNumpy':
      if (args.length >= 2) {
        return `expectAllClose(${convert(args[0])}, ${convert(args[1])});`;
      }
      break;
  }

  return `// TODO: ${assertType}(${args.join(', ')})`;
}

/**
 * Check if a line should be skipped (complex Python features)
 */
function shouldSkipLine(line: string): { skip: boolean; reason?: string } {
  // Note: kwargs are now handled by convertKwargs()
  // Note: slices are now handled by convertSlices()
  // Note: slice assignments are now handled by convertSliceAssignments()
  // Note: .at[] indexing is now handled by convertAtIndex()
  // Note: complex numbers are now handled by convertComplex()

  return { skip: false };
}

/**
 * Convert Python lambda to JavaScript arrow function
 * Examples:
 *   lambda x: x -> (x) => x
 *   lambda x: x + 1 -> (x) => x + 1
 *   lambda x, y: x + y -> (x, y) => x + y
 *   lambda: 42 -> () => 42
 */
function convertLambda(code: string): string {
  // Match lambda with parameters: lambda x, y: body
  // Need to handle nested lambdas and complex bodies
  return code.replace(
    /\blambda\s*([^:]*?):\s*([^,}\]]+(?:\([^)]*\))?)/g,
    (match, params, body) => {
      const trimmedParams = params.trim();
      const trimmedBody = pythonToTypeScript(body.trim());
      if (trimmedParams) {
        return `(${trimmedParams}) => ${trimmedBody}`;
      } else {
        return `() => ${trimmedBody}`;
      }
    }
  );
}

/**
 * Convert Python complex number literals to makeComplex() calls
 * Examples:
 *   1j -> makeComplex(mx, 0, 1)
 *   2+3j -> makeComplex(mx, 2, 3)
 *   1.5-2.5j -> makeComplex(mx, 1.5, -2.5)
 *   r + 1j * i -> makeComplex(mx, r, i)
 */
function convertComplex(code: string): string {
  let result = code;

  // Pattern 1: Complex expression like "r + 1j * i" or "r + i * 1j"
  // Convert: x + 1j * y -> makeComplex(mx, x, y)
  // Convert: x - 1j * y -> makeComplex(mx, x, mx.negative(y))
  result = result.replace(
    /(\b[a-zA-Z_][a-zA-Z0-9_]*)\s*\+\s*1j\s*\*\s*(\b[a-zA-Z_][a-zA-Z0-9_]*)/g,
    'makeComplex(mx, $1, $2)'
  );
  result = result.replace(
    /(\b[a-zA-Z_][a-zA-Z0-9_]*)\s*-\s*1j\s*\*\s*(\b[a-zA-Z_][a-zA-Z0-9_]*)/g,
    'makeComplex(mx, $1, mx.negative($2))'
  );

  // Pattern 2: Standalone complex literal "a+bj" or "a-bj" (with numbers)
  // Match: optional_real +/- imaginary j
  // Examples: 1+2j, 1.5-2.5j, -1+2j, 1-2j
  result = result.replace(
    /\b(-?\d+\.?\d*)\s*\+\s*(\d+\.?\d*)j\b/g,
    'makeComplex(mx, $1, $2)'
  );
  result = result.replace(
    /\b(-?\d+\.?\d*)\s*-\s*(\d+\.?\d*)j\b/g,
    'makeComplex(mx, $1, -$2)'
  );

  // Pattern 3: Pure imaginary "bj" or "0j"
  // Examples: 1j, 2.5j, 0j
  result = result.replace(
    /\b(\d+\.?\d*)j\b/g,
    'makeComplex(mx, 0, $1)'
  );

  // Pattern 4: Complex with explicit 0 imaginary like "1 + 0j"
  result = result.replace(
    /\b(-?\d+\.?\d*)\s*\+\s*0j\b/g,
    'makeComplex(mx, $1, 0)'
  );

  return result;
}

/**
 * Convert Python tuple pattern to JS array destructuring
 * Examples:
 *   x -> x
 *   (a, b) -> [a, b]
 *   a, b -> [a, b]
 *   (a, b), (c, d) -> [[a, b], [c, d]]
 */
function convertTuplePattern(pattern: string): string {
  pattern = pattern.trim();

  // Simple variable name
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(pattern)) {
    return pattern;
  }

  // Check for nested tuples: (a, b), (c, d)
  // Split by comma but respect parentheses
  const parts: string[] = [];
  let current = '';
  let depth = 0;

  for (const char of pattern) {
    if (char === '(') {
      depth++;
      current += char;
    } else if (char === ')') {
      depth--;
      current += char;
    } else if (char === ',' && depth === 0) {
      if (current.trim()) {
        parts.push(current.trim());
      }
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) {
    parts.push(current.trim());
  }

  // If we have multiple parts at depth 0, each might be a tuple
  if (parts.length > 1) {
    // Check if parts are tuples (start and end with parens)
    const allTuples = parts.every(p => p.startsWith('(') && p.endsWith(')'));
    if (allTuples) {
      // Nested tuple pattern: [[a, b], [c, d]]
      const converted = parts.map(p => convertTuplePattern(p));
      return `[${converted.join(', ')}]`;
    }
    // Simple comma-separated: [a, b, c]
    return `[${parts.join(', ')}]`;
  }

  // Single tuple: (a, b) -> [a, b]
  if (pattern.startsWith('(') && pattern.endsWith(')')) {
    const inner = pattern.slice(1, -1);
    const innerParts = inner.split(',').map(p => p.trim());
    return `[${innerParts.join(', ')}]`;
  }

  return pattern;
}

/**
 * Extract all variable names from a tuple pattern
 */
function extractVarNames(pattern: string): string[] {
  // Remove all parentheses and split by comma
  const cleaned = pattern.replace(/[()]/g, '');
  return cleaned.split(',').map(v => v.trim()).filter(v => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(v));
}

/**
 * Convert Python .at[] indexing to pyAt() calls
 * Examples:
 *   a.at[1].add(2) -> pyAt(mx, a, '1').add(2)
 *   a.at[0:1].add(x) -> pyAt(mx, a, '0:1').add(x)
 *   a.at[idx_x, :, 0].add(u) -> pyAt(mx, a, 'idx_x, :, 0').add(u)
 */
function convertAtIndex(code: string): string {
  // Match: identifier.at[indexExpr].method(args)
  // The indexExpr can contain commas, colons, variable names, etc.
  const atPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\.at\[([^\]]+)\]\.(add|subtract|multiply|divide|maximum|minimum)\(([^)]+)\)/g;

  return code.replace(atPattern, (match, identifier, indexExpr, method, args) => {
    return `pyAt(mx, ${identifier}, '${indexExpr}').${method}(${args})`;
  });
}

/**
 * Convert Python slice assignments to pySliceUpdate() calls
 * Examples:
 *   a[1:3] = 0 -> a = pySliceUpdate(mx, a, '1:3', 0)
 *   a[:, 0] = x -> a = pySliceUpdate(mx, a, ':, 0', x)
 */
function convertSliceAssignments(code: string): string {
  // Match: identifier[slice] = value
  // The slice must contain a colon to distinguish from simple indexing
  const sliceAssignPattern = /^(\s*)([a-zA-Z_][a-zA-Z0-9_]*)\[([^\]]*:[^\]]*)\]\s*=\s*(.+)$/;
  const match = code.match(sliceAssignPattern);

  if (match) {
    const [, indent, identifier, sliceExpr, value] = match;
    return `${indent}${identifier} = pySliceUpdate(mx, ${identifier}, '${sliceExpr}', ${value})`;
  }

  return code;
}

/**
 * Convert Python slice expressions to pySlice() calls
 * Examples:
 *   a[1:3] -> pySlice(mx, a, '1:3')
 *   a[:, 0] -> pySlice(mx, a, ':, 0')
 *   a[::2] -> pySlice(mx, a, '::2')
 */
function convertSlices(code: string): string {
  // Match identifier followed by [...] containing a colon
  // But not if it's part of a slice assignment (those are handled separately)
  const slicePattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\[([^\]]*:[^\]]*)\]/g;

  return code.replace(slicePattern, (match, identifier, sliceExpr) => {
    // Skip if this looks like a type annotation
    if (sliceExpr.includes('|') || sliceExpr.includes('->')) {
      return match;
    }
    // Convert the slice expression
    return `pySlice(mx, ${identifier}, '${sliceExpr}')`;
  });
}

/**
 * Convert a single line/statement to TypeScript
 */
export function convertLine(line: string, declaredVars: Set<string>): string {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) {
    return '';
  }

  // Check for skip patterns
  const skipCheck = shouldSkipLine(trimmed);
  if (skipCheck.skip) {
    return `// TODO (${skipCheck.reason}): ${trimmed}`;
  }

  let ts = trimmed;

  // Handle slice assignments first: a[1:3] = x -> a = pySliceUpdate(mx, a, '1:3', x)
  ts = convertSliceAssignments(ts);

  // Tuple unpacking assignment: a, b = func() -> const [a, b] = func()
  const tupleAssignMatch = ts.match(/^([a-z_][a-z0-9_]*(?:\s*,\s*[a-z_][a-z0-9_]*)+)\s*=\s*(.+)$/i);
  if (tupleAssignMatch) {
    const vars = tupleAssignMatch[1].split(',').map(v => v.trim());
    const value = tupleAssignMatch[2];
    const allNew = vars.every(v => !declaredVars.has(v));
    vars.forEach(v => declaredVars.add(v));
    const keyword = allNew ? 'const' : '';
    ts = `${keyword} [${vars.join(', ')}] = ${value}`.trim();
  }
  // Single variable assignment - add 'let' for first use
  else {
    const assignMatch = ts.match(/^([a-z_][a-z0-9_]*)\s*=/i);
    if (assignMatch) {
      const varName = assignMatch[1];
      if (!declaredVars.has(varName)) {
        ts = `let ${ts}`;
        declaredVars.add(varName);
      }
    }
  }

  // Apply conversions
  ts = convertLambda(ts);
  ts = convertKwargs(ts);
  ts = convertAtIndex(ts);
  ts = convertComplex(ts);
  ts = convertSlices(ts);
  ts = pythonToTypeScript(ts);

  // Add semicolon if needed
  if (!ts.endsWith(';') && !ts.endsWith('{') && !ts.endsWith('}') && !ts.startsWith('//')) {
    ts += ';';
  }

  return ts;
}

/**
 * Convert statements to TypeScript lines
 */
function convertStatements(statements: Statement[], declaredVars: Set<string>, indent: string = '  '): string[] {
  const lines: string[] = [];

  for (const stmt of statements) {
    const converted = convertStatement(stmt, declaredVars, indent);
    lines.push(...converted);
  }

  return lines;
}

function convertStatement(stmt: Statement, declaredVars: Set<string>, indent: string): string[] {
  const lines: string[] = [];

  switch (stmt.type) {
    case 'assert':
      if (stmt.assertType && stmt.assertArgs) {
        lines.push(indent + convertAssertion(stmt.assertType, stmt.assertArgs));
      }
      break;

    case 'assignment':
    case 'expression': {
      const converted = convertLine(stmt.text, declaredVars);
      if (converted) {
        lines.push(indent + converted);
      }
      break;
    }

    case 'for': {
      if (stmt.loopVar && stmt.iterable) {
        const tsIterable = pythonToTypeScript(stmt.iterable);
        const loopVar = stmt.loopVar;

        // Convert Python tuple patterns to JS destructuring
        const jsDestructure = convertTuplePattern(loopVar);
        const allVars = extractVarNames(loopVar);

        lines.push(`${indent}for (const ${jsDestructure} of ${tsIterable}) {`);
        allVars.forEach(v => declaredVars.add(v));

        if (stmt.children) {
          lines.push(...convertStatements(stmt.children, declaredVars, indent + '  '));
        }
        lines.push(`${indent}}`);
      } else {
        lines.push(`${indent}// TODO (for): ${stmt.text.split('\n')[0]}`);
      }
      break;
    }

    case 'with': {
      const ctx = stmt.contextExpr || '';

      // Handle assertRaises
      if (ctx.includes('assertRaises')) {
        const match = ctx.match(/assertRaises\((\w+)\)/);
        const excType = match?.[1] || 'Error';

        if (stmt.children && stmt.children.length > 0) {
          const bodyLines: string[] = [];
          for (const child of stmt.children) {
            const cl = convertLine(child.text, declaredVars);
            if (cl && !cl.startsWith('//')) {
              bodyLines.push(cl);
            }
          }

          if (bodyLines.length === 1) {
            lines.push(`${indent}expect(() => { ${bodyLines[0]} }).toThrow();`);
          } else if (bodyLines.length > 1) {
            lines.push(`${indent}expect(() => {`);
            for (const bl of bodyLines) {
              lines.push(`${indent}  ${bl}`);
            }
            lines.push(`${indent}}).toThrow();`);
          } else {
            lines.push(`${indent}// TODO (assertRaises): body could not be converted`);
          }
        } else {
          lines.push(`${indent}// TODO (assertRaises): expect(() => ...).toThrow(${excType});`);
        }
      }
      // Handle subTest - inline the body
      else if (ctx.includes('subTest')) {
        if (stmt.children) {
          lines.push(...convertStatements(stmt.children, declaredVars, indent));
        }
      }
      // Handle mx.stream - inline the body with a comment
      else if (ctx.includes('mx.stream')) {
        const streamMatch = ctx.match(/mx\.stream\(([^)]+)\)/);
        const streamArg = streamMatch?.[1] || 'mx.cpu';
        lines.push(`${indent}// Note: Originally in mx.stream(${streamArg}) context`);
        if (stmt.children) {
          lines.push(...convertStatements(stmt.children, declaredVars, indent));
        }
      }
      // Other with statements
      else {
        lines.push(`${indent}// TODO (with): ${stmt.text.split('\n')[0]}`);
      }
      break;
    }

    case 'if': {
      const condition = stmt.condition || '';

      // Skip device availability checks
      if (/mx\.is_available|mx\.metal|mx\.default_device/.test(condition)) {
        lines.push(`${indent}// SKIP (device check): if ${condition}`);
      } else {
        const tsCondition = pythonToTypeScript(condition);
        lines.push(`${indent}if (${tsCondition}) {`);
        if (stmt.children) {
          lines.push(...convertStatements(stmt.children, declaredVars, indent + '  '));
        }
        lines.push(`${indent}}`);
      }
      break;
    }

    case 'return':
      lines.push(`${indent}${pythonToTypeScript(stmt.text)};`);
      break;
  }

  return lines;
}

/**
 * Check if code contains unconverted Python syntax
 */
function hasUnconvertedSyntax(code: string): boolean {
  // Generator/comprehension expressions: anything that looks like "X for Y in Z"
  // where it's NOT a proper JS for loop
  // Match patterns like: "foo for x in y" or ") for x in y"
  if (/\bfor\s+\w+\s+in\s+/.test(code) && !/for\s*\(const\s+/.test(code)) {
    return true;
  }

  // Python @ operator (matrix multiplication)
  if (/\s@\s/.test(code)) {
    return true;
  }

  // Python ** operator (power) - but allow in object literals like { x: 5 }
  if (/\*\*/.test(code) && !/\*\*\s*\{/.test(code)) {
    return true;
  }

  // Python empty tuple () not converted - look for .toBe(()) or similar
  if (/\(\(\)\)/.test(code)) {
    return true;
  }

  // Python complex number literals not converted (j suffix)
  // Check for patterns like 1j, 2j, 0j that aren't part of makeComplex
  if (/[^a-zA-Z_]\d+j\b/.test(code)) {
    return true;
  }

  // Python ternary: x if cond else y
  if (/\bif\s+.+\s+else\b/.test(code)) {
    return true;
  }

  // numpy (np.) usage - we don't have numpy
  if (/\bnp\./.test(code)) {
    return true;
  }

  // Function call with double brackets: func[[x]] instead of func([x])
  if (/\w+\[\[/.test(code)) {
    return true;
  }

  // mlx. instead of mx. (unconverted)
  if (/\bmlx\./.test(code)) {
    return true;
  }

  // tuple() function (Python)
  if (/\btuple\(/.test(code)) {
    return true;
  }

  // getattr() function (Python)
  if (/\bgetattr\(/.test(code)) {
    return true;
  }

  // mx.random.* - random module not fully implemented
  if (/\bmx\.random\./.test(code)) {
    return true;
  }

  // Python modules/functions not available in JS
  if (/\bio\./.test(code)) {
    return true;
  }
  if (/\binit\./.test(code)) {
    return true;
  }
  if (/\bnn\./.test(code)) {
    return true;
  }
  if (/\b_test_/.test(code)) {
    return true;
  }
  // More Python modules
  if (/\b(operator|pickle|copy|weakref|math)\./i.test(code)) {
    return true;
  }
  // Python special methods
  if (/__array_namespace__|__dlpack__|__iter__|__next__/.test(code)) {
    return true;
  }
  // mx functions not implemented
  if (/\bmx\.(new_stream|cpu|gpu|default_device|set_default_device|export_to_dot|async_eval|synchronize|get_peak_memory|grad|vjp|jvp|value_and_grad|eval)\b/.test(code)) {
    return true;
  }

  // Python slice syntax [start:end] or [:end] or [start:]
  // Check for colons inside square brackets that aren't in strings
  const lines = code.split('\n');
  for (const line of lines) {
    // Skip lines that are just comments
    if (line.trim().startsWith('//')) continue;

    // Look for [something:something] patterns
    // But exclude array literals like [0, 0, 1.0]
    const bracketMatches = line.match(/\[[^\]]*:[^\]]*\]/g) || [];
    for (const match of bracketMatches) {
      // Skip if it's clearly an array literal (starts with number or variable, has commas)
      if (/^\[\s*[\d.]+\s*,/.test(match)) continue;
      if (/^\[\s*\w+\s*,/.test(match)) continue;
      // Skip if it's already using pySlice
      if (line.includes('pySlice')) continue;
      // This looks like an unconverted slice
      return true;
    }
  }

  return false;
}

/**
 * Convert a test method to TypeScript
 */
export function convertTestMethod(method: TestMethod, source: string): string {
  const statements = parseStatements(method.body, source);
  const testName = method.name.replace('test_', '');
  const declaredVars = new Set<string>();

  const bodyLines = convertStatements(statements, declaredVars, '  ');
  const bodyCode = bodyLines.join('\n');

  // Check if the converted code has unconverted Python syntax
  if (hasUnconvertedSyntax(bodyCode)) {
    // Return a skipped test with empty body to avoid parse errors
    return `it.skip('${testName}', () => {\n  // TODO: Contains unconverted Python syntax\n});`;
  }

  const lines: string[] = [`it('${testName}', () => {`];
  lines.push(...bodyLines);
  lines.push('});');

  return lines.join('\n');
}

/**
 * Convert a Python test file to TypeScript/Vitest
 */
export function convertTestFile(
  source: string,
  options: { filter?: string; importPath?: string } = {}
): string {
  const { filter, importPath = '../../dist/index.js' } = options;
  const classes = extractTests(source);

  // Check which helpers we need
  const needsAllClose = source.includes('np.allclose') || source.includes('assert_allclose');
  const needsSliceRead = /\w+\[.*:.*\]/.test(source);
  const needsSliceUpdate = /\w+\[.*:.*\]\s*=/.test(source);
  const needsAtIndex = /\.at\[/.test(source);
  const needsComplex = /\d+\.?\d*j\b|1j\s*\*/.test(source);

  const lines: string[] = [
    "import { describe, it, expect } from 'vitest';",
    `import mx from '${importPath}';`,
  ];

  // Build utils import
  const utilImports: string[] = [];
  if (needsAllClose) {
    utilImports.push('allClose', 'expectAllClose');
  }
  if (needsSliceRead) {
    utilImports.push('pySlice');
  }
  if (needsSliceUpdate) {
    utilImports.push('pySliceUpdate');
  }
  if (needsAtIndex) {
    utilImports.push('pyAt');
  }
  if (needsComplex) {
    utilImports.push('makeComplex');
  }
  if (utilImports.length > 0) {
    lines.push(`import { ${utilImports.join(', ')} } from '../utils';`);
  }

  lines.push('');

  for (const cls of classes) {
    const suiteName = cls.name.replace('Test', '');

    // Filter methods if specified
    const methods = filter
      ? cls.methods.filter(m => m.name.includes(filter))
      : cls.methods;

    if (methods.length === 0) continue;

    lines.push(`describe('${suiteName}', () => {`);

    for (const method of methods) {
      const converted = convertTestMethod(method, source);
      for (const line of converted.split('\n')) {
        lines.push(`  ${line}`);
      }
      lines.push('');
    }

    lines.push('});');
    lines.push('');
  }

  return lines.join('\n');
}
