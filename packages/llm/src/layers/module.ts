/**
 * Base Module class for neural network layers
 *
 * Inspired by PyTorch/MLX nn.Module pattern
 */

import type { MLXArray, Weights } from '../types.js';

/**
 * Base class for all neural network modules
 */
export abstract class Module {
  protected _modules: Map<string, Module> = new Map();
  protected _parameters: Map<string, MLXArray> = new Map();

  /**
   * Forward pass - must be implemented by subclasses
   */
  abstract forward(...args: unknown[]): MLXArray | MLXArray[];

  /**
   * Register a child module
   */
  protected registerModule(name: string, module: Module): void {
    this._modules.set(name, module);
  }

  /**
   * Register a parameter tensor
   */
  protected registerParameter(name: string, param: MLXArray): void {
    this._parameters.set(name, param);
  }

  /**
   * Get a parameter by name (for use in forward())
   */
  protected getParameter(name: string): MLXArray {
    const param = this._parameters.get(name);
    if (!param) {
      throw new Error(`Parameter '${name}' not found. Was the model loaded?`);
    }
    return param;
  }

  /**
   * Check if a parameter exists
   */
  protected hasParameter(name: string): boolean {
    return this._parameters.has(name);
  }

  /**
   * Get all parameters (including from child modules)
   */
  parameters(): Map<string, MLXArray> {
    const params = new Map<string, MLXArray>();

    // Own parameters
    for (const [name, param] of this._parameters) {
      params.set(name, param);
    }

    // Child module parameters
    for (const [moduleName, module] of this._modules) {
      for (const [paramName, param] of module.parameters()) {
        params.set(`${moduleName}.${paramName}`, param);
      }
    }

    return params;
  }

  /**
   * Get all child modules
   */
  modules(): Map<string, Module> {
    return this._modules;
  }

  /**
   * Load weights from a weight map.
   *
   * This method loads weights into the module hierarchy by matching
   * weight keys to module paths. Weights are loaded directly into
   * _parameters, which are then accessed via getParameter().
   */
  loadWeights(weights: Weights, prefix = ''): void {
    const prefixDot = prefix ? `${prefix}.` : '';

    // Find and load weights that belong to this module directly
    for (const [key, value] of Object.entries(weights)) {
      // Skip keys that don't match our prefix
      if (prefix && !key.startsWith(prefixDot)) {
        continue;
      }

      // Get the local key (without prefix)
      const localKey = prefix ? key.slice(prefixDot.length) : key;

      // Check if this is a direct parameter (no dots) or belongs to a child
      if (!localKey.includes('.')) {
        // Direct parameter for this module
        this._parameters.set(localKey, value);
      }
    }

    // Load child module weights
    for (const [moduleName, module] of this._modules) {
      const childPrefix = prefix ? `${prefix}.${moduleName}` : moduleName;
      module.loadWeights(weights, childPrefix);
    }
  }

  /**
   * Get number of parameters
   */
  numParameters(): number {
    let count = 0;
    for (const param of this.parameters().values()) {
      count += param.size;
    }
    return count;
  }

  /**
   * Update a specific parameter (useful for manual weight setting)
   */
  setParameter(name: string, value: MLXArray): void {
    this._parameters.set(name, value);
  }
}

/**
 * Container for a list of modules
 */
export class ModuleList extends Module {
  private _list: Module[] = [];

  constructor(modules?: Module[]) {
    super();
    if (modules) {
      for (let i = 0; i < modules.length; i++) {
        this._list.push(modules[i]);
        this.registerModule(String(i), modules[i]);
      }
    }
  }

  forward(): MLXArray {
    throw new Error('ModuleList does not implement forward()');
  }

  get length(): number {
    return this._list.length;
  }

  get(index: number): Module {
    return this._list[index];
  }

  [Symbol.iterator](): Iterator<Module> {
    return this._list[Symbol.iterator]();
  }

  push(module: Module): void {
    const index = this._list.length;
    this._list.push(module);
    this.registerModule(String(index), module);
  }
}
