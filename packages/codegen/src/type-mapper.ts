/**
 * Maps Python type annotations to TypeScript types
 */

export function pythonToTypeScript(pyType: string): string {
  if (!pyType) return 'unknown';

  const trimmed = pyType.trim();

  // Handle None
  if (trimmed === 'None') return 'undefined';

  // Handle basic types
  const basicTypes: Record<string, string> = {
    'int': 'number',
    'float': 'number',
    'str': 'string',
    'bool': 'boolean',
    'bytes': 'Buffer',
    'object': 'unknown',
    'array': 'MLXArray',
    'Array': 'MLXArray',
    'Dtype': 'Dtype',
    'DtypeCategory': 'DtypeCategory',
    'Device': 'Device',
    'DeviceType': 'DeviceType',
    'Stream': 'Stream',
    'Group': 'DistributedGroup',
  };

  if (basicTypes[trimmed]) {
    return basicTypes[trimmed];
  }

  // Handle Optional[X] → X | undefined
  const optionalMatch = trimmed.match(/^Optional\[(.+)\]$/);
  if (optionalMatch) {
    return `${pythonToTypeScript(optionalMatch[1])} | undefined`;
  }

  // Handle Union[A, B, ...] → A | B | ...
  const unionMatch = trimmed.match(/^Union\[(.+)\]$/);
  if (unionMatch) {
    const parts = splitGenericArgs(unionMatch[1]);
    return parts.map(pythonToTypeScript).join(' | ');
  }

  // Handle List[X] or Sequence[X] → X[]
  const listMatch = trimmed.match(/^(?:List|Sequence)\[(.+)\]$/);
  if (listMatch) {
    return `${pythonToTypeScript(listMatch[1])}[]`;
  }

  // Handle Tuple[A, B, ...] → [A, B, ...]
  const tupleMatch = trimmed.match(/^[Tt]uple\[(.+)\]$/);
  if (tupleMatch) {
    const parts = splitGenericArgs(tupleMatch[1]);
    return `[${parts.map(pythonToTypeScript).join(', ')}]`;
  }

  // Handle Dict[K, V] → Record<K, V>
  const dictMatch = trimmed.match(/^[Dd]ict\[(.+)\]$/);
  if (dictMatch) {
    const parts = splitGenericArgs(dictMatch[1]);
    if (parts.length === 2) {
      return `Record<${pythonToTypeScript(parts[0])}, ${pythonToTypeScript(parts[1])}>`;
    }
  }

  // Handle Callable[[Args], Return] → (...args: Args) => Return
  const callableMatch = trimmed.match(/^Callable\[\[([^\]]*)\],\s*(.+)\]$/);
  if (callableMatch) {
    const args = callableMatch[1] ? splitGenericArgs(callableMatch[1]) : [];
    const ret = pythonToTypeScript(callableMatch[2]);
    const argStr = args.map((a, i) => `arg${i}: ${pythonToTypeScript(a)}`).join(', ');
    return `(${argStr}) => ${ret}`;
  }

  // Handle literal types like Literal["cpu", "gpu"]
  const literalMatch = trimmed.match(/^Literal\[(.+)\]$/);
  if (literalMatch) {
    const parts = splitGenericArgs(literalMatch[1]);
    return parts.map(p => p.trim()).join(' | ');
  }

  // Handle ellipsis in types
  if (trimmed === '...') {
    return '...args: unknown[]';
  }

  // If it looks like a string literal, keep it
  if (trimmed.startsWith('"') || trimmed.startsWith("'")) {
    return trimmed.replace(/'/g, '"');
  }

  // Default: return as-is (might be a custom type)
  return trimmed;
}

/**
 * Split generic arguments while respecting nested brackets
 */
function splitGenericArgs(args: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;

  for (const char of args) {
    if (char === '[' || char === '(') depth++;
    if (char === ']' || char === ')') depth--;

    if (char === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts;
}

/**
 * Convert a function name from Python style to camelCase
 */
export function toCamelCase(name: string): string {
  // Handle special cases
  if (name.startsWith('__') && name.endsWith('__')) {
    // Dunder methods - keep them or map specially
    const special: Record<string, string> = {
      '__init__': 'constructor',
      '__repr__': 'toString',
      '__str__': 'toString',
      '__len__': 'length',
      '__getitem__': 'get',
      '__setitem__': 'set',
      '__iter__': 'values',
      '__eq__': 'equals',
      '__ne__': 'notEquals',
      '__lt__': 'lessThan',
      '__le__': 'lessThanOrEqual',
      '__gt__': 'greaterThan',
      '__ge__': 'greaterThanOrEqual',
      '__add__': 'add',
      '__sub__': 'subtract',
      '__mul__': 'multiply',
      '__truediv__': 'divide',
      '__matmul__': 'matmul',
      '__neg__': 'negate',
      '__pos__': 'positive',
      '__abs__': 'abs',
      '__invert__': 'invert',
      '__and__': 'and',
      '__or__': 'or',
      '__xor__': 'xor',
    };
    return special[name] || name;
  }

  // Convert snake_case to camelCase
  return name.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Check if a Python type is optional (can be None)
 */
export function isOptional(pyType: string): boolean {
  if (!pyType) return false;
  const trimmed = pyType.trim();

  if (trimmed.startsWith('Optional[')) return true;
  if (trimmed.includes('None')) return true;
  if (trimmed.includes('| None')) return true;

  return false;
}
