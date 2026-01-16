/**
 * AST-based Python to TypeScript Converter
 *
 * Uses the Lezer Python parser to walk the AST and generate TypeScript code.
 * This is a proper AST-based approach similar to Babel/ESTree transformations.
 */

import { parser } from '@lezer/python';
import { SyntaxNode } from '@lezer/common';

// Context passed through the visitor
export interface VisitorContext {
  source: string;
  declaredVars: Set<string>;
  indent: string;
  // Pre-evaluated numpy expressions (expr -> TypeScript value)
  numpyValues?: Map<string, string>;
}

// Python to TypeScript dtype mappings
const DTYPE_MAP: Record<string, string> = {
  // MLX dtypes
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
  // Numpy dtypes
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
  'np.complex64': "'complex64'",
  'np.complex128': "'complex64'", // MLX doesn't have complex128, use complex64
  // Numpy constants
  'np.inf': 'Infinity',
  'np.nan': 'NaN',
  'np.pi': 'Math.PI',
  'np.e': 'Math.E',
  'np.newaxis': 'null',
};

/**
 * Get the text content of a node
 */
function text(node: SyntaxNode, source: string): string {
  return source.slice(node.from, node.to);
}

/**
 * Get all children of a node as an array
 */
function children(node: SyntaxNode): SyntaxNode[] {
  const result: SyntaxNode[] = [];
  for (let child = node.firstChild; child; child = child.nextSibling) {
    result.push(child);
  }
  return result;
}

/**
 * Get children by type name
 */
function childrenByType(node: SyntaxNode, typeName: string): SyntaxNode[] {
  return children(node).filter(c => c.type.name === typeName);
}

/**
 * Visit a node and produce TypeScript code
 */
export function visit(node: SyntaxNode, ctx: VisitorContext): string {
  const nodeType = node.type.name;

  switch (nodeType) {
    // Literals
    case 'Number':
      return visitNumber(node, ctx);
    case 'String':
      return visitString(node, ctx);
    case 'True':
      return 'true';
    case 'False':
      return 'false';
    case 'Boolean':
      // Python Boolean node - convert True/False to true/false
      return text(node, ctx.source) === 'True' ? 'true' : 'false';
    case 'None':
      return 'null';

    // Identifiers
    case 'VariableName':
      return visitVariableName(node, ctx);
    case 'PropertyName':
      return text(node, ctx.source);

    // Expressions
    case 'MemberExpression':
      return visitMemberExpression(node, ctx);
    case 'CallExpression':
      return visitCallExpression(node, ctx);
    case 'BinaryExpression':
      return visitBinaryExpression(node, ctx);
    case 'UnaryExpression':
      return visitUnaryExpression(node, ctx);
    case 'CompareExpression':
      return visitCompareExpression(node, ctx);
    case 'ConditionalExpression':
      return visitConditionalExpression(node, ctx);
    case 'ParenthesizedExpression':
      return visitParenthesizedExpression(node, ctx);

    // Lambda
    case 'LambdaExpression':
      return visitLambdaExpression(node, ctx);

    // Collections
    case 'ArrayExpression':
      return visitArrayExpression(node, ctx);
    case 'DictionaryExpression':
      return visitDictionaryExpression(node, ctx);
    case 'TupleExpression':
      return visitTupleExpression(node, ctx);
    case 'SetExpression':
      return visitSetExpression(node, ctx);

    // Comprehensions
    case 'ArrayComprehensionExpression':
      return visitArrayComprehension(node, ctx);
    case 'DictionaryComprehensionExpression':
      return visitDictionaryComprehension(node, ctx);
    case 'SetComprehensionExpression':
      return visitSetComprehension(node, ctx);
    case 'GeneratorExpression':
      return visitGeneratorExpression(node, ctx);

    // Subscript / Index
    case 'SubscriptExpression':
      return visitSubscriptExpression(node, ctx);

    // ArgList for function calls
    case 'ArgList':
      return visitArgList(node, ctx);

    // Script is the top-level node - visit its children
    case 'Script':
      return children(node).map(c => visit(c, ctx)).join('\n');

    // Statements (when visiting expressions within statements)
    case 'ExpressionStatement':
      return visitExpressionStatement(node, ctx);
    case 'AssignStatement':
      return visitAssignStatement(node, ctx);
    case 'UpdateStatement':
      return visitUpdateStatement(node, ctx);

    // Unconvertible Python constructs - mark them
    case 'ImportStatement':
    case 'ImportFromStatement':
      return `/* UNCONVERTED: ${text(node, ctx.source)} */`;
    case 'ClassDefinition':
      return `/* UNCONVERTED: class definition */`;
    case 'FunctionDefinition':
      return `/* UNCONVERTED: function definition */`;
    case 'WithStatement':
      return `/* UNCONVERTED: with statement */`;
    case 'TryStatement':
      return `/* UNCONVERTED: try statement */`;
    case 'AssertStatement':
      return `/* UNCONVERTED: assert - use expect() instead */`;

    // Spread/splat
    case 'SpreadExpression':
      return visitSpreadExpression(node, ctx);

    // Keywords
    case 'KeywordArgument':
      return visitKeywordArgument(node, ctx);

    // Slice
    case 'Slice':
      return visitSlice(node, ctx);

    // Special operators
    case 'ArithOp':
    case 'CompareOp':
    case 'BitOp':
      return text(node, ctx.source);

    // Skip punctuation
    case '(':
    case ')':
    case '[':
    case ']':
    case '{':
    case '}':
    case ',':
    case ':':
    case '.':
      return '';

    default:
      // For unknown nodes, return the raw text (fallback)
      return text(node, ctx.source);
  }
}

// ============================================================================
// Visitor Functions for Each Node Type
// ============================================================================

function visitNumber(node: SyntaxNode, ctx: VisitorContext): string {
  const num = text(node, ctx.source);
  // Handle complex number literals (e.g., 1j, 2.5j)
  if (num.endsWith('j')) {
    const imag = num.slice(0, -1);
    return `makeComplex(mx, 0, ${imag || '1'})`;
  }
  return num;
}

function visitString(node: SyntaxNode, ctx: VisitorContext): string {
  let str = text(node, ctx.source);
  // Handle Python f-strings (basic conversion)
  if (str.startsWith('f"') || str.startsWith("f'")) {
    str = str.slice(1); // Remove 'f' prefix
    // Convert {expr} to ${expr}
    str = str.replace(/\{([^}]+)\}/g, '${$1}');
    // Change quotes to backticks for template literal
    const quote = str[0];
    str = '`' + str.slice(1, -1) + '`';
  }
  return str;
}

function visitVariableName(node: SyntaxNode, ctx: VisitorContext): string {
  const name = text(node, ctx.source);
  // Handle Python builtins that map to JS
  switch (name) {
    case 'True':
      return 'true';
    case 'False':
      return 'false';
    case 'None':
      return 'null';
    default:
      return name;
  }
}

