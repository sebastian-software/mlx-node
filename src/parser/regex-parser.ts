/**
 * Regex-based Nanobind Parser
 *
 * Parses nanobind C++ binding definitions using regex patterns.
 * This is more robust for our use case than tree-sitter since
 * nanobind has very predictable patterns.
 */

export interface FunctionBinding {
  type: 'function';
  name: string;
  cppFunction?: string;
  signature?: string;
  docstring?: string;
  isLambda: boolean;
  rawDefinition: string;
}

export interface ClassBinding {
  type: 'class';
  name: string;
  cppClass: string;
  docstring?: string;
}

export interface EnumBinding {
  type: 'enum';
  name: string;
  cppEnum: string;
  docstring?: string;
}

export interface ModuleAttribute {
  type: 'attribute';
  name: string;
  value: string;
}

export type Binding = FunctionBinding | ClassBinding | EnumBinding | ModuleAttribute;

export class NanobindRegexParser {
  /**
   * Parse nanobind bindings from C++ source code
   */
  parse(code: string): Binding[] {
    const bindings: Binding[] = [];

    // Parse function definitions: m.def("name", ...)
    bindings.push(...this.parseFunctions(code));

    // Parse class definitions: nb::class_<T>(m, "Name", ...)
    bindings.push(...this.parseClasses(code));

    // Parse enum definitions: nb::enum_<T>(m, "Name", ...)
    bindings.push(...this.parseEnums(code));

    // Parse module attributes: m.attr("name") = ...
    bindings.push(...this.parseAttributes(code));

    return bindings;
  }

  private parseFunctions(code: string): FunctionBinding[] {
    const functions: FunctionBinding[] = [];

    // Match m.def( patterns and capture until the closing );
    // This uses a state machine approach to handle nested parentheses
    const defPattern = /m\.def\s*\(\s*"([^"]+)"/g;
    let match;

    while ((match = defPattern.exec(code)) !== null) {
      const name = match[1];
      const startPos = match.index;

      // Find the full m.def(...) block
      const fullDef = this.extractBalancedParens(code, startPos + match[0].indexOf('('));

      if (fullDef) {
        const binding: FunctionBinding = {
          type: 'function',
          name,
          isLambda: fullDef.includes('[](') || fullDef.includes('[]<'),
          rawDefinition: fullDef,
        };

        // Extract nb::sig("def ...")
        const sigMatch = fullDef.match(/nb::sig\s*\(\s*"([^"]+)"\s*\)/);
        if (sigMatch) {
          binding.signature = sigMatch[1];
        }

        // Extract C++ function reference &mx::function
        const fnRefMatch = fullDef.match(/&(mx::\w+(?:::\w+)*)/);
        if (fnRefMatch && !binding.isLambda) {
          binding.cppFunction = fnRefMatch[1];
        }

        // Extract docstring R"pbdoc(...)pbdoc"
        const docMatch = fullDef.match(/R"pbdoc\(([\s\S]*?)\)pbdoc"/);
        if (docMatch) {
          binding.docstring = docMatch[1].trim();
        }

        functions.push(binding);
      }
    }

