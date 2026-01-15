/**
 * Python Parser using Lezer
 *
 * Parses Python test files and extracts test methods for conversion.
 * Pure JavaScript - no native compilation required.
 */

import { parser } from '@lezer/python';
import { SyntaxNode, Tree } from '@lezer/common';

export interface TestMethod {
  name: string;
  body: SyntaxNode;
  source: string;
}

export interface TestClass {
  name: string;
  methods: TestMethod[];
}

/**
 * Extract test classes and methods from Python source
 */
export function extractTests(source: string): TestClass[] {
  const tree = parser.parse(source);
  const classes: TestClass[] = [];

  // Walk the tree to find class definitions
  function walk(node: SyntaxNode): void {
    if (node.type.name === 'ClassDefinition') {
      const nameNode = node.getChild('VariableName');
      const bodyNode = node.getChild('Body');

      if (nameNode) {
        const className = source.slice(nameNode.from, nameNode.to);

        if (className.startsWith('Test') && bodyNode) {
          const methods: TestMethod[] = [];

          // Find all function definitions in the class body
          for (let child = bodyNode.firstChild; child; child = child.nextSibling) {
            if (child.type.name === 'FunctionDefinition') {
              const methodNameNode = child.getChild('VariableName');
              if (methodNameNode) {
                const methodName = source.slice(methodNameNode.from, methodNameNode.to);
                if (methodName.startsWith('test_')) {
                  const methodBody = child.getChild('Body');
                  if (methodBody) {
                    methods.push({
                      name: methodName,
                      body: methodBody,
                      source: source.slice(child.from, child.to),
                    });
                  }
                }
              }
            }
          }

          if (methods.length > 0) {
            classes.push({ name: className, methods });
          }
        }
      }
    }

    // Recurse into children
    for (let child = node.firstChild; child; child = child.nextSibling) {
      walk(child);
    }
  }

  walk(tree.topNode);
  return classes;
}

export type StatementType =
  | 'assignment'
  | 'expression'
  | 'assert'
  | 'for'
  | 'with'
  | 'if'
  | 'return';

export interface Statement {
  type: StatementType;
  text: string;
  node: SyntaxNode;
  // For assertions
  assertType?: string;
  assertArgs?: string[];
  // For control structures
  children?: Statement[];
  // For assignments
  target?: string;
  value?: string;
  // For for loops
  loopVar?: string;
  iterable?: string;
  // For if statements
  condition?: string;
  // For with statements
  contextExpr?: string;
}

/**
 * Parse statements from a function body
 */
export function parseStatements(body: SyntaxNode, source: string): Statement[] {
  const statements: Statement[] = [];

  for (let child = body.firstChild; child; child = child.nextSibling) {
    const stmt = parseStatement(child, source);
    if (stmt) {
      statements.push(stmt);
    }
  }

  return statements;
}

function parseStatement(node: SyntaxNode, source: string): Statement | null {
  const text = source.slice(node.from, node.to);

  switch (node.type.name) {
    case 'ExpressionStatement': {
      const expr = node.firstChild;
      if (expr?.type.name === 'CallExpression') {
        const func = expr.getChild('MemberExpression');
        if (func) {
          const obj = func.getChild('VariableName');
          const prop = func.getChild('PropertyName');
          if (obj && prop) {
            const objName = source.slice(obj.from, obj.to);
            const propName = source.slice(prop.from, prop.to);

            // Check for self.assert* calls
            if (objName === 'self' && propName.startsWith('assert')) {
              const args = parseCallArgs(expr.getChild('ArgList'), source);
              return {
                type: 'assert',
                text,
                node,
                assertType: propName,
                assertArgs: args,
              };
            }
          }
        }
      }
      return { type: 'expression', text, node };
    }

    case 'AssignStatement': {
      const targets = node.getChild('VariableName');
      const value = node.lastChild;
      return {
        type: 'assignment',
        text,
        node,
        target: targets ? source.slice(targets.from, targets.to) : undefined,
        value: value ? source.slice(value.from, value.to) : undefined,
      };
    }

    case 'ForStatement': {
      const loopVars = node.getChild('VariableName') || node.getChild('PatternList');
      const iterExpr = node.getChild('in')?.nextSibling;
      const bodyNode = node.getChild('Body');

      return {
        type: 'for',
        text,
        node,
        loopVar: loopVars ? source.slice(loopVars.from, loopVars.to) : undefined,
        iterable: iterExpr ? source.slice(iterExpr.from, iterExpr.to).replace(/:$/, '').trim() : undefined,
        children: bodyNode ? parseStatements(bodyNode, source) : [],
      };
    }

    case 'WithStatement': {
      const bodyNode = node.getChild('Body');

      // Find the context expression - it's the CallExpression or other expression after 'with'
      let contextExpr = '';
      for (let child = node.firstChild; child; child = child.nextSibling) {
        if (child.type.name === 'CallExpression' ||
            child.type.name === 'MemberExpression' ||
            child.type.name === 'VariableName') {
          contextExpr = source.slice(child.from, child.to);
          break;
        }
        // Also check WithClause for more complex with statements
        if (child.type.name === 'WithClause') {
          contextExpr = source.slice(child.from, child.to);
          break;
        }
      }

      return {
        type: 'with',
        text,
        node,
        contextExpr,
        children: bodyNode ? parseStatements(bodyNode, source) : [],
      };
    }

    case 'IfStatement': {
      const condNode = node.getChild('if')?.nextSibling;
      const bodyNode = node.getChild('Body');

      let condition = '';
      if (condNode && condNode.type.name !== 'Body') {
        condition = source.slice(condNode.from, condNode.to).replace(/:$/, '').trim();
      }

      return {
        type: 'if',
        text,
        node,
        condition,
        children: bodyNode ? parseStatements(bodyNode, source) : [],
      };
    }

    case 'ReturnStatement': {
      return { type: 'return', text, node };
    }

    case ':':
    case 'Comment':
      return null;

    default:
      // Handle other statement types as expressions
      if (node.type.name.endsWith('Statement')) {
        return { type: 'expression', text, node };
      }
      return null;
  }
}

function parseCallArgs(argList: SyntaxNode | null, source: string): string[] {
  if (!argList) return [];

  const args: string[] = [];
  for (let child = argList.firstChild; child; child = child.nextSibling) {
    if (child.type.name !== '(' && child.type.name !== ')' && child.type.name !== ',') {
      args.push(source.slice(child.from, child.to));
    }
  }
  return args;
}
