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

  // Empty tuple () -> empty array []
  ts = ts.replace(/\.toBe\(\(\)\)/g, '.toEqual([])');
  ts = ts.replace(/\.toEqual\(\(\)\)/g, '.toEqual([])');

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
        if (expected.startsWith('[') || expected.startsWith('{')) {
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
  // Python slice expressions
  if (/\[.*:.*\]/.test(line) && !line.startsWith('//')) {
    return { skip: true, reason: 'slice' };
  }

  // Complex numbers
  if (/\d+\.?\d*[+-]?\d*\.?\d*j\b/.test(line)) {
    return { skip: true, reason: 'complex' };
  }

  // Note: kwargs are now handled by convertKwargs()

  return { skip: false };
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

  // Variable assignment - add 'let' for first use
  const assignMatch = ts.match(/^([a-z_][a-z0-9_]*)\s*=/i);
  if (assignMatch) {
    const varName = assignMatch[1];
    if (!declaredVars.has(varName)) {
      ts = `let ${ts}`;
      declaredVars.add(varName);
    }
  }

  // Apply conversions
  ts = convertKwargs(ts);
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

        // Handle tuple unpacking: (a, b) or a, b
        if (loopVar.includes(',') || (loopVar.startsWith('(') && loopVar.endsWith(')'))) {
          const vars = loopVar.replace(/[()]/g, '').split(',').map(v => v.trim());
          lines.push(`${indent}for (const [${vars.join(', ')}] of ${tsIterable}) {`);
          vars.forEach(v => declaredVars.add(v));
        } else {
          lines.push(`${indent}for (const ${loopVar} of ${tsIterable}) {`);
          declaredVars.add(loopVar);
        }

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
 * Convert a test method to TypeScript
 */
export function convertTestMethod(method: TestMethod, source: string): string {
  const statements = parseStatements(method.body, source);
  const testName = method.name.replace('test_', '');
  const lines: string[] = [`it('${testName}', () => {`];
  const declaredVars = new Set<string>();

  lines.push(...convertStatements(statements, declaredVars, '  '));
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

  // Check if we need allClose helper
  const needsAllClose = source.includes('np.allclose') || source.includes('assert_allclose');

  const lines: string[] = [
    "import { describe, it, expect } from 'vitest';",
    `import mx from '${importPath}';`,
  ];

  if (needsAllClose) {
    lines.push("import { allClose, expectAllClose } from '../utils';");
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
