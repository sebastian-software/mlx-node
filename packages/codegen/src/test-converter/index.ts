#!/usr/bin/env node
/**
 * Test Converter - Python to TypeScript/Vitest
 *
 * Converts MLX Python tests to TypeScript tests for mlx-node.
 * Uses Lezer for Python parsing - pure JavaScript, no native dependencies.
 */

import * as fs from 'fs';
import * as path from 'path';
import { convertTestFile } from './converter.js';

export interface ConvertOptions {
  /** Filter to specific test methods (substring match) */
  filter?: string;
  /** Import path for mlx-node in generated tests */
  importPath?: string;
}

/**
 * Convert a Python test file to TypeScript/Vitest
 */
export function convertPythonTestFile(pythonFile: string, options: ConvertOptions = {}): string {
  const source = fs.readFileSync(pythonFile, 'utf-8');
  return convertTestFile(source, options);
}

/**
 * Convert and write a Python test file
 */
export function convertAndWriteTestFile(
  pythonFile: string,
  outputPath: string,
  options: ConvertOptions = {}
): void {
  const typescript = convertPythonTestFile(pythonFile, options);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, typescript);
  console.log(`  ✓ ${path.basename(outputPath)}`);
}

/**
 * Convert all Python tests from MLX source
 */
export function convertAllTests(
  mlxTestsDir: string,
  outputDir: string,
  options: { include?: string[]; exclude?: string[] } = {}
): void {
  const defaultExclude = [
    'test_compile.py',      // Compilation not supported
    'test_distributed.py',  // MPI not supported
    'test_export_import.py', // Serialization format different
    'test_load.py',         // File loading different
    'test_nn.py',           // Neural network module different
    'test_optimizers.py',   // Optimizers different
    'test_vmap.py',         // vmap not supported
    'test_autograd.py',     // Autograd different
  ];

  const testFiles = fs.readdirSync(mlxTestsDir)
    .filter(f => f.startsWith('test_') && f.endsWith('.py'))
    .filter(f => !defaultExclude.includes(f))
    .filter(f => !options.exclude?.includes(f))
    .filter(f => !options.include || options.include.includes(f));

  console.log(`Converting ${testFiles.length} test files from MLX...`);

  let converted = 0;
  let failed = 0;

  for (const file of testFiles) {
    const pythonPath = path.join(mlxTestsDir, file);
    const tsPath = path.join(outputDir, file.replace('.py', '.test.ts'));

    try {
      convertAndWriteTestFile(pythonPath, tsPath);
      converted++;
    } catch (error) {
      console.error(`  ✗ ${file}: ${(error as Error).message}`);
      failed++;
    }
  }

  console.log(`\nDone: ${converted} converted, ${failed} failed`);
}

// CLI
const isMain = import.meta.url === `file://${process.argv[1]}` ||
               process.argv[1]?.endsWith('convert-tests.js') ||
               process.argv[1]?.endsWith('index.js');

if (isMain) {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.log(`
MLX Test Converter - Convert Python tests to TypeScript/Vitest

Usage:
  convert-tests <python-file> [options]
  convert-tests --all <mlx-tests-dir> --output <output-dir>

Options:
  --filter <name>    Filter to tests containing <name>
  --output <file>    Output file path
  --import <path>    Import path for mlx-node (default: ../../dist/index.js)
  --all              Convert all test files in directory

Examples:
  convert-tests test_ops.py --filter test_add
  convert-tests test_ops.py --output test/ops.test.ts
  convert-tests --all /path/to/mlx/tests --output test/generated
`);
    process.exit(1);
  }

  // Parse arguments
  let pythonFile: string | undefined;
  let filter: string | undefined;
  let output: string | undefined;
  let importPath: string | undefined;
  let allMode = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--filter' && args[i + 1]) {
      filter = args[++i];
    } else if (arg === '--output' && args[i + 1]) {
      output = args[++i];
    } else if (arg === '--import' && args[i + 1]) {
      importPath = args[++i];
    } else if (arg === '--all') {
      allMode = true;
    } else if (!arg.startsWith('-')) {
      pythonFile = arg;
    }
  }

  if (allMode && pythonFile && output) {
    convertAllTests(pythonFile, output);
  } else if (pythonFile) {
    const typescript = convertPythonTestFile(pythonFile, { filter, importPath });

    if (output) {
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.writeFileSync(output, typescript);
      console.log(`Written to ${output}`);
    } else {
      console.log(typescript);
    }
  } else {
    console.error('Error: No input file specified');
    process.exit(1);
  }
}

// Re-export converter functions for programmatic use
export { convertTestFile, pythonToTypeScript, convertAssertion } from './converter.js';
export { extractTests, parseStatements } from './python-parser.js';
