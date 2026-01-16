import fs from 'fs';
import { hasUnconvertedSyntax, convertTestFile } from './dist/test-converter/converter.js';
import { extractTests, parseStatements } from './dist/test-converter/python-parser.js';

const testsDir = '/private/tmp/mlx-source/python/tests';
const outputDir = '/Users/sebastian/Workspace/mlx-node/packages/mlx-node/test/generated';

// Check actual converted output for skip patterns
const skippedReasons = {};
const convertedFiles = fs.readdirSync(outputDir).filter(f => f.endsWith('.test.ts'));

for (const file of convertedFiles) {
  const content = fs.readFileSync(`${outputDir}/${file}`, 'utf-8');

  // Find all it.skip calls and their test names
  const skipMatches = content.matchAll(/it\.skip\('([^']+)'/g);
  for (const match of skipMatches) {
    const testName = match[1];

    // Find the original Python test
    const pyFile = file.replace('.test.ts', '.py');
    const pyPath = `${testsDir}/${pyFile}`;
    if (fs.existsSync(pyPath)) {
      const pySource = fs.readFileSync(pyPath, 'utf-8');
      const classes = extractTests(pySource);

      for (const cls of classes) {
        const method = cls.methods.find(m => m.name === `test_${testName}`);
        if (method) {
          const code = pySource.slice(method.body.from, method.body.to);

          // Check what patterns are present
          const reasons = [];
          if (/\bnp\./.test(code)) reasons.push('np.');
          if (/\b(io|init|nn)\./.test(code)) reasons.push('io/init/nn');
          if (/\bmx\.(grad|vjp|jvp|value_and_grad|new_stream|cpu|gpu|default_device|set_default_device|export_to_dot|async_eval|synchronize|get_peak_memory|einsum|einsum_path)\b/.test(code)) reasons.push('mx.missing');
          if (/assertCmpNumpy/.test(code)) reasons.push('assertCmpNumpy');
          if (/\bmlx\./.test(code)) reasons.push('mlx.');
          if (/__array_namespace__|__dlpack__|__iter__|__next__/.test(code)) reasons.push('special');
          if (/\b(operator|pickle|weakref)\./.test(code)) reasons.push('operator/pickle');
          if (/\bself\./.test(code) && !/\bself\.assert/.test(code) && !/\bself\.subTest/.test(code)) reasons.push('self.');
          if (/\[[^\]]*:[^\]]*\]/.test(code)) reasons.push('slice');
          if (/\bif\s+.+\s+else\b/.test(code)) reasons.push('ternary');
          if (/\d+j\b/.test(code)) reasons.push('complex j');
          if (/\*\*\w+/.test(code)) reasons.push('kwargs');
          if (/\(\(\)\)/.test(code)) reasons.push('empty tuple');
          if (/\w+\[\[/.test(code)) reasons.push('double bracket');

          const key = reasons.length > 0 ? reasons.sort().join('+') : 'unknown';
          skippedReasons[key] = (skippedReasons[key] || []);
          skippedReasons[key].push(`${file}::${testName}`);
        }
      }
    }
  }
}

console.log('\\nSkipped tests by reason combination:');
Object.entries(skippedReasons)
  .sort((a, b) => b[1].length - a[1].length)
  .forEach(([reasons, tests]) => {
    console.log(`\\n${reasons} (${tests.length} tests):`);
    tests.slice(0, 5).forEach(t => console.log(`  ${t}`));
    if (tests.length > 5) console.log(`  ... and ${tests.length - 5} more`);
  });