    return functions;
  }

  private parseClasses(code: string): ClassBinding[] {
    const classes: ClassBinding[] = [];

    // Match nb::class_<CppType>(m, "PyName", ...)
    const classPattern = /nb::class_<([^>]+)>\s*\(\s*\w+\s*,\s*"([^"]+)"/g;
    let match;

    while ((match = classPattern.exec(code)) !== null) {
      const startPos = match.index;
      const fullDef = this.extractBalancedParens(code, code.indexOf('(', startPos));

      const binding: ClassBinding = {
        type: 'class',
        name: match[2],
        cppClass: match[1],
      };

      // Extract docstring
      if (fullDef) {
        const docMatch = fullDef.match(/R"pbdoc\(([\s\S]*?)\)pbdoc"/);
        if (docMatch) {
          binding.docstring = docMatch[1].trim();
        }
      }

      classes.push(binding);
    }

    return classes;
  }

  private parseEnums(code: string): EnumBinding[] {
    const enums: EnumBinding[] = [];

    // Match nb::enum_<CppType>(m, "PyName", ...)
    const enumPattern = /nb::enum_<([^>]+)>\s*\(\s*\w+\s*,\s*"([^"]+)"/g;
    let match;

    while ((match = enumPattern.exec(code)) !== null) {
      const startPos = match.index;
      const fullDef = this.extractBalancedParens(code, code.indexOf('(', startPos));

      const binding: EnumBinding = {
        type: 'enum',
        name: match[2],
        cppEnum: match[1],
      };

      if (fullDef) {
        const docMatch = fullDef.match(/R"pbdoc\(([\s\S]*?)\)pbdoc"/);
        if (docMatch) {
          binding.docstring = docMatch[1].trim();
        }
      }

      enums.push(binding);
    }

    return enums;
  }

  private parseAttributes(code: string): ModuleAttribute[] {
    const attrs: ModuleAttribute[] = [];

    // Match m.attr("name") = value;
    const attrPattern = /m\.attr\s*\(\s*"([^"]+)"\s*\)\s*=\s*([^;]+);/g;
    let match;

    while ((match = attrPattern.exec(code)) !== null) {
      attrs.push({
        type: 'attribute',
        name: match[1],
        value: match[2].trim(),
      });
    }

    return attrs;
  }

  /**
   * Extract content within balanced parentheses starting at the given position
   */
  private extractBalancedParens(code: string, startPos: number): string | null {
    if (code[startPos] !== '(') return null;

    let depth = 0;
    let inString = false;
    let stringChar = '';
    let inRawString = false;
    let rawDelimiter = '';

    for (let i = startPos; i < code.length; i++) {
      const char = code[i];
      const prevChar = i > 0 ? code[i - 1] : '';

      // Handle raw strings: R"delimiter(...)delimiter"
      if (!inString && code.slice(i, i + 2) === 'R"') {
        inRawString = true;
        // Find the delimiter
        const delimEnd = code.indexOf('(', i + 2);
        if (delimEnd !== -1) {
          rawDelimiter = code.slice(i + 2, delimEnd);
          i = delimEnd;
        }
        continue;
      }

      if (inRawString) {
        // Check for end of raw string: )delimiter"
        const endMarker = ')' + rawDelimiter + '"';
        if (code.slice(i, i + endMarker.length) === endMarker) {
          inRawString = false;
          i += endMarker.length - 1;
        }
        continue;
      }

      // Handle regular strings
      if ((char === '"' || char === "'") && prevChar !== '\\') {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
        }
        continue;
      }

      if (inString) continue;

      // Track parentheses depth
      if (char === '(') depth++;
      if (char === ')') {
        depth--;
        if (depth === 0) {
          return code.slice(startPos, i + 1);
        }
      }
    }

    return null;
  }
}

/**
 * Parse Python signature string to extract parameter info
 */
export interface ParsedSignature {
  name: string;
  params: SignatureParam[];
  returnType?: string;
}

export interface SignatureParam {
  name: string;
  type?: string;
  default?: string;
  isOptional: boolean;
  isKeywordOnly: boolean;
}

export function parseSignature(sig: string): ParsedSignature | null {
  // Parse: def name(param1: Type, param2: Type = default, /, *, kw_only: Type) -> ReturnType
  const match = sig.match(/def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*(.+))?/);
  if (!match) return null;

  const [, name, paramStr, returnType] = match;
  const params: SignatureParam[] = [];

  let isKeywordOnly = false;
  let seenSlash = false;

  // Split params, being careful about nested brackets
  const paramParts = splitParams(paramStr);

  for (const part of paramParts) {
    const trimmed = part.trim();

    if (trimmed === '/') {
      seenSlash = true;
      continue;
    }

    if (trimmed === '*') {
      isKeywordOnly = true;
      continue;
    }

    // Parse: name: Type = default
    const paramMatch = trimmed.match(/(\w+)(?:\s*:\s*([^=]+))?(?:\s*=\s*(.+))?/);
    if (paramMatch) {
      const [, pname, ptype, pdefault] = paramMatch;
      params.push({
        name: pname,
        type: ptype?.trim(),
        default: pdefault?.trim(),
        isOptional: !!pdefault || ptype?.includes('Optional') || ptype?.includes('None'),
        isKeywordOnly,
      });
    }
  }

  return {
    name,
    params,
    returnType: returnType?.trim(),
  };
}

function splitParams(paramStr: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;

  for (const char of paramStr) {
    if (char === '[' || char === '(') depth++;
    if (char === ']' || char === ')') depth--;

    if (char === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  if (current) parts.push(current);
  return parts;
}
