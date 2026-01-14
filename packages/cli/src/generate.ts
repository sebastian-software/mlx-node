#!/usr/bin/env node
/**
 * MLX Node.js Bindings Generator
 *
 * Parses MLX Python bindings (nanobind) and generates:
 * - TypeScript definitions
 * - N-API C++ bindings
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { NanobindRegexParser, type Binding } from '@mlx-node/parser';
import { TypeScriptGenerator, NapiGenerator } from '@mlx-node/codegen';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Find monorepo root (where pnpm-workspace.yaml is)
function findRoot(): string {
  let dir = __dirname;
  while (dir !== '/') {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) {
      return dir;
    }
    dir = dirname(dir);
  }
  return join(__dirname, '..', '..', '..');
}

const ROOT_DIR = findRoot();

// Configuration - prefer local .mlx-source, fallback to /tmp
function getDefaultMlxSource(): string {
  const localPath = join(ROOT_DIR, '.mlx-source', 'python', 'src');
  if (existsSync(localPath)) {
    return localPath;
  }
  // Fallback for backwards compatibility
  const tmpPath = '/tmp/mlx-source/python/src';
  if (existsSync(tmpPath)) {
    return tmpPath;
  }
  return localPath; // Return local path even if not exists (will error with helpful message)
}

const config = {
  mlxSourceDir: process.env.MLX_SOURCE || getDefaultMlxSource(),
  outputDir: process.env.OUTPUT_DIR || join(ROOT_DIR, 'packages', 'mlx-node', 'generated'),
};

export async function generate(options?: { mlxSourceDir?: string; outputDir?: string }) {
  const mlxSourceDir = options?.mlxSourceDir || config.mlxSourceDir;
  const outputDir = options?.outputDir || config.outputDir;

  console.log('=== MLX Node.js Bindings Generator ===\n');
  console.log(`Source: ${mlxSourceDir}`);
  console.log(`Output: ${outputDir}\n`);

  // Check if MLX source exists
  if (!existsSync(mlxSourceDir)) {
    console.error('ERROR: MLX source not found at:', mlxSourceDir);
    console.error('');
    console.error('Run the setup script first:');
    console.error('  pnpm setup');
    console.error('');
    console.error('Or set MLX_SOURCE environment variable:');
    console.error('  export MLX_SOURCE=/path/to/mlx/python/src');
    process.exit(1);
  }

  // Ensure output directory exists
  mkdirSync(outputDir, { recursive: true });

  // Parse all binding files
  const parser = new NanobindRegexParser();
  const allBindings: Binding[] = [];
  const bindingsByFile: Map<string, Binding[]> = new Map();

  const files = readdirSync(mlxSourceDir).filter(f => f.endsWith('.cpp'));
  console.log(`Parsing ${files.length} source files...\n`);

  for (const file of files) {
    const filePath = join(mlxSourceDir, file);
    try {
      const code = readFileSync(filePath, 'utf-8');
      const bindings = parser.parse(code);
      allBindings.push(...bindings);
      bindingsByFile.set(file, bindings);
      console.log(`  ${file}: ${bindings.length} bindings`);
    } catch (error) {
      console.error(`  ${file}: Error - ${error}`);
    }
  }

  // Summary
  const functions = allBindings.filter(b => b.type === 'function');
  const classes = allBindings.filter(b => b.type === 'class');
  const enums = allBindings.filter(b => b.type === 'enum');
  const attrs = allBindings.filter(b => b.type === 'attribute');

  console.log('\n=== Summary ===');
  console.log(`Total: ${allBindings.length} bindings`);
  console.log(`  Functions: ${functions.length}`);
  console.log(`  Classes: ${classes.length}`);
  console.log(`  Enums: ${enums.length}`);
  console.log(`  Attributes: ${attrs.length}`);

  // Generate TypeScript definitions
  console.log('\n=== Generating TypeScript Definitions ===\n');

  const tsGenerator = new TypeScriptGenerator({
    moduleName: 'mlx-node',
    includeDocs: true,
    camelCase: false, // Keep Python-style names for familiarity
  });

  const dts = tsGenerator.generate(allBindings);
  const dtsPath = join(outputDir, 'mlx-node.d.ts');
  writeFileSync(dtsPath, dts);
  console.log(`  Written: ${dtsPath}`);

  // Export bindings as JSON for other tools
  const jsonPath = join(outputDir, 'bindings.json');
  writeFileSync(jsonPath, JSON.stringify({
    generated: new Date().toISOString(),
    source: mlxSourceDir,
    stats: {
      functions: functions.length,
      classes: classes.length,
      enums: enums.length,
      attributes: attrs.length,
    },
    bindings: allBindings,
  }, null, 2));
  console.log(`  Written: ${jsonPath}`);

  // Generate a summary markdown
  const mdPath = join(outputDir, 'API.md');
  writeFileSync(mdPath, generateMarkdownDocs(allBindings));
  console.log(`  Written: ${mdPath}`);

  // Generate N-API C++ bindings
  console.log('\n=== Generating N-API C++ Bindings ===\n');

  const napiGenerator = new NapiGenerator({
    includeComments: true,
    namespace: 'mlx_node',
  });

  const bindingCpp = napiGenerator.generateBindingCpp(allBindings);
  const bindingCppPath = join(outputDir, 'binding.cpp');
  writeFileSync(bindingCppPath, bindingCpp);
  console.log(`  Written: ${bindingCppPath}`);

  const bindingH = napiGenerator.generateBindingHeader(allBindings);
  const bindingHPath = join(outputDir, 'binding.h');
  writeFileSync(bindingHPath, bindingH);
  console.log(`  Written: ${bindingHPath}`);

  console.log('\n=== Done ===\n');

  return {
    bindings: allBindings,
    outputDir,
  };
}

function generateMarkdownDocs(bindings: Binding[]): string {
  const lines: string[] = [];

  lines.push('# MLX Node.js API');
  lines.push('');
  lines.push('Auto-generated from MLX Python bindings.');
  lines.push('');

  // Classes
  lines.push('## Classes');
  lines.push('');
  const classes = bindings.filter(b => b.type === 'class');
  for (const cls of classes) {
    if (cls.type !== 'class') continue;
    lines.push(`### ${cls.name}`);
    lines.push('');
    lines.push(`C++ Class: \`${cls.cppClass}\``);
    lines.push('');
    if (cls.docstring) {
      lines.push(cls.docstring.split('\n').slice(0, 5).join('\n'));
      lines.push('');
    }
  }

  // Functions (grouped by first letter)
  lines.push('## Functions');
  lines.push('');

  const functions = bindings.filter(b => b.type === 'function');
  const grouped = new Map<string, typeof functions>();

  for (const fn of functions) {
    if (fn.type !== 'function') continue;
    const letter = fn.name[0].toUpperCase();
    if (!grouped.has(letter)) grouped.set(letter, []);
    grouped.get(letter)!.push(fn);
  }

  for (const [letter, fns] of [...grouped.entries()].sort()) {
    lines.push(`### ${letter}`);
    lines.push('');
    for (const fn of fns) {
      if (fn.type !== 'function') continue;
      if (fn.signature) {
        lines.push(`- \`${fn.signature}\``);
      } else {
        lines.push(`- \`${fn.name}(...)\``);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

// Run if called directly
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  generate().catch(console.error);
}