function visitMemberExpression(node: SyntaxNode, ctx: VisitorContext): string {
  const kids = children(node);

  // Check if this is a subscript expression (has [ ] brackets)
  const hasBrackets = kids.some(c => c.type.name === '[');
  if (hasBrackets) {
    return visitMemberAsSubscript(node, ctx);
  }

  // Format: object.property
  let obj = kids[0] ? visit(kids[0], ctx) : '';
  const prop = kids.find(c => c.type.name === 'PropertyName');
  const propName = prop ? text(prop, ctx.source) : '';

  // If the object was converted to a dtype string (like 'bool' or 'float32'),
  // but we're accessing a property on it, revert to the original object text.
  // This handles cases like mx.bool_.size where we don't want 'bool'.size
  if (obj.startsWith("'") && obj.endsWith("'") && kids[0]) {
    obj = text(kids[0], ctx.source);
  }

  // Handle dtype mappings like mx.float32 -> 'float32'
  // Only convert when this is the terminal expression (no further property access)
  const fullExpr = `${obj}.${propName}`;
  if (DTYPE_MAP[fullExpr]) {
    return DTYPE_MAP[fullExpr];
  }

  // Handle .T (transpose shorthand) -> mx.transpose(obj)
  if (propName === 'T') {
    return `mx.transpose(${obj})`;
  }

  return fullExpr;
}

/**
 * Convert slice expression components to proper string, handling len() calls
 */
function convertSliceExprForMember(indexNodes: SyntaxNode[], ctx: VisitorContext): string {
  let sliceExpr = indexNodes.map(c => text(c, ctx.source)).join('');

  // Check if the slice contains len() calls
  // Replace len(identifier) with ${identifier.length} and use template literal
  const lenPattern = /len\(([a-zA-Z_][a-zA-Z0-9_]*)\)/g;
  if (lenPattern.test(sliceExpr)) {
    // Need to use template literal for dynamic expressions
    sliceExpr = sliceExpr.replace(/len\(([a-zA-Z_][a-zA-Z0-9_]*)\)/g, '${$1.length}');
    return '`' + sliceExpr + '`';
  }

  return `'${sliceExpr}'`;
}

function visitMemberAsSubscript(node: SyntaxNode, ctx: VisitorContext): string {
  const kids = children(node);
  const obj = kids[0] ? visit(kids[0], ctx) : '';

  // Find the index part (everything inside [])
  const bracketStart = kids.findIndex(c => c.type.name === '[');
  const bracketEnd = kids.findIndex(c => c.type.name === ']');

  if (bracketStart === -1 || bracketEnd === -1) {
    return text(node, ctx.source);
  }

  const indexNodes = kids.slice(bracketStart + 1, bracketEnd);

  // Check if this is a slice (has ':' inside brackets)
  const hasSlice = indexNodes.some(c => c.type.name === ':' || c.type.name === 'Slice');

  if (hasSlice) {
    // Convert slice to pySlice call, handling len() expressions
    const sliceExprStr = convertSliceExprForMember(indexNodes, ctx);
    return `pySlice(mx, ${obj}, ${sliceExprStr})`;
  }

  // Regular index
  const index = indexNodes.map(c => visit(c, ctx)).join(', ');

  // Handle negative indexing
  if (/^-\d+$/.test(index)) {
    return `${obj}.at(${index})`;
  }

  return `${obj}[${index}]`;
}

