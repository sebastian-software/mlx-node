#!/usr/bin/env node
/**
 * Parser Coverage Check
 *
 * Analyzes MLX source files to detect binding patterns we might be missing.
 * Runs without needing MLX installed.
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Find monorepo root
function findRoot() {
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

// Prefer local .mlx-source, fallback to /tmp
function getDefaultMlxSource() {
  const localPath = join(ROOT_DIR, '.mlx-source', 'python', 'src');
  if (existsSync(localPath)) return localPath;
  const tmpPath = '/tmp/mlx-source/python/src';
  if (existsSync(tmpPath)) return tmpPath;
  return localPath;
}

const MLX_SOURCE = process.env.MLX_SOURCE || getDefaultMlxSource();
const BINDINGS_JSON = process.env.BINDINGS_JSON || join(ROOT_DIR, 'packages', 'mlx-node', 'generated', 'bindings.json');

// All known nanobind binding patterns
const BINDING_PATTERNS = [
  // Functions
  { name: 'm.def(', category: 'function', critical: true },

  // Classes
  { name: 'nb::class_<', category: 'class', critical: true },

  // Enums
  { name: 'nb::enum_<', category: 'enum', critical: true },

  // Module attributes
  { name: 'm.attr(', category: 'attribute', critical: true },

  // Class methods (chained after nb::class_)
  // Note: This counts ALL .def( - we'll subtract non-method patterns later
  { name: '.def(', category: 'method_raw', critical: false },

  // Submodules
  { name: '.def_submodule(', category: 'submodule', critical: false },
  { name: '.def_ro(', category: 'field_ro', critical: false },
  { name: '.def_rw(', category: 'field_rw', critical: false },
  { name: '.def_prop_ro(', category: 'property_ro', critical: false },
  { name: '.def_prop_rw(', category: 'property_rw', critical: false },
  { name: '.def_static(', category: 'static_method', critical: false },

  // Constructors
  { name: 'nb::init<', category: 'class_init', critical: false },
  { name: 'nb::init_implicit<', category: 'class_init', critical: false },

  // Operators
  { name: 'nb::self', category: 'operator', critical: false },

  // Exceptions
  { name: 'nb::exception<', category: 'exception', critical: false },
];

function countPatterns(code) {
  const counts = {};

  for (const pattern of BINDING_PATTERNS) {
    // Count occurrences
    let count = 0;
    let pos = 0;
    while ((pos = code.indexOf(pattern.name, pos)) !== -1) {
      count++;
      pos += pattern.name.length;
    }
    counts[pattern.category] = (counts[pattern.category] || 0) + count;
  }

  return counts;
}

function extractUnrecognized(code) {
  // Find things that look like bindings but we might not recognize
  const suspicious = [];

  // Pattern: .def followed by something unusual
  const defMatches = code.matchAll(/\.def(_\w+)?\s*\(/g);
  for (const match of defMatches) {
    if (match[1] && !['_ro', '_rw', '_prop_ro', '_prop_rw', '_static'].includes(match[1])) {
      suspicious.push(`.def${match[1]}(`);
    }
  }

  // Pattern: nb:: followed by something we don't know
  const nbMatches = code.matchAll(/nb::(\w+)/g);
  const knownNb = new Set([
    'class_', 'enum_', 'init', 'self', 'exception', 'arg', 'kw_only',
    'sig', 'cast', 'none', 'keep_alive', 'call_guard', 'module_',
    'bytes', 'str', 'int_', 'float_', 'bool_', 'list', 'dict', 'tuple',
    'handle', 'object', 'callable', 'type', 'isinstance', 'hasattr',
    'getattr', 'setattr', 'delattr', 'len', 'repr', 'hash', 'type_error',
    'value_error', 'index_error', 'key_error', 'stop_iteration',
    'make_iterator', 'make_key_iterator', 'make_value_iterator',
    'typed', 'ndarray', 'rv_policy', 'is_valid', 'implicitly_convertible',
  ]);

  for (const match of nbMatches) {
    if (!knownNb.has(match[1])) {
      suspicious.push(`nb::${match[1]}`);
    }
  }

  return [...new Set(suspicious)];
}

async function main() {
  console.log('='.repeat(60));
  console.log('Parser Coverage Analysis');
  console.log('='.repeat(60));
  console.log();

  let files;
  try {
    files = readdirSync(MLX_SOURCE).filter(f => f.endsWith('.cpp'));
  } catch (e) {
    console.error(`ERROR: Cannot read ${MLX_SOURCE}`);
    console.error('Run: git clone --depth 1 https://github.com/ml-explore/mlx.git /tmp/mlx-source');
    process.exit(1);
  }

  const totalCounts = {};
  const allSuspicious = [];

  for (const file of files) {
    const code = readFileSync(join(MLX_SOURCE, file), 'utf-8');
    const counts = countPatterns(code);
    const suspicious = extractUnrecognized(code);

    // Aggregate
    for (const [cat, count] of Object.entries(counts)) {
      totalCounts[cat] = (totalCounts[cat] || 0) + count;
    }
    allSuspicious.push(...suspicious);
  }

  // Count submodule functions specifically
  // Pattern: known_submodule_var.def( where var is metal, cuda, etc.
  let sourceSubmoduleFnCount = 0;
  const knownSubmoduleVars = ['metal', 'cuda']; // These use non-'m' variable names
  for (const file of files) {
    const code = readFileSync(join(MLX_SOURCE, file), 'utf-8');
    for (const varName of knownSubmoduleVars) {
      const pattern = new RegExp(`${varName}\\.def\\s*\\(`, 'g');
      const matches = code.match(pattern);
      if (matches) {
        sourceSubmoduleFnCount += matches.length;
      }
    }
  }
  totalCounts['submodule_fn'] = sourceSubmoduleFnCount;

  // method_raw counts ALL .def( which includes:
  // - m.def() functions (274)
  // - submodule functions using named vars (13 from metal+cuda)
  // - .def(nb::init<) constructors (5)
  // - Class/enum methods with quoted names (137)
  // Total = 274 + 13 + 5 + 137 = 429 (1 less than 430 due to edge case)
  const methodRaw = totalCounts['method_raw'] || 0;
  const functions = totalCounts['function'] || 0;
  const submoduleFns = sourceSubmoduleFnCount;
  const constructors = totalCounts['class_init'] || 0;
  // Actual class/enum methods = total - functions - submodule fns - constructors
  totalCounts['method'] = methodRaw - functions - submoduleFns - constructors;

  // Combine field and property counts for simpler comparison
  // Our parser captures both .def_ro and .def_prop_ro as properties
  totalCounts['all_props_ro'] = (totalCounts['field_ro'] || 0) + (totalCounts['property_ro'] || 0);
  totalCounts['all_props_rw'] = (totalCounts['field_rw'] || 0) + (totalCounts['property_rw'] || 0);

  // Load our parsed bindings
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(BINDINGS_JSON, 'utf-8'));
  } catch (e) {
    console.error(`ERROR: ${BINDINGS_JSON} not found. Run: pnpm generate`);
    process.exit(1);
  }

  // Count what we parsed
  const classes = parsed.bindings.filter(b => b.type === 'class');
  const submodules = parsed.bindings.filter(b => b.type === 'submodule');

  // Only count submodule functions from submodules that DON'T use 'm' as variable
  // (those using 'm' are already counted in the 274 functions via m.def())
  // mlx.metal and mlx.cuda use named variables, others use 'm'
  const nonMSubmodules = submodules.filter(s =>
    s.fullName === 'mlx.metal' || s.fullName === 'mlx.cuda'
  );
  const nonMSubmoduleFunctions = nonMSubmodules.reduce((sum, s) => sum + (s.functions?.length || 0), 0);

  const parsedCounts = {
    function: parsed.bindings.filter(b => b.type === 'function').length,
    class: classes.length,
    enum: parsed.bindings.filter(b => b.type === 'enum').length,
    attribute: parsed.bindings.filter(b => b.type === 'attribute').length,
    submodule: submodules.length,
    submodule_fn: nonMSubmoduleFunctions, // Only metal + cuda functions
    // Count methods and properties from parsed classes AND enums
    method: classes.reduce((sum, c) => sum + (c.methods?.length || 0), 0)
          + parsed.bindings.filter(b => b.type === 'enum').reduce((sum, e) => sum + (e.methods?.length || 0), 0),
    property_ro: classes.reduce((sum, c) => sum + (c.properties?.filter(p => p.readonly).length || 0), 0),
    property_rw: classes.reduce((sum, c) => sum + (c.properties?.filter(p => !p.readonly).length || 0), 0),
    class_init: classes.reduce((sum, c) => sum + (c.constructors?.length || 0), 0),
    static_method: classes.reduce((sum, c) => sum + (c.methods?.filter(m => m.isStatic).length || 0), 0),
    // Combined property counts (our parser merges .def_ro and .def_prop_ro)
    all_props_ro: classes.reduce((sum, c) => sum + (c.properties?.filter(p => p.readonly).length || 0), 0),
    all_props_rw: classes.reduce((sum, c) => sum + (c.properties?.filter(p => !p.readonly).length || 0), 0),
    // Individual counts for display (we don't distinguish these)
    field_ro: 0,
    field_rw: 0,
  };

  console.log('=== Pattern Counts in Source ===\n');

  // Get categories from patterns, with adjustments for our counting
  let categories = [...new Set(BINDING_PATTERNS.map(p => {
    if (p.category === 'method_raw') return 'method';
    return p.category;
  }))];
  // Add combined property categories and remove individual ones
  categories = categories.filter(c => !['field_ro', 'field_rw', 'property_ro', 'property_rw'].includes(c));
  categories.splice(categories.indexOf('method') + 1, 0, 'all_props_ro', 'all_props_rw');
  // Add submodule function count after submodule
  categories.splice(categories.indexOf('submodule') + 1, 0, 'submodule_fn');
  let hasProblems = false;

  for (const cat of categories) {
    const inSource = totalCounts[cat] || 0;
    const inParsed = parsedCounts[cat] || 0;
    const pattern = BINDING_PATTERNS.find(p => p.category === cat);
    const critical = pattern?.critical || false;

    let status = '✓';
    if (critical && inParsed < inSource * 0.9) {
      status = '✗';
      hasProblems = true;
    } else if (inParsed < inSource) {
      status = '~';
    }

    const coverage = inSource > 0 ? ((inParsed / inSource) * 100).toFixed(1) : 'N/A';

    console.log(`${status} ${cat.padEnd(15)} source: ${String(inSource).padStart(4)}  parsed: ${String(inParsed).padStart(4)}  (${coverage}%)`);
  }

  console.log();

  // Report suspicious patterns
  const uniqueSuspicious = [...new Set(allSuspicious)];
  if (uniqueSuspicious.length > 0) {
    console.log('=== Potentially Unrecognized Patterns ===\n');
    for (const s of uniqueSuspicious.slice(0, 20)) {
      console.log(`  ? ${s}`);
    }
    if (uniqueSuspicious.length > 20) {
      console.log(`  ... and ${uniqueSuspicious.length - 20} more`);
    }
    console.log();
  }

  // Summary
  console.log('=== Summary ===\n');

  const criticalPatterns = BINDING_PATTERNS.filter(p => p.critical);
  let criticalOk = true;

  for (const pattern of criticalPatterns) {
    const inSource = totalCounts[pattern.category] || 0;
    const inParsed = parsedCounts[pattern.category] || 0;

    if (inParsed < inSource * 0.9) {
      criticalOk = false;
      console.log(`WARNING: ${pattern.category} coverage is below 90%`);
    }
  }

  if (criticalOk) {
    console.log('✓ All critical patterns have good coverage (>90%)');
  }

  if (uniqueSuspicious.length > 0) {
    console.log(`⚠ Found ${uniqueSuspicious.length} potentially unrecognized patterns`);
  }

  console.log();

  // Exit code
  process.exit(hasProblems ? 1 : 0);
}

main().catch(console.error);
