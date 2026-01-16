import { extractTests, parseStatements } from './dist/test-converter/python-parser.js';
import { convertStatements, hasUnconvertedSyntax } from './dist/test-converter/converter.js';
import fs from 'fs';

const testName = process.argv[2] || 'test_logical_overloads';
const fileName = process.argv[3] || 'test_array.py';

const source = fs.readFileSync(`/private/tmp/mlx-source/python/tests/${fileName}`, 'utf-8');
const classes = extractTests(source);

for (const cls of classes) {
  const method = cls.methods.find(m => m.name === testName);
  if (method) {
    const statements = parseStatements(method.body, source);
    const bodyLines = convertStatements(statements, new Set(), '  ', new Map());
    const bodyCode = bodyLines.join('\n');
    console.log('Converted code:');
    console.log(bodyCode);
    console.log('\n---');
    console.log('hasUnconvertedSyntax:', hasUnconvertedSyntax(bodyCode));

    // Check each pattern
    if (/\*\*=/.test(bodyCode)) console.log('Match: **=');
    if (/[,(]\s*\*\*\w+/.test(bodyCode)) console.log('Match: **kwargs');
    if (/\(\(\)\)/.test(bodyCode)) console.log('Match: empty tuple');
    if (/[^a-zA-Z_]\d+j\b/.test(bodyCode)) console.log('Match: complex j');
    if (/\bif\s+.+\s+else\b/.test(bodyCode)) console.log('Match: ternary');
    if (/\bnp\./.test(bodyCode)) console.log('Match: np.');
    if (/\bexpectAllClose\([^)]*,\s*mx\.\w+\)/.test(bodyCode)) console.log('Match: expectAllClose pattern');
    if (/\bassertCmpNumpy\b/.test(bodyCode)) console.log('Match: assertCmpNumpy');
    if (/\w+\[\[/.test(bodyCode)) console.log('Match: double bracket');
    if (/\bmlx\./.test(bodyCode)) console.log('Match: mlx.');

    const selfPattern = /\bself\.(?!assertTrue|assertFalse|assertEqual|assertNotEqual|assertAlmostEqual|assertIsNone|assertIsNotNone|assertGreater|assertLess|assertGreaterEqual|assertLessEqual|assertIn|assertNotIn|assertListEqual|assertRaises|subTest|assertTupleEqual|assertSequenceEqual|assertEqualArray|assertCmpNumpy)\w+/;
    if (selfPattern.test(bodyCode)) console.log('Match: self.');

    if (/\bmx\.(new_stream|cpu|gpu|default_device|set_default_device|export_to_dot|async_eval|synchronize|get_peak_memory|grad|vjp|jvp|value_and_grad|einsum|einsum_path)\b/.test(bodyCode)) console.log('Match: mx.missing');

    if (/\b(io|init|nn)\./.test(bodyCode)) console.log('Match: io/init/nn');
    if (/\b_test_/.test(bodyCode)) console.log('Match: _test_');
    if (/\b(operator|pickle|weakref)\./i.test(bodyCode)) console.log('Match: operator/pickle');
    if (/__array_namespace__|__dlpack__|__iter__|__next__/.test(bodyCode)) console.log('Match: special methods');

    // Check slice pattern
    const lines = bodyCode.split('\n');
    for (const line of lines) {
      if (line.trim().startsWith('//')) continue;
      const bracketMatches = line.match(/\[[^\]]*:[^\]]*\]/g) || [];
      for (const match of bracketMatches) {
        if (/^\[\s*[\d.]+\s*,/.test(match)) continue;
        if (/^\[\s*\w+\s*,/.test(match)) continue;
        if (line.includes('pySlice')) continue;
        console.log('Match: slice - ' + match);
      }
    }

    // More patterns
    if (/~\s*mx\.array/.test(bodyCode)) console.log('Match: ~mx.array');
    if (/\bfrom\s+\w+\s+import\b/.test(bodyCode)) console.log('Match: from import');
    if (/\bfor\s+\w+\s+in\s+/.test(bodyCode) && !/for\s*\(const\s+/.test(bodyCode)) console.log('Match: generator for-in');
    if (/@=/.test(bodyCode)) console.log('Match: @=');

    const codeWithoutStrings = bodyCode.replace(/"[^"]*"/g, '""').replace(/'[^']*'/g, "''");
    if (/\.\.\.\s*[,\]]/.test(codeWithoutStrings) || /\[\s*\.\.\./.test(codeWithoutStrings)) console.log('Match: ellipsis');
    if (/,\s*,/.test(bodyCode)) console.log('Match: double comma');
    if (/\(\s*\*[^*]/.test(bodyCode) || /,\s*\*[^*]/.test(bodyCode)) console.log('Match: star unpacking');
    if (/f"[^"]*\{[^}]+:[^}]+\}/.test(bodyCode) || /f'[^']*\{[^}]+:[^}]+\}/.test(bodyCode)) console.log('Match: f-string with format');
    if (/\bf['"]/.test(bodyCode)) console.log('Match: f-string');
  }
}
