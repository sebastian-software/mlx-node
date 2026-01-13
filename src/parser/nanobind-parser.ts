/**
 * Nanobind C++ Binding Parser
 *
 * Parses nanobind C++ binding definitions and extracts:
 * - Function definitions (m.def)
 * - Class definitions (nb::class_)
 * - Enum definitions (nb::enum_)
 * - Module attributes (m.attr)
 */

import Parser from 'tree-sitter';
import Cpp from 'tree-sitter-cpp';

// Types for parsed bindings
export interface FunctionBinding {
  type: 'function';
  name: string;
  cppFunction?: string;
  signature?: string;
  docstring?: string;
  args: ArgumentInfo[];
}

export interface ArgumentInfo {
  name: string;
  hasDefault: boolean;
  defaultValue?: string;
  isKeywordOnly?: boolean;
}

export interface ClassBinding {
  type: 'class';
  name: string;
  cppClass: string;
  docstring?: string;
  methods: MethodBinding[];
  properties: PropertyBinding[];
}

export interface MethodBinding {
  name: string;
  cppMethod?: string;
  signature?: string;
  docstring?: string;
  args: ArgumentInfo[];
}

export interface PropertyBinding {
  name: string;
  readonly: boolean;
  getter?: string;
  setter?: string;
  docstring?: string;
}

export interface EnumBinding {
  type: 'enum';
  name: string;
  cppEnum: string;
  docstring?: string;
  values: { name: string; value?: string }[];
}

export interface ModuleAttribute {
  type: 'attribute';
  name: string;
  cppValue: string;
}

export type Binding = FunctionBinding | ClassBinding | EnumBinding | ModuleAttribute;

export class NanobindParser {
  private parser: Parser;
  private sourceCode: string = '';

  constructor() {
    this.parser = new Parser();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.parser.setLanguage(Cpp as any);
  }

  parse(code: string): Binding[] {
    this.sourceCode = code;
    const tree = this.parser.parse(code);
    const bindings: Binding[] = [];

    // Find all call expressions that match our patterns
    this.walkTree(tree.rootNode, (node) => {
      if (node.type === 'call_expression') {
        const binding = this.tryParseBinding(node);
        if (binding) {
          bindings.push(binding);
        }
      }
    });

    return bindings;
  }

  private walkTree(node: Parser.SyntaxNode, callback: (node: Parser.SyntaxNode) => void) {
    callback(node);
    for (const child of node.children) {
      this.walkTree(child, callback);
    }
  }

  private tryParseBinding(node: Parser.SyntaxNode): Binding | null {
    const callText = this.getNodeText(node);

    // Check for m.def(...) - function binding
    if (this.isMethodCall(node, 'def')) {
      return this.parseFunctionBinding(node);
    }

    // Check for nb::class_<...>(...) - class binding
    if (callText.includes('nb::class_<') || callText.includes('class_<')) {
      return this.parseClassBinding(node);
    }

    // Check for nb::enum_<...>(...) - enum binding
    if (callText.includes('nb::enum_<') || callText.includes('enum_<')) {
      return this.parseEnumBinding(node);
    }

    // Check for m.attr(...) - module attribute
    if (this.isMethodCall(node, 'attr')) {
      return this.parseAttributeBinding(node);
    }

    return null;
  }

  private isMethodCall(node: Parser.SyntaxNode, methodName: string): boolean {
    const funcNode = node.childForFieldName('function');
    if (!funcNode) return false;

    // Check for field_expression like m.def
    if (funcNode.type === 'field_expression') {
      const field = funcNode.childForFieldName('field');
      if (field && this.getNodeText(field) === methodName) {
        return true;
      }
    }
    return false;
  }

  private parseFunctionBinding(node: Parser.SyntaxNode): FunctionBinding | null {
    const args = node.childForFieldName('arguments');
    if (!args) return null;

    const argChildren = args.children.filter(c =>
      c.type !== '(' && c.type !== ')' && c.type !== ','
    );

    if (argChildren.length < 2) return null;

    // First arg is function name (string literal)
    const nameNode = argChildren[0];
    const name = this.extractStringLiteral(nameNode);
    if (!name) return null;

    const binding: FunctionBinding = {
      type: 'function',
      name,
      args: [],
    };

    // Parse remaining arguments
    for (let i = 1; i < argChildren.length; i++) {
      const arg = argChildren[i];
      const argText = this.getNodeText(arg);

      // Check for nb::sig("def ...")
      if (argText.includes('nb::sig(') || argText.includes('sig(')) {
        binding.signature = this.extractSignature(arg) ?? undefined;
      }

      // Check for docstring R"pbdoc(...)pbdoc"
      if (argText.includes('R"pbdoc(')) {
        binding.docstring = this.extractDocstring(arg) ?? undefined;
      }

      // Check for C++ function reference
      if (argText.startsWith('&')) {
        binding.cppFunction = argText.slice(1);
      }

      // Parse argument specs like "name"_a = default
      if (argText.includes('_a')) {
        const argInfo = this.parseArgumentSpec(arg);
        if (argInfo) {
          binding.args.push(argInfo);
        }
      }

      // Check for nb::kw_only()
      if (argText.includes('kw_only()')) {
        // Mark subsequent args as keyword-only
        binding.args.forEach((a, idx) => {
          if (idx >= binding.args.length - 1) {
            a.isKeywordOnly = true;
          }
        });
      }
    }

    return binding;
  }

