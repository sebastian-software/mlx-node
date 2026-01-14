/**
 * TypeScript Definition Generator
 *
 * Generates .d.ts files from parsed nanobind bindings
 */

import { type Binding, type FunctionBinding, type ClassBinding, parseSignature } from '@mlx-node/parser';
import { pythonToTypeScript, toCamelCase, isOptional } from './type-mapper.js';

export interface GeneratorOptions {
  /** Use camelCase for method names (default: false to match Python API) */
  camelCase?: boolean;
  /** Include docstrings as JSDoc comments */
  includeDocs?: boolean;
  /** Module name for the declaration */
  moduleName?: string;
}

export class TypeScriptGenerator {
  private options: Required<GeneratorOptions>;

  constructor(options: GeneratorOptions = {}) {
    this.options = {
      camelCase: options.camelCase ?? false,
      includeDocs: options.includeDocs ?? true,
      moduleName: options.moduleName ?? 'mlx-node',
    };
  }

  generate(bindings: Binding[]): string {
    const lines: string[] = [];

    lines.push(`// Auto-generated TypeScript definitions for ${this.options.moduleName}`);
    lines.push(`// Generated from MLX Python bindings (nanobind)`);
    lines.push('');
    lines.push(`declare module '${this.options.moduleName}' {`);

    // Generate core types
    lines.push(...this.generateCoreTypes());

    // Generate classes
    const classes = bindings.filter((b): b is ClassBinding => b.type === 'class');
    for (const cls of classes) {
      lines.push(...this.generateClass(cls, bindings));
    }

    // Generate standalone functions
    const functions = bindings.filter((b): b is FunctionBinding => b.type === 'function');
    lines.push(...this.generateFunctions(functions));

    // Generate constants/attributes
    const attrs = bindings.filter(b => b.type === 'attribute');
    lines.push(...this.generateAttributes(attrs));

    lines.push('}');

    return lines.join('\n');
  }

  private generateCoreTypes(): string[] {
    return [
      '',
      '  // Core Types',
      '  export type DtypeString = ',
      "    | 'bool' | 'uint8' | 'uint16' | 'uint32' | 'uint64'",
      "    | 'int8' | 'int16' | 'int32' | 'int64'",
      "    | 'float16' | 'float32' | 'float64' | 'bfloat16'",
      "    | 'complex64';",
      '',
      '  export interface Dtype {',
      '    readonly size: number;',
      '  }',
      '',
      "  export type DeviceType = 'cpu' | 'gpu';",
      '',
      '  export interface Device {',
      '    readonly type: DeviceType;',
      '  }',
      '',
      '  export interface Stream {',
      '    readonly device: Device;',
      '  }',
      '',
      '  export type StreamOrDevice = Stream | Device | undefined;',
      '',
      '  // Array-like input types',
      '  export type ArrayLike = MLXArray | number | number[] | number[][] | number[][][] | boolean | boolean[];',
      '',
    ];
  }

  private generateClass(cls: ClassBinding, allBindings: Binding[]): string[] {
    const lines: string[] = [];

    // Add JSDoc
    if (this.options.includeDocs && cls.docstring) {
      lines.push('');
      lines.push('  /**');
      for (const line of cls.docstring.split('\n').slice(0, 10)) {
        lines.push(`   * ${line.trim()}`);
      }
      lines.push('   */');
    }

    const tsName = cls.name === 'array' ? 'MLXArray' : cls.name;
    lines.push(`  export class ${tsName} {`);

    // For the array class, add common methods
    if (cls.name === 'array') {
      lines.push(...this.generateArrayClassMethods());
    }

    lines.push('  }');

    return lines;
  }

  private generateArrayClassMethods(): string[] {
    // These are the most important array methods based on the MLX API
    return [
      '    /** Array shape */',
      '    readonly shape: number[];',
      '    /** Number of dimensions */',
      '    readonly ndim: number;',
      '    /** Total number of elements */',
      '    readonly size: number;',
      '    /** Data type */',
      '    readonly dtype: Dtype;',
      '    /** Number of bytes per element */',
      '    readonly itemsize: number;',
      '    /** Total number of bytes */',
      '    readonly nbytes: number;',
      '',
      '    /** Create array from data */',
      '    constructor(data: ArrayLike, dtype?: Dtype | DtypeString);',
      '',
      '    /** Convert to JavaScript array */',
      '    tolist(): number | number[] | number[][] | number[][][];',
      '',
      '    /** Get item at index */',
      '    item(): number;',
      '',
      '    /** Reshape the array */',
      '    reshape(shape: number[]): MLXArray;',
      '',
      '    /** Transpose the array */',
      '    T: MLXArray;',
      '',
      '    /** Cast to different dtype */',
      '    astype(dtype: Dtype | DtypeString, stream?: StreamOrDevice): MLXArray;',
    ];
  }

  private generateFunctions(functions: FunctionBinding[]): string[] {
    const lines: string[] = [];
    const seen = new Set<string>();

    lines.push('');
    lines.push('  // Functions');

    for (const fn of functions) {
      // Skip duplicates (overloads are handled by Union types)
      const key = fn.name;
      if (seen.has(key)) continue;
      seen.add(key);

      const fnLines = this.generateFunction(fn);
      lines.push(...fnLines);
    }

    return lines;
  }

  private generateFunction(fn: FunctionBinding): string[] {
    const lines: string[] = [];
    const name = this.options.camelCase ? toCamelCase(fn.name) : fn.name;

    // Add JSDoc
    if (this.options.includeDocs && fn.docstring) {
      lines.push('');
      lines.push('  /**');
      const docLines = fn.docstring.split('\n').slice(0, 15);
      for (const line of docLines) {
        lines.push(`   * ${line.trim()}`);
      }
      lines.push('   */');
    }

    // Parse signature
    if (fn.signature) {
      const parsed = parseSignature(fn.signature);
      if (parsed) {
        const params = parsed.params.map(p => {
          const tsType = pythonToTypeScript(p.type || 'unknown');
          const optional = p.isOptional || p.default !== undefined;
          return `${p.name}${optional ? '?' : ''}: ${tsType}`;
        }).join(', ');

        const returnType = pythonToTypeScript(parsed.returnType || 'void');
        lines.push(`  export function ${name}(${params}): ${returnType};`);
      } else {
        // Fallback: couldn't parse signature
        lines.push(`  export function ${name}(...args: unknown[]): unknown;`);
      }
    } else {
      // No signature available
      lines.push(`  export function ${name}(...args: unknown[]): unknown;`);
    }

    return lines;
  }

  private generateAttributes(attrs: Binding[]): string[] {
    const lines: string[] = [];

    lines.push('');
    lines.push('  // Constants');

    for (const attr of attrs) {
      if (attr.type !== 'attribute') continue;

      // Detect type from value
      let tsType = 'unknown';
      if (attr.value.includes('mx::bool_')) tsType = 'Dtype';
      else if (attr.value.includes('mx::uint')) tsType = 'Dtype';
      else if (attr.value.includes('mx::int')) tsType = 'Dtype';
      else if (attr.value.includes('mx::float')) tsType = 'Dtype';
      else if (attr.value.includes('mx::bfloat')) tsType = 'Dtype';
      else if (attr.value.includes('mx::complex')) tsType = 'Dtype';
      else if (/^\d+\.?\d*$/.test(attr.value)) tsType = 'number';

      lines.push(`  export const ${attr.name}: ${tsType};`);
    }

    return lines;
  }
}