function visitCallExpression(node: SyntaxNode, ctx: VisitorContext): string {
  const kids = children(node);
  const calleeNode = kids[0];
  const callee = calleeNode ? visit(calleeNode, ctx) : '';
  const argListNode = kids.find(c => c.type.name === 'ArgList');

  // Handle Python string.join(iterable) -> iterable.join(string)
  if (calleeNode?.type.name === 'MemberExpression') {
    const memberKids = children(calleeNode);
    const objNode = memberKids[0];
    const propNode = memberKids.find(c => c.type.name === 'PropertyName');
    if (objNode?.type.name === 'String' && propNode && text(propNode, ctx.source) === 'join') {
      const separator = visit(objNode, ctx);
      const args = argListNode ? visitArgListAsArray(argListNode, ctx) : [];
      if (args.length > 0) {
        return `${args[0]}.join(${separator})`;
      }
      return `[].join(${separator})`;
    }
  }

  // Special function handling
  switch (callee) {
    case 'len': {
      // len(x) -> x.length
      const args = argListNode ? visitArgListAsArray(argListNode, ctx) : [];
      return args.length > 0 ? `${args[0]}.length` : 'undefined';
    }
    case 'range': {
      // range(n) -> [...Array(n).keys()]
      const args = argListNode ? visitArgListAsArray(argListNode, ctx) : [];
      if (args.length === 1) {
        return `[...Array(${args[0]}).keys()]`;
      }
      // range(start, end) -> [...Array(end - start).keys()].map(i => i + start)
      if (args.length === 2) {
        return `[...Array(${args[1]} - ${args[0]}).keys()].map(i => i + ${args[0]})`;
      }
      return `[...Array(${args.join(', ')}).keys()]`;
    }
    case 'list': {
      // list(x) -> Array.from(x)
      const args = argListNode ? visitArgListAsArray(argListNode, ctx) : [];
      return args.length > 0 ? `Array.from(${args[0]})` : '[]';
    }
    case 'tuple': {
      // tuple(x) -> Array.from(x) (tuples become arrays in JS)
      const args = argListNode ? visitArgListAsArray(argListNode, ctx) : [];
      return args.length > 0 ? `Array.from(${args[0]})` : '[]';
    }
    case 'float': {
      // float("inf") -> Infinity, float("nan") -> NaN
      const args = argListNode ? visitArgListAsArray(argListNode, ctx) : [];
      if (args.length > 0) {
        if (args[0] === '"inf"' || args[0] === "'inf'") return 'Infinity';
        if (args[0] === '"-inf"' || args[0] === "'-inf'") return '-Infinity';
        if (args[0] === '"nan"' || args[0] === "'nan'") return 'NaN';
      }
      return `parseFloat(${args[0] || ''})`;
    }
    case 'int': {
      const args = argListNode ? visitArgListAsArray(argListNode, ctx) : [];
      return args.length > 0 ? `parseInt(${args[0]})` : '0';
    }
    case 'str': {
      const args = argListNode ? visitArgListAsArray(argListNode, ctx) : [];
      return args.length > 0 ? `String(${args[0]})` : '""';
    }
    case 'bool': {
      const args = argListNode ? visitArgListAsArray(argListNode, ctx) : [];
      return args.length > 0 ? `Boolean(${args[0]})` : 'false';
    }
    case 'copy':
    case 'deepcopy': {
      // copy(x) / deepcopy(x) -> new mx.array(x) for mlx arrays
      const args = argListNode ? visitArgListAsArray(argListNode, ctx) : [];
      return args.length > 0 ? `new mx.array(${args[0]})` : 'null';
    }
    case 'getattr': {
      // getattr(obj, name) -> obj[name] or obj.name
      const args = argListNode ? visitArgListAsArray(argListNode, ctx) : [];
      if (args.length >= 2) {
        let obj = args[0];
        const name = args[1];
        // Map np to mx since numpy operations are available in MLX
        if (obj === 'np') {
          obj = 'mx';
        }
        // If name is a string literal, use dot notation
        if (/^["']/.test(name)) {
          const propName = name.slice(1, -1);
          return `${obj}.${propName}`;
        }
        // Otherwise use bracket notation
        return `${obj}[${name}]`;
      }
      return args.length > 0 ? args[0] : 'undefined';
    }
    case 'zip': {
      // zip(a, b, c) -> pyZip(a, b, c) - helper function
      const args = argListNode ? visitArgListAsArray(argListNode, ctx) : [];
      return `pyZip(${args.join(', ')})`;
    }
    case 'isinstance': {
      // isinstance(x, Type) -> typeof/instanceof check
      const args = argListNode ? visitArgListAsArray(argListNode, ctx) : [];
      if (args.length >= 2) {
        const obj = args[0];
        const type = args[1];
        switch (type) {
          case 'bool':
            return `typeof ${obj} === "boolean"`;
          case 'int':
          case 'float':
            return `typeof ${obj} === "number"`;
          case 'str':
            return `typeof ${obj} === "string"`;
          default:
            return `${obj} instanceof ${type}`;
        }
      }
      return 'false';
    }
    case 'hasattr': {
      // hasattr(obj, "prop") -> "prop" in obj
      const args = argListNode ? visitArgListAsArray(argListNode, ctx) : [];
      if (args.length >= 2) {
        return `${args[1]} in ${args[0]}`;
      }
      return 'false';
    }
    case 'getattr': {
      // getattr(obj, "prop") -> obj["prop"] or obj.prop
      const args = argListNode ? visitArgListAsArray(argListNode, ctx) : [];
      if (args.length >= 2) {
        // If the second arg is a string literal, use bracket notation
        return `${args[0]}[${args[1]}]`;
      }
      return 'undefined';
    }
    case 'print': {
      // print(x) -> console.log(x)
      const args = argListNode ? visitArgListAsArray(argListNode, ctx) : [];
      return `console.log(${args.join(', ')})`;
    }
    case 'abs': {
      const args = argListNode ? visitArgListAsArray(argListNode, ctx) : [];
      return args.length > 0 ? `Math.abs(${args[0]})` : 'Math.abs(0)';
    }
    case 'min': {
      const args = argListNode ? visitArgListAsArray(argListNode, ctx) : [];
      return `Math.min(${args.join(', ')})`;
    }
    case 'max': {
      const args = argListNode ? visitArgListAsArray(argListNode, ctx) : [];
      return `Math.max(${args.join(', ')})`;
    }
    case 'sum': {
      // sum(x) -> x.reduce((a, b) => a + b, 0)
      const args = argListNode ? visitArgListAsArray(argListNode, ctx) : [];
      return args.length > 0 ? `${args[0]}.reduce((a, b) => a + b, 0)` : '0';
    }
    case 'sorted': {
      // sorted(x) -> [...x].sort()
      const args = argListNode ? visitArgListAsArray(argListNode, ctx) : [];
      return args.length > 0 ? `[...${args[0]}].sort()` : '[]';
    }
    case 'reversed': {
      // reversed(x) -> [...x].reverse()
      const args = argListNode ? visitArgListAsArray(argListNode, ctx) : [];
      return args.length > 0 ? `[...${args[0]}].reverse()` : '[]';
    }
    case 'enumerate': {
      // enumerate(x) -> pyEnumerate(mx, x)
      const args = argListNode ? visitArgListAsArray(argListNode, ctx) : [];
      return args.length > 0 ? `pyEnumerate(mx, ${args[0]})` : '[]';
    }
    case 'zip': {
      // zip(a, b, ...) -> pyZip(a, b, ...)
      const args = argListNode ? visitArgListAsArray(argListNode, ctx) : [];
      return `pyZip(${args.join(', ')})`;
    }
    case 'product': {
      // itertools.product(a, b, ...) -> pyProduct(a, b, ...)
      const args = argListNode ? visitArgListAsArray(argListNode, ctx) : [];
      return `pyProduct(${args.join(', ')})`;
    }
    case 'permutations': {
      // itertools.permutations(a, r) -> pyPermutations(a, r)
      const args = argListNode ? visitArgListAsArray(argListNode, ctx) : [];
      return `pyPermutations(${args.join(', ')})`;
    }
    case 'combinations': {
      // itertools.combinations(a, r) -> pyCombinations(a, r)
      const args = argListNode ? visitArgListAsArray(argListNode, ctx) : [];
      return `pyCombinations(${args.join(', ')})`;
    }
    case 'all': {
      // all(x) -> x.every(Boolean)
      const args = argListNode ? visitArgListAsArray(argListNode, ctx) : [];
      return args.length > 0 ? `${args[0]}.every(Boolean)` : 'true';
    }
    case 'any': {
      // any(x) -> x.some(Boolean)
      const args = argListNode ? visitArgListAsArray(argListNode, ctx) : [];
      return args.length > 0 ? `${args[0]}.some(Boolean)` : 'false';
    }
  }

  // Handle itertools functions (when imported as module)
  if (callee === 'itertools.product') {
    const args = argListNode ? visitArgListAsArray(argListNode, ctx) : [];
    return `pyProduct(${args.join(', ')})`;
  }
  if (callee === 'itertools.permutations') {
    const args = argListNode ? visitArgListAsArray(argListNode, ctx) : [];
    return `pyPermutations(${args.join(', ')})`;
  }
  if (callee === 'itertools.combinations') {
    const args = argListNode ? visitArgListAsArray(argListNode, ctx) : [];
    return `pyCombinations(${args.join(', ')})`;
  }

  // Handle numpy random - convert to mx.random
  if (callee.startsWith('np.random.')) {
    return visitNumpyRandomCall(callee, argListNode, ctx);
  }

  // mx.random.* is now available via the random namespace - pass through as-is

  // Handle numpy-like functions
  if (callee.startsWith('np.')) {
    // Check if we have a pre-evaluated value for this expression
    if (ctx.numpyValues) {
      const fullExpr = text(node, ctx.source);
      const preEvaluated = ctx.numpyValues.get(fullExpr);
      if (preEvaluated) {
        return preEvaluated;
      }
    }
    return visitNumpyCall(callee, argListNode, ctx);
  }

  // Handle mx.array specially - needs 'new'
  if (callee === 'mx.array') {
    const argList = argListNode ? visitArgList(argListNode, ctx) : '';
    return `new mx.array${argList}`;
  }

  // Handle mx.all, mx.any, mx.array_equal, mx.allclose - these return arrays, need .item() for boolean
  if (callee === 'mx.all' || callee === 'mx.any' || callee === 'mx.array_equal' || callee === 'mx.allclose') {
    const argList = argListNode ? visitArgList(argListNode, ctx) : '()';
    return `${callee}${argList}.item()`;
  }

  // Handle mx.isnan, mx.isinf, mx.isfinite - these return arrays, need .item() for scalar result
  if (callee === 'mx.isnan' || callee === 'mx.isinf' || callee === 'mx.isfinite') {
    const argList = argListNode ? visitArgList(argListNode, ctx) : '()';
    return `${callee}${argList}.item()`;
  }

  // Handle mx.eval - not available in bindings, treat as no-op (just evaluate the argument)
  if (callee === 'mx.eval') {
    const args = argListNode ? visitArgListAsArray(argListNode, ctx) : [];
    // mx.eval triggers evaluation but returns None/undefined
    // We just return a comment indicating it was called
    return `/* mx.eval(${args.join(', ')}) */`;
  }

  // Regular function call
  const argList = argListNode ? visitArgList(argListNode, ctx) : '()';
  return `${callee}${argList}`;
}

function visitNumpyCall(callee: string, argListNode: SyntaxNode | undefined, ctx: VisitorContext): string {
  const func = callee.slice(3); // Remove 'np.'
  const args = argListNode ? visitArgListAsArray(argListNode, ctx) : [];

  switch (func) {
    // Array creation
    case 'array':
      return `new mx.array(${args.join(', ')})`;
    case 'zeros':
    case 'ones':
    case 'full':
    case 'arange':
    case 'linspace':
    case 'eye':
    case 'identity':
      return `mx.${func}(${args.join(', ')})`;
    case 'zeros_like':
    case 'ones_like':
    case 'full_like':
      return `mx.${func}(${args.join(', ')})`;
    case 'empty':
      return `mx.zeros(${args.join(', ')})`; // MLX doesn't have empty, use zeros

    // Shape manipulation
    case 'reshape':
    case 'transpose':
    case 'squeeze':
    case 'expand_dims':
    case 'flatten':
    case 'ravel':
      return `mx.${func}(${args.join(', ')})`;
    case 'concatenate':
    case 'stack':
    case 'vstack':
    case 'hstack':
    case 'split':
    case 'tile':
    case 'repeat':
      return `mx.${func}(${args.join(', ')})`;

    // Math operations
    case 'abs':
    case 'sqrt':
    case 'square':
    case 'exp':
    case 'log':
    case 'log2':
    case 'log10':
    case 'sin':
    case 'cos':
    case 'tan':
    case 'arcsin':
    case 'arccos':
    case 'arctan':
    case 'sinh':
    case 'cosh':
    case 'tanh':
    case 'floor':
    case 'ceil':
    case 'round':
    case 'sign':
    case 'negative':
    case 'reciprocal':
      return `mx.${func}(${args.join(', ')})`;
    case 'power':
      return `mx.power(${args.join(', ')})`;
    case 'mod':
      return `mx.remainder(${args.join(', ')})`;

    // Reduction operations
    case 'sum':
    case 'prod':
    case 'mean':
    case 'var':
    case 'std':
    case 'min':
    case 'max':
    case 'argmin':
    case 'argmax':
      return `mx.${func}(${args.join(', ')})`;
    case 'all':
    case 'any':
      return `mx.${func}(${args.join(', ')}).item()`;

    // Comparison/logic
    case 'equal':
    case 'not_equal':
    case 'less':
    case 'less_equal':
    case 'greater':
    case 'greater_equal':
    case 'logical_and':
    case 'logical_or':
    case 'logical_not':
      return `mx.${func}(${args.join(', ')})`;
    case 'allclose':
      return `mx.allclose(${args.join(', ')}).item()`;
    case 'array_equal':
      return `mx.array_equal(${args.join(', ')}).item()`;
    case 'isnan':
      return `pyIsNaN(mx, ${args[0] || ''})`;
    case 'isinf':
      return `pyIsInf(mx, ${args[0] || ''})`;
    case 'isfinite':
      return `mx.isfinite(${args[0] || ''})`;

    // Linear algebra
    case 'dot':
    case 'matmul':
      return `mx.matmul(${args.join(', ')})`;
    case 'inner':
      return `mx.inner(${args.join(', ')})`;
    case 'outer':
      return `mx.outer(${args.join(', ')})`;

    // Other common functions
    case 'where':
    case 'clip':
    case 'sort':
    case 'argsort':
    case 'take':
    case 'put':
      return `mx.${func}(${args.join(', ')})`;
    case 'copy':
      return `mx.array(${args[0] || ''})`;
    case 'astype':
      return `${args[0]}.astype(${args.slice(1).join(', ')})`;
    case 'asarray':
      return `new mx.array(${args.join(', ')})`;
    case 'ascontiguousarray':
      return `new mx.array(${args.join(', ')})`;

    // Constants (when used as np.inf, np.nan)
    case 'inf':
      return 'Infinity';
    case 'nan':
      return 'NaN';
    case 'pi':
      return 'Math.PI';
    case 'e':
      return 'Math.E';

    // Testing functions
    case 'testing':
      return 'mx'; // np.testing.* -> handled elsewhere

    default:
      // Try to map to mx equivalent
      return `mx.${func}(${args.join(', ')})`;
  }
}

function visitNumpyRandomCall(callee: string, argListNode: SyntaxNode | undefined, ctx: VisitorContext): string {
  const func = callee.slice(10); // Remove 'np.random.'
  const args = argListNode ? visitArgListAsArray(argListNode, ctx) : [];

  switch (func) {
    case 'uniform':
      // np.random.uniform(low, high, size) -> mx.random.uniform({ low, high, shape })
      if (args.length >= 3) {
        return `mx.random.uniform({ low: ${args[0]}, high: ${args[1]}, shape: ${args[2]} })`;
      } else if (args.length === 2) {
        return `mx.random.uniform({ low: ${args[0]}, high: ${args[1]} })`;
      }
      return `mx.random.uniform({ low: 0, high: 1 })`;

    case 'normal':
    case 'randn':
      // np.random.randn(*shape) -> mx.random.normal({ shape: [...] })
      // np.random.normal(loc, scale, size) -> mx.random.normal({ shape: size })
      if (func === 'randn') {
        if (args.length > 0) {
          return `mx.random.normal({ shape: [${args.join(', ')}] })`;
        }
        return `mx.random.normal({})`;
      }
      // normal with loc, scale, size
      if (args.length >= 3) {
        return `mx.random.normal({ shape: ${args[2]} })`;
      }
      return `mx.random.normal({})`;

    case 'rand':
      // np.random.rand(*shape) -> mx.random.uniform({ low: 0, high: 1, shape: [...] })
      if (args.length > 0) {
        return `mx.random.uniform({ low: 0, high: 1, shape: [${args.join(', ')}] })`;
      }
      return `mx.random.uniform({ low: 0, high: 1 })`;

    case 'randint':
      // np.random.randint(low, high, size) -> mx.random.randint({ low, high, shape })
      if (args.length >= 3) {
        return `mx.random.randint({ low: ${args[0]}, high: ${args[1]}, shape: ${args[2]} })`;
      } else if (args.length === 2) {
        return `mx.random.randint({ low: ${args[0]}, high: ${args[1]} })`;
      } else if (args.length === 1) {
        return `mx.random.randint({ low: 0, high: ${args[0]} })`;
      }
      return `mx.random.randint({})`;

    case 'seed':
      // np.random.seed(n) -> mx.random.seed(n)
      return `mx.random.seed(${args[0] || '0'})`;

    case 'choice':
      // np.random.choice(a, size) - not directly available in MLX
      return `/* np.random.choice not available in MLX */ mx.random.randint({ low: 0, high: ${args[0] || '10'}, shape: ${args[1] || '[1]'} })`;

    default:
      // Try direct mapping
      if (args.length > 0) {
        return `mx.random.${func}({ shape: ${args[0]} })`;
      }
      return `mx.random.${func}({})`;
  }
}

function visitArgList(node: SyntaxNode, ctx: VisitorContext): string {
  const kids = children(node);
  const positional: string[] = [];
  const kwargs: Array<{ key: string; value: string }> = [];

  // Parse the argument list handling:
  // 1. Regular positional arguments
  // 2. Keyword arguments: name=value (parsed as VariableName, AssignOp, Value)
  // 3. Generator expressions: expr for var in iterable (parsed inline)
  let i = 0;
  while (i < kids.length) {
    const child = kids[i];
    const name = child.type.name;

    // Skip punctuation
    if (name === '(' || name === ')' || name === ',') {
      i++;
      continue;
    }

    // Check for keyword argument: VariableName followed by AssignOp
    if (name === 'VariableName' && kids[i + 1]?.type.name === 'AssignOp') {
      const key = text(child, ctx.source);
      const valueNode = kids[i + 2];
      if (valueNode) {
        kwargs.push({
          key,
          value: visit(valueNode, ctx),
        });
      }
      i += 3;
      continue;
    }

    // Check for generator expression: expr for var in iterable [if cond]
    // This pattern appears when a generator is directly in function args without parens
    // Example: join(str(x) for x in items)
    if (i + 3 < kids.length &&
        kids[i + 1]?.type.name === 'for' &&
        kids[i + 3]?.type.name === 'in') {
      // Found generator expression pattern
      const expr = visit(child, ctx);
      const loopVar = kids[i + 2] ? visit(kids[i + 2], ctx) : 'x';

      // Find iterable (after 'in', before 'if' or end)
      let j = i + 4;
      let iterable = '';
      let condition = '';

      while (j < kids.length && kids[j].type.name !== ')' && kids[j].type.name !== ',') {
        if (kids[j].type.name === 'if' && j + 1 < kids.length) {
          // Found condition
          j++;
          while (j < kids.length && kids[j].type.name !== ')' && kids[j].type.name !== ',') {
            condition += visit(kids[j], ctx);
            j++;
          }
          break;
        }
        iterable += visit(kids[j], ctx);
        j++;
      }

      // Generate map/filter expression
      let result: string;
      if (condition) {
        result = `${iterable}.filter(${loopVar} => ${condition}).map(${loopVar} => ${expr})`;
      } else {
        result = `${iterable}.map(${loopVar} => ${expr})`;
      }
      positional.push(result);
      i = j;
      continue;
    }

    // Check for explicit KeywordArgument node (if Lezer provides it)
    if (name === 'KeywordArgument') {
      const key = child.getChild('VariableName');
      const value = children(child).find(c => c.type.name !== 'VariableName' && c.type.name !== '=' && c.type.name !== 'AssignOp');
      if (key && value) {
        kwargs.push({
          key: text(key, ctx.source),
          value: visit(value, ctx),
        });
      }
      i++;
      continue;
    }

    // Regular positional argument
    positional.push(visit(child, ctx));
    i++;
  }

  // If there are kwargs, convert to options object
  if (kwargs.length > 0) {
    const optionsObj = `{ ${kwargs.map(k => `${k.key}: ${k.value}`).join(', ')} }`;
    if (positional.length > 0) {
      return `(${positional.join(', ')}, ${optionsObj})`;
    } else {
      return `(${optionsObj})`;
    }
  }

  return `(${positional.join(', ')})`;
}

function visitArgListAsArray(node: SyntaxNode, ctx: VisitorContext): string[] {
  const kids = children(node);
  const result: string[] = [];

  let i = 0;
  while (i < kids.length) {
    const child = kids[i];
    const name = child.type.name;

    // Skip punctuation
    if (name === '(' || name === ')' || name === ',') {
      i++;
      continue;
    }

    // Skip keyword arguments for the array form - they're handled separately
    if (name === 'VariableName' && kids[i + 1]?.type.name === 'AssignOp') {
      // This is a kwarg - skip it for array result
      i += 3;
      continue;
    }

    // Check for generator expression pattern
    if (i + 3 < kids.length &&
        kids[i + 1]?.type.name === 'for' &&
        kids[i + 3]?.type.name === 'in') {
      const expr = visit(child, ctx);
      const loopVar = kids[i + 2] ? visit(kids[i + 2], ctx) : 'x';

      let j = i + 4;
      let iterable = '';

      while (j < kids.length && kids[j].type.name !== ')' && kids[j].type.name !== ',') {
        iterable += visit(kids[j], ctx);
        j++;
      }

      result.push(`${iterable}.map(${loopVar} => ${expr})`);
      i = j;
      continue;
    }

    result.push(visit(child, ctx));
    i++;
  }

  return result;
}

function visitKeywordArgument(node: SyntaxNode, ctx: VisitorContext): string {
  const key = node.getChild('VariableName');
  const value = children(node).find(c => c.type.name !== 'VariableName' && c.type.name !== '=');
  if (key && value) {
    return `${text(key, ctx.source)}: ${visit(value, ctx)}`;
  }
  return text(node, ctx.source);
}

function visitBinaryExpression(node: SyntaxNode, ctx: VisitorContext): string {
  const kids = children(node);
  if (kids.length < 3) {
    return text(node, ctx.source);
  }

  const left = visit(kids[0], ctx);
  const opNode = kids.find(c =>
    c.type.name === 'ArithOp' ||
    c.type.name === 'BitOp' ||
    c.type.name === 'CompareOp' ||
    c.type.name === 'and' ||
    c.type.name === 'or' ||
    c.type.name === 'is' ||
    c.type.name === 'not'  // for 'is not'
  );
  // If no operator found, return the raw text to avoid wrong conversion
  if (!opNode) {
    return text(node, ctx.source);
  }
  let op = text(opNode, ctx.source);

  // Convert Python boolean operators to JavaScript
  if (op === 'and') {
    op = '&&';
  } else if (op === 'or') {
    op = '||';
  } else if (op === 'is') {
    // Check for 'is not' - look for following 'not' node
    const notNode = kids.find((c, i) => c.type.name === 'not' && i > kids.indexOf(opNode));
    op = notNode ? '!==' : '===';
  }
  const right = visit(kids[kids.length - 1], ctx);

  // Handle comparison operators - use pyCompare/pyNotEqual for Python semantics
  // This handles cases like: array == list (returns False in Python due to type mismatch)
  // and array == array (element-wise comparison)
  if (op === '==' || op === '!=') {
    // Check if both sides look like variables/expressions (not simple literals)
    const leftText = text(kids[0], ctx.source);
    const rightText = text(kids[kids.length - 1], ctx.source);
    // Only consider string/number literals and booleans as literals, NOT list literals
    const isLeftSimpleLiteral = /^["'\d]/.test(leftText) || leftText === 'true' || leftText === 'false' || leftText === 'null';
    const isRightSimpleLiteral = /^["'\d]/.test(rightText) || rightText === 'true' || rightText === 'false' || rightText === 'null';

    // If at least one side could be an array (not a simple literal), use pyCompare
    if (!isLeftSimpleLiteral || !isRightSimpleLiteral) {
      if (op === '==') {
        return `pyCompare(mx, ${left}, ${right})`;
      } else {
        return `pyNotEqual(mx, ${left}, ${right})`;
      }
    }
  }

  // Handle Python-specific operators
  if (op === '**') {
    return `Math.pow(${left}, ${right})`;
  }
  if (op === '//') {
    return `Math.floor(${left} / ${right})`;
  }
  if (op === '@') {
    // Matrix multiplication - needs special handling
    return `mx.matmul(${left}, ${right})`;
  }

  // Handle complex number creation: a + bj
  if (op === '+' || op === '-') {
    const rightText = text(kids[kids.length - 1], ctx.source);
    if (rightText.endsWith('j')) {
      const imag = rightText.slice(0, -1) || '1';
      const sign = op === '-' ? '-' : '';
      return `makeComplex(mx, ${left}, ${sign}${imag})`;
    }
  }

  return `${left} ${op} ${right}`;
}

function visitUnaryExpression(node: SyntaxNode, ctx: VisitorContext): string {
  const kids = children(node);
  const opTypes = ['ArithOp', 'BitOp', 'not'];
  const op = kids.find(c => opTypes.includes(c.type.name));
  const operand = kids.find(c => !opTypes.includes(c.type.name));

  if (op && operand) {
    const opText = text(op, ctx.source);
    // Convert Python 'not' to JavaScript '!'
    if (opText === 'not') {
      return `!${visit(operand, ctx)}`;
    }
    return `${opText}${visit(operand, ctx)}`;
  }
  return text(node, ctx.source);
}

function visitCompareExpression(node: SyntaxNode, ctx: VisitorContext): string {
  const kids = children(node);
  const parts: string[] = [];

  for (let i = 0; i < kids.length; i++) {
    const child = kids[i];
    if (child.type.name === 'CompareOp') {
      let op = text(child, ctx.source);
      // Python 'is' -> JS '===' for simple cases
      if (op === 'is') op = '===';
      if (op === 'is not') op = '!==';
      if (op === 'in') {
        // x in y -> y.includes(x)
        const left = parts.pop() || '';
        const right = kids[i + 1] ? visit(kids[i + 1], ctx) : '';
        parts.push(`${right}.includes(${left})`);
        i++; // Skip next operand
        continue;
      }
      if (op === 'not in') {
        const left = parts.pop() || '';
        const right = kids[i + 1] ? visit(kids[i + 1], ctx) : '';
        parts.push(`!${right}.includes(${left})`);
        i++;
        continue;
      }
      parts.push(op);
    } else {
      parts.push(visit(child, ctx));
    }
  }

  return parts.join(' ');
}

function visitConditionalExpression(node: SyntaxNode, ctx: VisitorContext): string {
  // Python: value_if_true if condition else value_if_false
  // JS: condition ? value_if_true : value_if_false
  const kids = children(node);
  const ifIndex = kids.findIndex(c => c.type.name === 'if');
  const elseIndex = kids.findIndex(c => c.type.name === 'else');

  if (ifIndex === -1 || elseIndex === -1) {
    return text(node, ctx.source);
  }

  const trueValue = kids.slice(0, ifIndex).map(c => visit(c, ctx)).join('');
  const condition = kids.slice(ifIndex + 1, elseIndex).map(c => visit(c, ctx)).join('');
  const falseValue = kids.slice(elseIndex + 1).map(c => visit(c, ctx)).join('');

  return `${condition} ? ${trueValue} : ${falseValue}`;
}

function visitParenthesizedExpression(node: SyntaxNode, ctx: VisitorContext): string {
  const kids = children(node).filter(c => c.type.name !== '(' && c.type.name !== ')');
  if (kids.length === 0) {
    return '()';
  }
  const inner = kids.map(c => visit(c, ctx)).join(', ');
  return `(${inner})`;
}

function visitLambdaExpression(node: SyntaxNode, ctx: VisitorContext): string {
  // Python: lambda x, y: x + y
  // JS: (x, y) => x + y
  const kids = children(node);

  // Find lambda keyword, params, and body
  const lambdaIndex = kids.findIndex(c => c.type.name === 'lambda');
  const colonIndex = kids.findIndex(c => c.type.name === ':');

  if (lambdaIndex === -1 || colonIndex === -1) {
    return text(node, ctx.source);
  }

  // Parameters are between 'lambda' and ':'
  const paramNodes = kids.slice(lambdaIndex + 1, colonIndex);
  const params = paramNodes
    .filter(c => c.type.name === 'VariableName' || c.type.name === 'ParamList')
    .map(c => visit(c, ctx))
    .join(', ');

  // Body is after ':'
  const bodyNodes = kids.slice(colonIndex + 1);
  const body = bodyNodes.map(c => visit(c, ctx)).join('');

  if (params) {
    return `(${params}) => ${body}`;
  }
  return `() => ${body}`;
}

function visitArrayExpression(node: SyntaxNode, ctx: VisitorContext): string {
  const kids = children(node).filter(c =>
    c.type.name !== '[' && c.type.name !== ']' && c.type.name !== ','
  );
  const elements = kids.map(c => visit(c, ctx));
  return `[${elements.join(', ')}]`;
}

function visitDictionaryExpression(node: SyntaxNode, ctx: VisitorContext): string {
  const kids = children(node).filter(c =>
    c.type.name !== '{' && c.type.name !== '}' && c.type.name !== ','
  );

  const entries: string[] = [];
  let key: string | null = null;

  for (const child of kids) {
    if (child.type.name === ':') {
      continue;
    }
    if (key === null) {
      key = visit(child, ctx);
    } else {
      entries.push(`${key}: ${visit(child, ctx)}`);
      key = null;
    }
  }

  return `{ ${entries.join(', ')} }`;
}

function visitTupleExpression(node: SyntaxNode, ctx: VisitorContext): string {
  // Python tuples become JS arrays
  const kids = children(node).filter(c =>
    c.type.name !== '(' && c.type.name !== ')' && c.type.name !== ','
  );
  if (kids.length === 0) {
    return '[]'; // Empty tuple -> empty array
  }
  const elements = kids.map(c => visit(c, ctx));
  return `[${elements.join(', ')}]`;
}

function visitSetExpression(node: SyntaxNode, ctx: VisitorContext): string {
  const kids = children(node).filter(c =>
    c.type.name !== '{' && c.type.name !== '}' && c.type.name !== ','
  );
  const elements = kids.map(c => visit(c, ctx));
  return `new Set([${elements.join(', ')}])`;
}

function visitArrayComprehension(node: SyntaxNode, ctx: VisitorContext): string {
  // Python: [expr for var in iterable]
  // JS: iterable.map(var => expr)

  // Python: [expr for var in iterable if cond]
  // JS: iterable.filter(var => cond).map(var => expr)

  const kids = children(node);
  const forIndex = kids.findIndex(c => c.type.name === 'for');
  const inIndex = kids.findIndex(c => c.type.name === 'in');
  const ifIndex = kids.findIndex(c => c.type.name === 'if');

  if (forIndex === -1 || inIndex === -1) {
    return text(node, ctx.source);
  }

  // Expression is before 'for' (excluding '[')
  const exprNodes = kids.slice(1, forIndex); // skip '['
  const expr = exprNodes.map(c => visit(c, ctx)).join('');

  // Variable is between 'for' and 'in'
  const varNodes = kids.slice(forIndex + 1, inIndex);
  const loopVar = varNodes.map(c => visit(c, ctx)).join(', ');

  // Iterable is after 'in' (until 'if' or ']')
  const iterEnd = ifIndex !== -1 ? ifIndex : kids.length - 1;
  const iterNodes = kids.slice(inIndex + 1, iterEnd);
  const iterable = iterNodes.map(c => visit(c, ctx)).join('');

  // Condition (if present)
  if (ifIndex !== -1) {
    const condNodes = kids.slice(ifIndex + 1, kids.length - 1); // exclude ']'
    const condition = condNodes.map(c => visit(c, ctx)).join('');
    return `${iterable}.filter(${loopVar} => ${condition}).map(${loopVar} => ${expr})`;
  }

  return `${iterable}.map(${loopVar} => ${expr})`;
}

function visitDictionaryComprehension(node: SyntaxNode, ctx: VisitorContext): string {
  // Python: {k: v for k, v in iterable}
  // JS: Object.fromEntries(iterable.map(([k, v]) => [k, v]))
  const kids = children(node);
  const forIndex = kids.findIndex(c => c.type.name === 'for');
  const inIndex = kids.findIndex(c => c.type.name === 'in');

  if (forIndex === -1 || inIndex === -1) {
    return text(node, ctx.source);
  }

  // Key:value expression is between '{' and 'for'
  const colonIndex = kids.findIndex(c => c.type.name === ':');
  const keyNodes = kids.slice(1, colonIndex); // skip '{'
  const valueNodes = kids.slice(colonIndex + 1, forIndex);

  const keyExpr = keyNodes.map(c => visit(c, ctx)).join('');
  const valueExpr = valueNodes.map(c => visit(c, ctx)).join('');

  // Variable is between 'for' and 'in'
  const varNodes = kids.slice(forIndex + 1, inIndex);
  const loopVar = varNodes.map(c => visit(c, ctx)).join(', ');

  // Iterable is after 'in' until '}'
  const iterNodes = kids.slice(inIndex + 1, kids.length - 1);
  const iterable = iterNodes.map(c => visit(c, ctx)).join('');

  // Format the destructuring pattern
  const destructure = loopVar.includes(',') ? `[${loopVar}]` : loopVar;

  return `Object.fromEntries(${iterable}.map(${destructure} => [${keyExpr}, ${valueExpr}]))`;
}

function visitSetComprehension(node: SyntaxNode, ctx: VisitorContext): string {
  // Similar to array comprehension but wrapped in new Set()
  const kids = children(node);
  const forIndex = kids.findIndex(c => c.type.name === 'for');
  const inIndex = kids.findIndex(c => c.type.name === 'in');

  if (forIndex === -1 || inIndex === -1) {
    return text(node, ctx.source);
  }

  const exprNodes = kids.slice(1, forIndex);
  const expr = exprNodes.map(c => visit(c, ctx)).join('');

  const varNodes = kids.slice(forIndex + 1, inIndex);
  const loopVar = varNodes.map(c => visit(c, ctx)).join(', ');

  const iterNodes = kids.slice(inIndex + 1, kids.length - 1);
  const iterable = iterNodes.map(c => visit(c, ctx)).join('');

  return `new Set(${iterable}.map(${loopVar} => ${expr}))`;
}

function visitGeneratorExpression(node: SyntaxNode, ctx: VisitorContext): string {
  // Generator expressions become map calls with spread when used in function args
  // (expr for var in iterable) -> iterable.map(var => expr)
  const kids = children(node);
  const forIndex = kids.findIndex(c => c.type.name === 'for');
  const inIndex = kids.findIndex(c => c.type.name === 'in');

  if (forIndex === -1 || inIndex === -1) {
    return text(node, ctx.source);
  }

  const exprNodes = kids.slice(1, forIndex); // skip '('
  const expr = exprNodes.map(c => visit(c, ctx)).join('');

  const varNodes = kids.slice(forIndex + 1, inIndex);
  const loopVar = varNodes.map(c => visit(c, ctx)).join(', ');

  const iterNodes = kids.slice(inIndex + 1, kids.length - 1);
  const iterable = iterNodes.map(c => visit(c, ctx)).join('');

  return `${iterable}.map(${loopVar} => ${expr})`;
}

function visitSubscriptExpression(node: SyntaxNode, ctx: VisitorContext): string {
  const kids = children(node);
  const obj = kids[0] ? visit(kids[0], ctx) : '';

  // Find the index part (everything inside [])
  const bracketStart = kids.findIndex(c => c.type.name === '[');
  const bracketEnd = kids.findIndex(c => c.type.name === ']');

  if (bracketStart === -1 || bracketEnd === -1) {
    return text(node, ctx.source);
  }

  const indexNodes = kids.slice(bracketStart + 1, bracketEnd);

  // Check if this is a slice
  const hasSlice = indexNodes.some(c => c.type.name === 'Slice' || c.type.name === ':');

  if (hasSlice) {
    // Convert slice to pySlice call, handling len() expressions
    const sliceExprStr = convertSliceExprForMember(indexNodes, ctx);
    return `pySlice(mx, ${obj}, ${sliceExprStr})`;
  }

  // Regular index
  const index = indexNodes.map(c => visit(c, ctx)).join(', ');

  // Handle negative indexing
  if (/^-\d+$/.test(index)) {
    return `${obj}.at(${index})`;
  }

  return `${obj}[${index}]`;
}

function visitSlice(node: SyntaxNode, ctx: VisitorContext): string {
  // Just return the raw slice text - it's handled by SubscriptExpression
  return text(node, ctx.source);
}

function visitExpressionStatement(node: SyntaxNode, ctx: VisitorContext): string {
  // Check if this is a tuple expression (multiple values separated by commas)
  const kids = children(node);
  const hasCommas = kids.some(c => c.type.name === ',');

  if (hasCommas) {
    // It's a tuple - visit all non-comma children and join with commas
    const values = kids
      .filter(c => c.type.name !== ',')
      .map(c => visit(c, ctx));
    return `[${values.join(', ')}]`;
  }

  const expr = node.firstChild;
  return expr ? visit(expr, ctx) : '';
}

function visitAssignStatement(node: SyntaxNode, ctx: VisitorContext): string {
  const kids = children(node);

  // Handle tuple unpacking: a, b = expr
  // Handle augmented assignment: a += expr
  // Handle subscript assignment: x[i] = expr

  // Find the '=' or operator
  const eqIndex = kids.findIndex(c => c.type.name === 'AssignOp' || c.type.name === '=');

  if (eqIndex === -1) {
    return text(node, ctx.source);
  }

  const leftNodes = kids.slice(0, eqIndex);
  const rightNodes = kids.slice(eqIndex + 1);

  // Check if this is a subscript assignment (x[i] = value)
  // In Lezer, subscript can be either SubscriptExpression or MemberExpression with brackets
  const isSubscriptAssign = leftNodes.some(c => {
    if (c.type.name === 'SubscriptExpression') return true;
    if (c.type.name === 'MemberExpression') {
      // Check if MemberExpression has brackets (subscript notation)
      return children(c).some(ch => ch.type.name === '[');
    }
    return false;
  });

  if (isSubscriptAssign) {
    // Find the subscript node
    const subscriptNode = leftNodes.find(c => {
      if (c.type.name === 'SubscriptExpression') return true;
      if (c.type.name === 'MemberExpression') {
        return children(c).some(ch => ch.type.name === '[');
      }
      return false;
    });

    if (subscriptNode) {
      const subscriptKids = children(subscriptNode);
      const hasSlice = subscriptKids.some(c => c.type.name === 'Slice' || c.type.name === ':');

      if (hasSlice) {
        // Slice assignment: x[1:3] = value -> x = pySliceUpdate(mx, x, '1:3', value)
        const obj = subscriptKids[0] ? visit(subscriptKids[0], ctx) : '';
        const bracketStart = subscriptKids.findIndex(c => c.type.name === '[');
        const bracketEnd = subscriptKids.findIndex(c => c.type.name === ']');
        const sliceExpr = subscriptKids.slice(bracketStart + 1, bracketEnd)
          .map(c => text(c, ctx.source)).join('');
        const right = rightNodes.map(c => visit(c, ctx)).join('');
        return `${obj} = pySliceUpdate(mx, ${obj}, '${sliceExpr}', ${right})`;
      } else {
        // Regular subscript assignment: x[i] = value -> x[i] = value (no 'let')
        const left = leftNodes.map(c => visit(c, ctx)).join('');
        const right = rightNodes.map(c => visit(c, ctx)).join('');
        return `${left} = ${right}`;
      }
    }
  }

  // Filter out commas from left side for tuple unpacking
  const leftVarNodes = leftNodes.filter(c => c.type.name !== ',');

  const left = leftVarNodes.map(c => visit(c, ctx)).join(', ');

  // Check if right side has multiple values (tuple/comma-separated)
  const rightValueNodes = rightNodes.filter(c => c.type.name !== ',');
  const hasRightCommas = rightNodes.some(c => c.type.name === ',');
  let right: string;
  if (hasRightCommas && rightValueNodes.length > 1) {
    // Multiple values on right side - wrap in array
    right = `[${rightValueNodes.map(c => visit(c, ctx)).join(', ')}]`;
  } else {
    right = rightNodes.map(c => visit(c, ctx)).join('');
  }

  // Check if it's tuple unpacking (multiple variables on left side)
  const isTupleUnpacking = leftVarNodes.length > 1 || leftVarNodes.some(c =>
    c.type.name === 'TupleExpression' || c.type.name === 'ParenthesizedExpression'
  );

  // Determine if we need 'let' or 'const'
  const varNames = leftVarNodes
    .filter(c => c.type.name === 'VariableName')
    .map(c => text(c, ctx.source));

  const allNew = varNames.every(v => !ctx.declaredVars.has(v));
  varNames.forEach(v => ctx.declaredVars.add(v));

  const keyword = allNew && varNames.length > 0 ? (isTupleUnpacking ? 'const' : 'let') : '';

  if (isTupleUnpacking) {
    // Convert tuple pattern to destructuring
    // Rename duplicate underscores (Python allows `a, _, b, _ = ...` but JS doesn't)
    let leftWithUniqueUnderscores = left;
    let underscoreCount = 0;
    leftWithUniqueUnderscores = left.replace(/\b_\b/g, () => {
      underscoreCount++;
      return underscoreCount === 1 ? '_' : `_${underscoreCount}`;
    });

    // For MLX arrays, we need to use Array.from() since they don't destructure directly
    const pattern = leftWithUniqueUnderscores.includes(',') ? `[${leftWithUniqueUnderscores}]` : leftWithUniqueUnderscores;
    // Check if right side looks like an MLX array variable (single identifier or member access)
    const isLikelyMlxArray = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(right.trim()) ||
                             /^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(right.trim());
    if (isLikelyMlxArray) {
      return `${keyword} ${pattern} = [...pyIter(mx, ${right})]`.trim();
    }
    return `${keyword} ${pattern} = ${right}`.trim();
  }

  return `${keyword} ${left} = ${right}`.trim();
}

function visitUpdateStatement(node: SyntaxNode, ctx: VisitorContext): string {
  // Handle augmented assignment: a += expr, b &= expr, etc.
  const kids = children(node);
  const opIndex = kids.findIndex(c => c.type.name === 'UpdateOp');

  if (opIndex === -1) {
    return text(node, ctx.source);
  }

  const leftNodes = kids.slice(0, opIndex);
  const op = kids[opIndex] ? text(kids[opIndex], ctx.source) : '+=';
  const rightNodes = kids.slice(opIndex + 1);

  const left = leftNodes.map(c => visit(c, ctx)).join('');
  const right = rightNodes.map(c => visit(c, ctx)).join('');

  return `${left} ${op} ${right}`;
}

function visitSpreadExpression(node: SyntaxNode, ctx: VisitorContext): string {
  const kids = children(node);
  // Find the expression being spread (not the * operator)
  const expr = kids.find(c => c.type.name !== '*' && c.type.name !== 'ArithOp');
  return expr ? `...${visit(expr, ctx)}` : text(node, ctx.source);
}

// ============================================================================
// High-level API
// ============================================================================

/**
 * Convert a Python expression to TypeScript using AST
 */
export function convertExpression(
  pythonCode: string,
  declaredVars?: Set<string>,
  numpyValues?: Map<string, string>
): string {
  const tree = parser.parse(pythonCode);
  const ctx: VisitorContext = {
    source: pythonCode,
    declaredVars: declaredVars || new Set(),
    indent: '',
    numpyValues,
  };

  // Skip the Script root node and visit the first statement/expression
  const root = tree.topNode;
  const firstChild = root.firstChild;

  if (firstChild) {
    return visit(firstChild, ctx);
  }

  return pythonCode;
}

/**
 * Parse Python source and return the AST tree for inspection
 */
export function parseToAst(pythonCode: string) {
  return parser.parse(pythonCode);
}
