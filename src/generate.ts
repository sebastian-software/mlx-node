#!/usr/bin/env node
/**
 * MLX Node.js Bindings Generator
 *
 * Parses MLX Python bindings (nanobind) and generates:
 * - TypeScript definitions
 * - (Future) N-API C++ bindings
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { NanobindRegexParser, type Binding } from './parser/regex-parser.js';
import { TypeScriptGenerator } from './generator/ts-generator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Configuration
const config = {
  mlxSourceDir: process.env.MLX_SOURCE || '/tmp/mlx-source/python/src',
  outputDir: process.env.OUTPUT_DIR || join(__dirname, '..', 'generated'),
};

async function main() {
  console.log('=== MLX Node.js Bindings Generator ===\n');
  console.log(`Source: ${config.mlxSourceDir}`);
  console.log(`Output: ${config.outputDir}\n`);

  // Ensure output directory exists
  mkdirSync(config.outputDir, { recursive: true });

  // Parse all binding files
  const parser = new NanobindRegexParser();
  const allBindings: Binding[] = [];
  const bindingsByFile: Map<string, Binding[]> = new Map();

  const files = readdirSync(config.mlxSourceDir).filter(f => f.endsWith('.cpp'));
  console.log(`Parsing ${files.length} source files...\n`);

  for (const file of files) {
    const filePath = join(config.mlxSourceDir, file);
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
  const dtsPath = join(config.outputDir, 'mlx-node.d.ts');
  writeFileSync(dtsPath, dts);
  console.log(`  Written: ${dtsPath}`);

  // Export bindings as JSON for other tools
  const jsonPath = join(config.outputDir, 'bindings.json');
  writeFileSync(jsonPath, JSON.stringify({
    generated: new Date().toISOString(),
    source: config.mlxSourceDir,
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
  const mdPath = join(config.outputDir, 'API.md');
  writeFileSync(mdPath, generateMarkdownDocs(allBindings));
  console.log(`  Written: ${mdPath}`);

  console.log('\n=== Done ===\n');
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

main().catch(console.error);
