/**
 * Test script for the Nanobind regex parser
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { NanobindRegexParser, parseSignature, type Binding } from './parser/regex-parser.js';

const parser = new NanobindRegexParser();

// Test with MLX source files
const sourceDir = process.argv[2] || '/tmp/mlx-source/python/src';

console.log(`Parsing files in: ${sourceDir}\n`);

const allBindings: Binding[] = [];
const files = readdirSync(sourceDir).filter(f => f.endsWith('.cpp'));

for (const file of files) {
  const filePath = join(sourceDir, file);
  try {
    const code = readFileSync(filePath, 'utf-8');
    const bindings = parser.parse(code);
    allBindings.push(...bindings);
    console.log(`${file}: ${bindings.length} bindings`);
  } catch (error) {
    console.log(`${file}: Error - ${error}`);
  }
}

// Group by type
const functions = allBindings.filter(b => b.type === 'function');
const classes = allBindings.filter(b => b.type === 'class');
const enums = allBindings.filter(b => b.type === 'enum');
const attrs = allBindings.filter(b => b.type === 'attribute');

console.log('\n=== Summary ===');
console.log(`Total Bindings: ${allBindings.length}`);
console.log(`  Functions: ${functions.length}`);
console.log(`  Classes: ${classes.length}`);
console.log(`  Enums: ${enums.length}`);
console.log(`  Attributes: ${attrs.length}`);

// Show functions with signatures
const withSig = functions.filter(f => f.type === 'function' && f.signature);
const withCpp = functions.filter(f => f.type === 'function' && f.cppFunction);
const lambdas = functions.filter(f => f.type === 'function' && f.isLambda);

console.log(`\nFunction breakdown:`);
console.log(`  With nb::sig(): ${withSig.length}`);
console.log(`  Direct C++ ref: ${withCpp.length}`);
console.log(`  Lambda wrappers: ${lambdas.length}`);

console.log('\n=== Sample Functions (first 10) ===\n');

for (const fn of functions.slice(0, 10)) {
  if (fn.type === 'function') {
    console.log(`📦 ${fn.name}`);
    if (fn.signature) {
      console.log(`   Signature: ${fn.signature}`);
      const parsed = parseSignature(fn.signature);
      if (parsed) {
        console.log(`   Params: ${parsed.params.map(p => p.name).join(', ')}`);
        if (parsed.returnType) console.log(`   Returns: ${parsed.returnType}`);
      }
    }
    if (fn.cppFunction) {
      console.log(`   C++ Func: ${fn.cppFunction}`);
    }
    if (fn.isLambda) {
      console.log(`   [Lambda wrapper]`);
    }
    console.log();
  }
}

console.log('\n=== Sample Classes ===\n');

for (const cls of classes) {
  if (cls.type === 'class') {
    console.log(`🏛️  ${cls.name} → ${cls.cppClass}`);
    if (cls.docstring) {
      console.log(`   "${cls.docstring.slice(0, 80)}..."`);
    }
  }
}

console.log('\n=== Sample Enums ===\n');

for (const en of enums) {
  if (en.type === 'enum') {
    console.log(`📋 ${en.name} → ${en.cppEnum}`);
  }
}

console.log('\n=== Sample Attributes ===\n');

for (const attr of attrs.slice(0, 15)) {
  if (attr.type === 'attribute') {
    console.log(`🏷️  ${attr.name} = ${attr.value}`);
  }
}

// Export summary as JSON
console.log('\n=== JSON Export (first 5 functions) ===\n');
console.log(JSON.stringify(functions.slice(0, 5), null, 2));
