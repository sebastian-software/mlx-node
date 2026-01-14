/**
 * C++ Header Parser for MLX
 *
 * Parses MLX C++ headers directly to extract function signatures.
 * This is more reliable than parsing pybind11 Python bindings.
 */

export interface CppParam {
  name: string;
  type: string;
  defaultValue?: string;
  isConst: boolean;
  isRef: boolean;
}

export interface CppFunction {
  name: string;
  returnType: string;
  params: CppParam[];
  isInline: boolean;
  namespace: string;
  overloadIndex: number;
}

export interface CppHeader {
  functions: CppFunction[];
  namespace: string;
  includes: string[];
}

/**
 * Parse a C++ header file and extract function declarations
 */
export function parseCppHeader(content: string, headerName: string): CppHeader {
  const functions: CppFunction[] = [];
  const overloadCounts = new Map<string, number>();

  // Extract namespace
  const namespaceMatch = content.match(/namespace\s+([\w:]+)\s*\{/);
  const namespace = namespaceMatch?.[1] || '';

  // Extract includes
  const includes = [...content.matchAll(/#include\s+[<"]([^>"]+)[>"]/g)]
    .map(m => m[1]);

  // Remove comments
  let cleaned = content
    .replace(/\/\/[^\n]*/g, '')  // Single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, '');  // Multi-line comments

  // Pattern for function declarations
  // Matches: returnType functionName(params);
  // Also handles inline functions with body
  const funcPattern = /^(inline\s+)?(\w+(?:<[^>]+>)?(?:::[\w<>]+)?)\s+(\w+)\s*\(([^)]*)\)\s*(?:;|\{)/gm;

  let match;
  while ((match = funcPattern.exec(cleaned)) !== null) {
    const isInline = !!match[1];
    const returnType = match[2].trim();
    const name = match[3];
    const paramsStr = match[4];

    // Skip constructors/destructors and template functions
    if (name.startsWith('~') || returnType === 'template') continue;

    // Skip internal/private functions
    if (name.startsWith('_')) continue;

    // Parse parameters
    const params = parseParams(paramsStr);

    // Track overloads
    const count = overloadCounts.get(name) || 0;
    overloadCounts.set(name, count + 1);

    functions.push({
      name,
      returnType,
      params,
      isInline,
      namespace,
      overloadIndex: count,
    });
  }

  return { functions, namespace, includes };
}

/**
 * Parse function parameters
 */
function parseParams(paramsStr: string): CppParam[] {
  if (!paramsStr.trim()) return [];

  const params: CppParam[] = [];

  // Split by comma, but respect nested templates
  const paramParts = splitParams(paramsStr);

  for (const part of paramParts) {
    const param = parseParam(part.trim());
    if (param) {
      params.push(param);
    }
  }

  return params;
}

/**
 * Split parameters respecting template brackets
 */
function splitParams(str: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;

  for (const char of str) {
    if (char === '<' || char === '(' || char === '{') depth++;
    else if (char === '>' || char === ')' || char === '}') depth--;
    else if (char === ',' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += char;
  }

  if (current.trim()) {
    parts.push(current);
  }

  return parts;
}

/**
 * Parse a single parameter
 */
function parseParam(paramStr: string): CppParam | null {
  // Handle default values
  let defaultValue: string | undefined;
  const defaultMatch = paramStr.match(/^(.+?)\s*=\s*(.+)$/);
  if (defaultMatch) {
    paramStr = defaultMatch[1].trim();
    defaultValue = defaultMatch[2].trim();
  }

  // Handle const ref pattern: const Type& name
  const constRefMatch = paramStr.match(/^const\s+(.+?)\s*&\s*(\w+)$/);
  if (constRefMatch) {
    return {
      type: constRefMatch[1].trim(),
      name: constRefMatch[2],
      isConst: true,
      isRef: true,
      defaultValue,
    };
  }

  // Handle ref pattern: Type& name
  const refMatch = paramStr.match(/^(.+?)\s*&\s*(\w+)$/);
  if (refMatch) {
    return {
      type: refMatch[1].trim(),
      name: refMatch[2],
      isConst: false,
      isRef: true,
      defaultValue,
    };
  }

  // Handle value pattern: Type name
  const valueMatch = paramStr.match(/^(.+?)\s+(\w+)$/);
  if (valueMatch) {
    const type = valueMatch[1].trim();
    return {
      type: type.replace(/^const\s+/, ''),
      name: valueMatch[2],
      isConst: type.startsWith('const'),
      isRef: false,
      defaultValue,
    };
  }

  return null;
}

/**
 * Group functions by name (for overload handling)
 */
export function groupByName(functions: CppFunction[]): Map<string, CppFunction[]> {
  const groups = new Map<string, CppFunction[]>();

  for (const fn of functions) {
    const existing = groups.get(fn.name) || [];
    existing.push(fn);
    groups.set(fn.name, existing);
  }

  return groups;
}

/**
 * Get the "best" overload for JavaScript binding
 * Prefers overloads with more optional parameters
 */
export function selectBestOverload(overloads: CppFunction[]): CppFunction {
  // Sort by number of required params (fewer = more flexible)
  return overloads.sort((a, b) => {
    const aRequired = a.params.filter(p => !p.defaultValue).length;
    const bRequired = b.params.filter(p => !p.defaultValue).length;
    return aRequired - bRequired;
  })[0];
}

/**
 * Map C++ type to N-API conversion function
 */
export function cppTypeToNapi(type: string): { toNapi: string; fromNapi: string } {
  const typeMap: Record<string, { toNapi: string; fromNapi: string }> = {
    'array': { toNapi: 'ArrayToNapi', fromNapi: 'NapiToArray' },
    'Shape': { toNapi: 'ShapeToNapi', fromNapi: 'NapiToShape' },
    'Dtype': { toNapi: 'DtypeToNapi', fromNapi: 'NapiToDtype' },
    'StreamOrDevice': { toNapi: '', fromNapi: 'NapiToStreamOrDevice' },
    'int': { toNapi: 'Napi::Number::New', fromNapi: '.As<Napi::Number>().Int32Value()' },
    'float': { toNapi: 'Napi::Number::New', fromNapi: '.As<Napi::Number>().FloatValue()' },
    'double': { toNapi: 'Napi::Number::New', fromNapi: '.As<Napi::Number>().DoubleValue()' },
    'bool': { toNapi: 'Napi::Boolean::New', fromNapi: '.As<Napi::Boolean>().Value()' },
    'std::string': { toNapi: 'Napi::String::New', fromNapi: '.As<Napi::String>().Utf8Value()' },
    'std::vector<int>': { toNapi: 'VecIntToNapi', fromNapi: 'NapiToVecInt' },
    'std::vector<array>': { toNapi: 'VecArrayToNapi', fromNapi: 'NapiToVecArray' },
  };

  // Handle common patterns
  const cleanType = type.replace(/const\s+/g, '').trim();

  if (typeMap[cleanType]) {
    return typeMap[cleanType];
  }

  // Handle optional types
  if (cleanType.startsWith('std::optional<')) {
    const inner = cleanType.match(/std::optional<(.+)>/)?.[1] || '';
    return cppTypeToNapi(inner);
  }

  // Default
  return { toNapi: 'UNKNOWN', fromNapi: 'UNKNOWN' };
}
