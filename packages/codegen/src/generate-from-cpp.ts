#!/usr/bin/env node
/**
 * Generate N-API bindings from C++ headers
 *
 * This is the new, cleaner approach that parses C++ headers directly
 * instead of going through Python pybind11 bindings.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { parseCppHeader, CppFunction } from './cpp-header-parser.js';
import { parseExportList, ExportedFunction } from './export-list-parser.js';
import { CppNapiGenerator } from './cpp-napi-generator.js';

// Paths
const MLX_HEADERS_DIR = process.env.MLX_HEADERS_DIR ||
  path.join(process.cwd(), '..', 'mlx-node', 'build', '_deps', 'mlx-src', 'mlx');
const PYTHON_BINDINGS_DIR = process.env.PYTHON_BINDINGS_DIR ||
  '/tmp/mlx-source/python/src';
const OUTPUT_DIR = process.env.OUTPUT_DIR ||
  path.join(process.cwd(), '..', 'mlx-node', 'generated');

// Headers to parse
const HEADERS = [
  'ops.h',
  'linalg.h',
  'fft.h',
  'random.h',
  'fast.h',
];

// Python binding files (for export list)
const PYTHON_FILES = [
  'ops.cpp',
  'linalg.cpp',
  'fft.cpp',
  'random.cpp',
  'fast.cpp',
];

async function main() {
  console.log('=== MLX Node.js Bindings Generator (C++ Based) ===\n');
  console.log(`MLX Headers: ${MLX_HEADERS_DIR}`);
  console.log(`Python Bindings: ${PYTHON_BINDINGS_DIR}`);
  console.log(`Output: ${OUTPUT_DIR}\n`);

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Parse C++ headers
  console.log('Parsing C++ headers...');
  const allFunctions: CppFunction[] = [];

  for (const header of HEADERS) {
    const headerPath = path.join(MLX_HEADERS_DIR, header);
    if (!fs.existsSync(headerPath)) {
      console.log(`  Skipping ${header} (not found)`);
      continue;
    }

    const content = fs.readFileSync(headerPath, 'utf-8');
    const parsed = parseCppHeader(content, header);
    console.log(`  ${header}: ${parsed.functions.length} functions`);
    allFunctions.push(...parsed.functions);
  }

  // Parse export list from Python bindings
  console.log('\nParsing export list from Python bindings...');
  const allExports = new Map<string, ExportedFunction>();

  for (const pyFile of PYTHON_FILES) {
    const pyPath = path.join(PYTHON_BINDINGS_DIR, pyFile);
    if (!fs.existsSync(pyPath)) {
      console.log(`  Skipping ${pyFile} (not found)`);
      continue;
    }

    const content = fs.readFileSync(pyPath, 'utf-8');
    const moduleName = pyFile.replace('.cpp', '');
    const exports = parseExportList(content, moduleName);
    console.log(`  ${pyFile}: ${exports.length} exports`);

    for (const exp of exports) {
      if (!allExports.has(exp.name)) {
        allExports.set(exp.name, exp);
      }
    }
  }

  // Generate bindings
  console.log('\n=== Generating Bindings ===\n');

  const generator = new CppNapiGenerator(allFunctions, allExports);
  const bindingCode = generator.generate();

  // Write output
  const bindingPath = path.join(OUTPUT_DIR, 'binding.cpp');
  fs.writeFileSync(bindingPath, bindingCode);
  console.log(`Written: ${bindingPath}`);

  // Summary
  console.log('\n=== Summary ===');
  console.log(`Total C++ functions: ${allFunctions.length}`);
  console.log(`Exported functions: ${allExports.size}`);

  // Find missing functions
  const functionNames = new Set(allFunctions.map(f => f.name));
  const missing = [...allExports.keys()].filter(name => !functionNames.has(name));
  if (missing.length > 0) {
    console.log(`\nFunctions in exports but not in headers: ${missing.length}`);
    console.log(`  ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? '...' : ''}`);
  }

  // Compute and save hash of Python bindings
  const pyContents: string[] = [];
  for (const pyFile of PYTHON_FILES) {
    const pyPath = path.join(PYTHON_BINDINGS_DIR, pyFile);
    if (fs.existsSync(pyPath)) {
      pyContents.push(fs.readFileSync(pyPath, 'utf-8'));
    }
  }
  const hash = crypto.createHash('sha256').update(pyContents.join('\n')).digest('hex').slice(0, 16);
  const hashPath = path.join(OUTPUT_DIR, '.bindings-hash');
  fs.writeFileSync(hashPath, hash + '\n');
  console.log(`\nBindings hash: ${hash}`);

  console.log('\n=== Done ===');
}

main().catch(console.error);
