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

export interface MethodBinding {
  name: string;
  cppMethod?: string;
  signature?: string;
  docstring?: string;
  isStatic: boolean;
  isConstructor: boolean;
}

export interface PropertyBinding {
  name: string;
  readonly: boolean;
  docstring?: string;
}

export interface ClassBinding {
  type: 'class';
  name: string;
  cppClass: string;
  docstring?: string;
  methods: MethodBinding[];
  properties: PropertyBinding[];
  constructors: MethodBinding[];
}

export interface EnumBinding {
  type: 'enum';
  name: string;
  cppEnum: string;
  docstring?: string;
  methods: MethodBinding[];  // Enums can have methods like __eq__
}

export interface ModuleAttribute {
  type: 'attribute';
  name: string;
  value: string;
}

export interface SubmoduleBinding {
  type: 'submodule';
  name: string;
  fullName: string;
  functions: FunctionBinding[];
}

export type Binding = FunctionBinding | ClassBinding | EnumBinding | ModuleAttribute | SubmoduleBinding;

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

    // Parse submodules: m.def_submodule("name", ...) with their functions
    bindings.push(...this.parseSubmodules(code));

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
    const classVars: Map<string, ClassBinding> = new Map();

    // Match nb::class_<CppType>(m, "PyName", ...)
    // Also capture optional variable assignment: auto/const varname = nb::class_<...>
    const classPattern = /(?:(?:auto|const\s+auto)\s+(\w+)\s*=\s*)?nb::class_<([^>]+)>\s*\(\s*\w+\s*,\s*"([^"]+)"/g;
    let match;

    while ((match = classPattern.exec(code)) !== null) {
      const varName = match[1]; // May be undefined if no variable assignment
      const cppClass = match[2];
      const pyName = match[3];
      const startPos = match.index;

      // Find the entire class definition chain (including all .def() calls)
      const classChain = this.extractClassChain(code, startPos);

      const binding: ClassBinding = {
        type: 'class',
        name: pyName,
        cppClass: cppClass,
        methods: [],
        properties: [],
        constructors: [],
      };

      if (classChain) {
        // Extract docstring from initial class definition
        const docMatch = classChain.match(/R"pbdoc\(([\s\S]*?)\)pbdoc"/);
        if (docMatch) {
          binding.docstring = docMatch[1].trim();
        }

        // Parse methods: .def("name", ...)
        this.parseClassMethods(classChain, binding);

        // Parse properties: .def_prop_ro("name", ...) / .def_prop_rw("name", ...)
        this.parseClassProperties(classChain, binding);

        // Parse constructors: .def(nb::init<...>())
        this.parseClassConstructors(classChain, binding);
      }

      // Track variable name for later method additions
      if (varName) {
        classVars.set(varName, binding);
      }

      classes.push(binding);
    }

    // Find additional method chains added via variable references
    // Pattern: varname.def(...) or varname\n    .def(...)
    for (const [varName, binding] of classVars) {
      // Find patterns like: varname.def(...) or varname\s+.def(...)
      const varMethodPattern = new RegExp(
        `${varName}\\s*\\.def`,
        'g'
      );
      let varMatch;
      while ((varMatch = varMethodPattern.exec(code)) !== null) {
        // Extract the method chain starting from this position
        const chainStart = varMatch.index + varName.length;
        // Find the first .def( and extract from there
        const dotPos = code.indexOf('.', chainStart);
        if (dotPos !== -1) {
          const methodChain = this.extractMethodChain(code, dotPos);
          if (methodChain) {
            this.parseClassMethods(methodChain, binding);
            this.parseClassProperties(methodChain, binding);
            this.parseClassConstructors(methodChain, binding);
          }
        }
      }
    }

    return classes;
  }

  /**
   * Extract a chain of method calls starting from a dot position
   */
  private extractMethodChain(code: string, dotPos: number): string | null {
    let pos = dotPos;
    let result = '';

    while (pos < code.length) {
      // Should be at a '.'
      if (code[pos] !== '.') break;

      // Find the method name and opening paren
      const methodMatch = code.slice(pos).match(/^\.(\w+)\s*\(/);
      if (!methodMatch) break;

      result += code.slice(pos, pos + methodMatch[0].length - 1);
      pos += methodMatch[0].length - 1;

      // Extract balanced parentheses
      const parenContent = this.extractBalancedParens(code, pos);
      if (!parenContent) break;

      result += parenContent;
      pos += parenContent.length;

      // Skip whitespace
      while (pos < code.length && /\s/.test(code[pos])) pos++;

      // Check if chain continues
      if (code[pos] !== '.') break;
    }

    return result || null;
  }

  private extractClassChain(code: string, startPos: number): string | null {
    // Find the nb::class_<...>(...) part first
    const parenStart = code.indexOf('(', startPos);
    if (parenStart === -1) return null;

    let pos = parenStart;
    let result = code.slice(startPos, parenStart);

    // Keep consuming .xxx(...) chains
    while (pos < code.length) {
      const parenContent = this.extractBalancedParens(code, pos);
      if (!parenContent) break;

      result += parenContent;
      pos += parenContent.length;

      // Skip whitespace
      while (pos < code.length && /\s/.test(code[pos])) pos++;

      // Check for continuation with .
      if (code[pos] === '.') {
        // Find the method name
        const methodMatch = code.slice(pos).match(/^\.(\w+)\s*\(/);
        if (methodMatch) {
          result += code.slice(pos, pos + methodMatch[0].length - 1);
          pos += methodMatch[0].length - 1;
        } else {
          break;
        }
      } else {
        break;
      }
    }

    return result;
  }

  private parseClassMethods(classChain: string, binding: ClassBinding): void {
    // Match .def("name", ...) but not .def_prop_ro, .def_static, etc.
    const methodPattern = /\.def\s*\(\s*"([^"]+)"/g;
    let match;

    while ((match = methodPattern.exec(classChain)) !== null) {
      // Skip patterns like .def_ro, .def_rw, .def_static, .def_prop_ro, etc.
      if (classChain.slice(match.index, match.index + 5).match(/\.def_/)) continue;

      const methodStart = match.index;
      const methodDef = this.extractBalancedParens(classChain, classChain.indexOf('(', methodStart));

      const method: MethodBinding = {
        name: match[1],
        isStatic: false,
        isConstructor: false,
      };

      if (methodDef) {
        // Extract C++ method reference
        const cppMatch = methodDef.match(/&(\w+(?:::\w+)*)/);
        if (cppMatch) {
          method.cppMethod = cppMatch[1];
        }

        // Extract docstring
        const docMatch = methodDef.match(/R"pbdoc\(([\s\S]*?)\)pbdoc"/);
        if (docMatch) {
          method.docstring = docMatch[1].trim();
        }

        // Extract signature
        const sigMatch = methodDef.match(/nb::sig\s*\(\s*"([^"]+)"\s*\)/);
        if (sigMatch) {
          method.signature = sigMatch[1];
        }
      }

      binding.methods.push(method);
    }

    // Match .def_static("name", ...)
    const staticPattern = /\.def_static\s*\(\s*"([^"]+)"/g;
    while ((match = staticPattern.exec(classChain)) !== null) {
      const methodStart = match.index;
      const methodDef = this.extractBalancedParens(classChain, classChain.indexOf('(', methodStart));

      const method: MethodBinding = {
        name: match[1],
        isStatic: true,
        isConstructor: false,
      };

      if (methodDef) {
        const docMatch = methodDef.match(/R"pbdoc\(([\s\S]*?)\)pbdoc"/);
        if (docMatch) {
          method.docstring = docMatch[1].trim();
        }
      }

      binding.methods.push(method);
    }
  }

  private parseClassProperties(classChain: string, binding: ClassBinding): void {
    // Match .def_prop_ro("name", ...) and .def_prop_rw("name", ...)
    const propPattern = /\.def_prop_(ro|rw)\s*\(\s*"([^"]+)"/g;
    let match;

    while ((match = propPattern.exec(classChain)) !== null) {
      const propStart = match.index;
      const propDef = this.extractBalancedParens(classChain, classChain.indexOf('(', propStart));

      const prop: PropertyBinding = {
        name: match[2],
        readonly: match[1] === 'ro',
      };

      if (propDef) {
        const docMatch = propDef.match(/R"pbdoc\(([\s\S]*?)\)pbdoc"/);
        if (docMatch) {
          prop.docstring = docMatch[1].trim();
        }
      }

      binding.properties.push(prop);
    }

    // Also match .def_ro("name", ...) and .def_rw("name", ...) for fields
    const fieldPattern = /\.def_(ro|rw)\s*\(\s*"([^"]+)"/g;
    while ((match = fieldPattern.exec(classChain)) !== null) {
      // Skip if this is def_prop_ro/rw
      if (classChain.slice(match.index - 5, match.index).includes('prop')) continue;

      const prop: PropertyBinding = {
        name: match[2],
        readonly: match[1] === 'ro',
      };

      binding.properties.push(prop);
    }
  }

  private parseClassConstructors(classChain: string, binding: ClassBinding): void {
    // Match .def(nb::init<...>()) and .def(nb::init_implicit<...>())
    const initPattern = /\.def\s*\(\s*nb::init(?:_implicit)?<([^>]*)>/g;
    let match;

    while ((match = initPattern.exec(classChain)) !== null) {
      const ctor: MethodBinding = {
        name: '__init__',
        isStatic: false,
        isConstructor: true,
      };

      // Parse constructor argument types
      const argTypes = match[1].split(',').map(t => t.trim()).filter(t => t);
      if (argTypes.length > 0) {
        ctor.signature = `def __init__(self, ${argTypes.map((t, i) => `arg${i}: ${t}`).join(', ')})`;
      }

      binding.constructors.push(ctor);
    }
  }

  private parseEnums(code: string): EnumBinding[] {
    const enums: EnumBinding[] = [];

    // Match nb::enum_<CppType>(m, "PyName", ...)
    const enumPattern = /nb::enum_<([^>]+)>\s*\(\s*\w+\s*,\s*"([^"]+)"/g;
    let match;

    while ((match = enumPattern.exec(code)) !== null) {
      const startPos = match.index;

      // Extract the full enum chain including .value() and .def() calls
      const enumChain = this.extractEnumChain(code, startPos);

      const binding: EnumBinding = {
        type: 'enum',
        name: match[2],
        cppEnum: match[1],
        methods: [],
      };

      if (enumChain) {
        const docMatch = enumChain.match(/R"pbdoc\(([\s\S]*?)\)pbdoc"/);
        if (docMatch) {
          binding.docstring = docMatch[1].trim();
        }

        // Parse any methods defined on the enum (like __eq__)
        this.parseEnumMethods(enumChain, binding);
      }

      enums.push(binding);
    }

    return enums;
  }

  private extractEnumChain(code: string, startPos: number): string | null {
    // Similar to extractClassChain but for enums
    const parenStart = code.indexOf('(', startPos);
    if (parenStart === -1) return null;

    let pos = parenStart;
    let result = code.slice(startPos, parenStart);

    // Keep consuming .xxx(...) chains (.value, .def, .export_values, etc.)
    while (pos < code.length) {
      const parenContent = this.extractBalancedParens(code, pos);
      if (!parenContent) break;

      result += parenContent;
      pos += parenContent.length;

      // Skip whitespace
      while (pos < code.length && /\s/.test(code[pos])) pos++;

      // Check for continuation with .
      if (code[pos] === '.') {
        // Find the method name
        const methodMatch = code.slice(pos).match(/^\.(\w+)\s*\(/);
        if (methodMatch) {
          result += code.slice(pos, pos + methodMatch[0].length - 1);
          pos += methodMatch[0].length - 1;
        } else {
          // Handle .export_values() with no args or similar
          const noArgMatch = code.slice(pos).match(/^\.(\w+)\s*\(\s*\)/);
          if (noArgMatch) {
            result += noArgMatch[0];
            pos += noArgMatch[0].length;
          } else {
            break;
          }
        }
      } else {
        break;
      }
    }

    return result;
  }

  private parseEnumMethods(enumChain: string, binding: EnumBinding): void {
    // Match .def("name", ...) on enums (like __eq__)
    const methodPattern = /\.def\s*\(\s*"([^"]+)"/g;
    let match;

    while ((match = methodPattern.exec(enumChain)) !== null) {
      // Skip patterns like .def_ro, .def_static (shouldn't appear on enums but be safe)
      if (enumChain.slice(match.index, match.index + 5).match(/\.def_/)) continue;

      const methodStart = match.index;
      const methodDef = this.extractBalancedParens(enumChain, enumChain.indexOf('(', methodStart));

      const method: MethodBinding = {
        name: match[1],
        isStatic: false,
        isConstructor: false,
      };

      if (methodDef) {
        // Extract docstring
        const docMatch = methodDef.match(/R"pbdoc\(([\s\S]*?)\)pbdoc"/);
        if (docMatch) {
          method.docstring = docMatch[1].trim();
        }
      }

      binding.methods.push(method);
    }
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

  private parseSubmodules(code: string): SubmoduleBinding[] {
    const submodules: SubmoduleBinding[] = [];

    // Match patterns like:
    // nb::module_ varname = m.def_submodule("name", "full.name");
    // auto varname = parent.def_submodule("name", "full.name");
    const submodulePattern = /(?:nb::module_|auto)\s+(\w+)\s*=\s*\w+\.def_submodule\s*\(\s*"([^"]+)"\s*,\s*"([^"]+)"/g;
    let match;

    while ((match = submodulePattern.exec(code)) !== null) {
      const varName = match[1];
      const name = match[2];
      const fullName = match[3];

      const binding: SubmoduleBinding = {
        type: 'submodule',
        name,
        fullName,
        functions: [],
      };

      // Find all varname.def("funcname", ...) patterns for this submodule
      const funcPattern = new RegExp(`${varName}\\.def\\s*\\(\\s*"([^"]+)"`, 'g');
      let funcMatch;

      while ((funcMatch = funcPattern.exec(code)) !== null) {
        const funcName = funcMatch[1];
        const funcStart = funcMatch.index;

        // Extract the full definition
        const parenStart = code.indexOf('(', funcStart + varName.length);
        const fullDef = this.extractBalancedParens(code, parenStart);

        const funcBinding: FunctionBinding = {
          type: 'function',
          name: funcName,
          isLambda: fullDef ? (fullDef.includes('[](') || fullDef.includes('[]<')) : false,
          rawDefinition: fullDef || '',
        };

        if (fullDef) {
          // Extract signature
          const sigMatch = fullDef.match(/nb::sig\s*\(\s*"([^"]+)"\s*\)/);
          if (sigMatch) {
            funcBinding.signature = sigMatch[1];
          }

          // Extract C++ function reference
          const fnRefMatch = fullDef.match(/&(mx::\w+(?:::\w+)*)/);
          if (fnRefMatch && !funcBinding.isLambda) {
            funcBinding.cppFunction = fnRefMatch[1];
          }

          // Extract docstring
          const docMatch = fullDef.match(/R"pbdoc\(([\s\S]*?)\)pbdoc"/);
          if (docMatch) {
            funcBinding.docstring = docMatch[1].trim();
          }
        }

        binding.functions.push(funcBinding);
      }

      submodules.push(binding);
    }

    return submodules;
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
