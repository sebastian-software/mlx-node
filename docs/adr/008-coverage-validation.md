# ADR-008: Coverage Validation as Quality Gate

## Status
Accepted

## Context
With auto-generated bindings, we needed confidence that the parser captures everything. Initial parser version missed:
- Class methods (only 23% captured)
- Submodule functions (`metal.def()` vs `m.def()`)
- Enum methods (`DeviceType.__eq__`)
- Implicit constructors (`nb::init_implicit<>`)

User requirement: *"Wir sollten PRÄZISE wissen warum was fehlt und ob das okay ist."*

## Decision
Implement automated coverage validation that compares:
1. Patterns found in MLX source (via string matching)
2. Bindings extracted by our parser

Coverage check runs as CI quality gate.

## Implementation

### Pattern Counting (Source)
```javascript
// scripts/check-coverage.js
const BINDING_PATTERNS = [
  { name: 'm.def(', category: 'function', critical: true },
  { name: 'nb::class_<', category: 'class', critical: true },
  { name: 'nb::enum_<', category: 'enum', critical: true },
  { name: 'm.attr(', category: 'attribute', critical: true },
  { name: '.def(', category: 'method_raw', critical: false },
  { name: '.def_submodule(', category: 'submodule', critical: false },
  { name: '.def_prop_ro(', category: 'property_ro', critical: false },
  { name: '.def_static(', category: 'static_method', critical: false },
  { name: 'nb::init<', category: 'class_init', critical: false },
  { name: 'nb::init_implicit<', category: 'class_init', critical: false },
];

function countPatterns(code) {
  const counts = {};
  for (const pattern of BINDING_PATTERNS) {
    let count = 0, pos = 0;
    while ((pos = code.indexOf(pattern.name, pos)) !== -1) {
      count++;
      pos += pattern.name.length;
    }
    counts[pattern.category] = (counts[pattern.category] || 0) + count;
  }
  return counts;
}
```

### Method Count Calculation
```javascript
// .def( matches multiple things:
// - m.def() functions (274)
// - submodule functions metal.def(), cuda.def() (13)
// - .def(nb::init<>) constructors (6)
// - Class/enum methods with quoted names (137)

const methodRaw = totalCounts['method_raw'];
const functions = totalCounts['function'];
const submoduleFns = sourceSubmoduleFnCount;
const constructors = totalCounts['class_init'];

// Actual class/enum methods
totalCounts['method'] = methodRaw - functions - submoduleFns - constructors;
```

### Comparison with Parsed
```javascript
const parsedCounts = {
  function: parsed.bindings.filter(b => b.type === 'function').length,
  class: classes.length,
  method: classes.reduce((sum, c) => sum + (c.methods?.length || 0), 0)
         + enums.reduce((sum, e) => sum + (e.methods?.length || 0), 0),
  // ...
};

for (const cat of categories) {
  const inSource = totalCounts[cat];
  const inParsed = parsedCounts[cat];
  const coverage = (inParsed / inSource * 100).toFixed(1);

  if (critical && inParsed < inSource * 0.9) {
    hasProblems = true;  // Fail CI
  }
}
```

## Current Coverage

```
✓ function        source:  274  parsed:  274  (100.0%)
✓ class           source:   13  parsed:   13  (100.0%)
✓ enum            source:    2  parsed:    2  (100.0%)
✓ attribute       source:   22  parsed:   22  (100.0%)
✓ method          source:  137  parsed:  137  (100.0%)
✓ all_props_ro    source:   20  parsed:   20  (100.0%)
✓ submodule       source:    7  parsed:    7  (100.0%)
✓ submodule_fn    source:   13  parsed:   13  (100.0%)
✓ class_init      source:    6  parsed:    6  (100.0%)
```

## CI Integration

```yaml
# .github/workflows/ci.yml
- name: Check Coverage
  run: pnpm check-coverage
  # Fails if critical patterns < 90%
```

## Consequences

### Positive
- Immediate detection of parsing gaps
- Confidence in completeness
- Documents expected counts
- Catches regressions when MLX updates

### Negative
- Maintenance burden when MLX changes significantly
- False positives from commented-out code
- String matching may over/under-count edge cases

## Lessons Learned

Issues discovered and fixed through coverage validation:

1. **`_a` argument specifiers** - `"value"_a` incorrectly caused method skip
2. **Submodule variables** - `metal.def()` not matched by `m.def()` pattern
3. **Enum methods** - `DeviceType.__eq__` defined on enum, not class
4. **Implicit constructors** - `nb::init_implicit<>` not counted