  private parseClassBinding(node: Parser.SyntaxNode): ClassBinding | null {
    const text = this.getNodeText(node);

    // Extract C++ class from template: nb::class_<mx::Array>
    const classMatch = text.match(/class_<([^>]+)>/);
    if (!classMatch) return null;

    const args = node.childForFieldName('arguments');
    if (!args) return null;

    const argChildren = args.children.filter(c =>
      c.type !== '(' && c.type !== ')' && c.type !== ','
    );

    // Python class name is the second argument (string literal)
    let name = '';
    for (const arg of argChildren) {
      const str = this.extractStringLiteral(arg);
      if (str) {
        name = str;
        break;
      }
    }

    const binding: ClassBinding = {
      type: 'class',
      name: name || classMatch[1].split('::').pop() || '',
      cppClass: classMatch[1],
      methods: [],
      properties: [],
    };

    // Extract docstring
    for (const arg of argChildren) {
      const doc = this.extractDocstring(arg);
      if (doc) {
        binding.docstring = doc;
        break;
      }
    }

    return binding;
  }

  private parseEnumBinding(node: Parser.SyntaxNode): EnumBinding | null {
    const text = this.getNodeText(node);

    // Extract C++ enum from template: nb::enum_<mx::Dtype::Category>
    const enumMatch = text.match(/enum_<([^>]+)>/);
    if (!enumMatch) return null;

    const args = node.childForFieldName('arguments');
    if (!args) return null;

    const argChildren = args.children.filter(c =>
      c.type !== '(' && c.type !== ')' && c.type !== ','
    );

    // Python enum name is typically the second argument
    let name = '';
    for (const arg of argChildren) {
      const str = this.extractStringLiteral(arg);
      if (str) {
        name = str;
        break;
      }
    }

    return {
      type: 'enum',
      name: name || enumMatch[1].split('::').pop() || '',
      cppEnum: enumMatch[1],
      values: [], // Would need to parse .value() chains
    };
  }

  private parseAttributeBinding(node: Parser.SyntaxNode): ModuleAttribute | null {
    const args = node.childForFieldName('arguments');
    if (!args) return null;

    const argChildren = args.children.filter(c =>
      c.type !== '(' && c.type !== ')' && c.type !== ','
    );

    if (argChildren.length < 1) return null;

    const name = this.extractStringLiteral(argChildren[0]);
    if (!name) return null;

    // Need to find the assignment: m.attr("name") = value
    // This is tricky because the value is outside the call expression
    // For now, return a placeholder
    return {
      type: 'attribute',
      name,
      cppValue: '', // Would need to look at parent assignment
    };
  }

  private extractStringLiteral(node: Parser.SyntaxNode): string | null {
    const text = this.getNodeText(node);

    // Handle "string" format
    const match = text.match(/^"([^"]*)"$/);
    if (match) return match[1];

    // Handle raw string R"(...)"
    const rawMatch = text.match(/^R"([^(]*)\(([\s\S]*)\)\1"$/);
    if (rawMatch) return rawMatch[2];

    return null;
  }

  private extractSignature(node: Parser.SyntaxNode): string | null {
    const text = this.getNodeText(node);

    // Extract from nb::sig("def foo(...) -> type")
    const match = text.match(/sig\s*\(\s*"([^"]+)"\s*\)/);
    if (match) return match[1];

    return null;
  }

  private extractDocstring(node: Parser.SyntaxNode): string | null {
    const text = this.getNodeText(node);

    // Extract from R"pbdoc(...)pbdoc"
    const match = text.match(/R"pbdoc\(([\s\S]*?)\)pbdoc"/);
    if (match) return match[1].trim();

    return null;
  }

  private parseArgumentSpec(node: Parser.SyntaxNode): ArgumentInfo | null {
    const text = this.getNodeText(node);

    // Parse patterns like:
    // "name"_a
    // "name"_a = default
    // nb::arg()

    // Named argument with literal
    const namedMatch = text.match(/"([^"]+)"_a(?:\s*=\s*(.+))?/);
    if (namedMatch) {
      return {
        name: namedMatch[1],
        hasDefault: !!namedMatch[2],
        defaultValue: namedMatch[2]?.trim(),
      };
    }

    // Positional argument nb::arg()
    if (text.includes('nb::arg()') || text.includes('arg()')) {
      return {
        name: '',
        hasDefault: false,
      };
    }

    return null;
  }

  private getNodeText(node: Parser.SyntaxNode): string {
    return this.sourceCode.slice(node.startIndex, node.endIndex);
  }
}
