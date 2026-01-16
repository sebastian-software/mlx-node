import { parser } from '@lezer/python';
import { readFileSync, readdirSync } from 'fs';

function collectTypes(node, types = new Map()) {
  const count = types.get(node.type.name) || 0;
  types.set(node.type.name, count + 1);
  for (let child = node.firstChild; child; child = child.nextSibling) {
    collectTypes(child, types);
  }
  return types;
}

// Parse all test files
const testDir = '/private/tmp/mlx-source/python/tests';
const allTypes = new Map();

for (const file of readdirSync(testDir)) {
  if (!file.endsWith('.py')) continue;
  const source = readFileSync(`${testDir}/${file}`, 'utf-8');
  const tree = parser.parse(source);
  collectTypes(tree.topNode, allTypes);
}

// Sort by frequency
const sorted = [...allTypes.entries()].sort((a, b) => b[1] - a[1]);
console.log('All node types in MLX tests (by frequency):');
for (const [type, count] of sorted) {
  console.log(`  ${type}: ${count}`);
}
