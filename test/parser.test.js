/**
 * Parser Tests
 *
 * Tests to ensure the nanobind parser correctly extracts bindings.
 * These act as a safety net if MLX changes their binding patterns.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Import parser (need to build first)
let NanobindRegexParser, parseSignature;
try {
  const parser = await import(join(__dirname, '..', 'dist', 'parser', 'regex-parser.js'));
  NanobindRegexParser = parser.NanobindRegexParser;
  parseSignature = parser.parseSignature;
} catch (e) {
  console.error('Parser not built. Run `npm run build:ts` first.');
  console.error(e.message);
  process.exit(1);
}

describe('Parser: Function Definitions', () => {
  const parser = new NanobindRegexParser();

  test('should parse simple m.def with direct function reference', () => {
    const code = `
      m.def(
          "reshape",
          &mx::reshape,
          nb::arg(),
          "shape"_a,
          R"pbdoc(Reshape an array.)pbdoc");
    `;

    const bindings = parser.parse(code);
    assert.strictEqual(bindings.length, 1);
    assert.strictEqual(bindings[0].type, 'function');
    assert.strictEqual(bindings[0].name, 'reshape');
    assert.strictEqual(bindings[0].cppFunction, 'mx::reshape');
    assert.strictEqual(bindings[0].docstring, 'Reshape an array.');
  });

  test('should parse m.def with lambda', () => {
    const code = `
      m.def(
          "add",
          [](const mx::array& a, const mx::array& b) {
            return mx::add(a, b);
          },
          "a"_a,
          "b"_a,
          R"pbdoc(Add two arrays.)pbdoc");
    `;

    const bindings = parser.parse(code);
    assert.strictEqual(bindings.length, 1);
    assert.strictEqual(bindings[0].name, 'add');
    assert.strictEqual(bindings[0].isLambda, true);
  });

  test('should parse m.def with nb::sig signature', () => {
    const code = `
      m.def(
          "zeros",
          &mx::zeros,
          "shape"_a,
          "dtype"_a = mx::float32,
          nb::sig("def zeros(shape: Sequence[int], dtype: Dtype = float32) -> array"),
          R"pbdoc(Create array of zeros.)pbdoc");
    `;

    const bindings = parser.parse(code);
    assert.strictEqual(bindings.length, 1);
    assert.strictEqual(bindings[0].signature, 'def zeros(shape: Sequence[int], dtype: Dtype = float32) -> array');
  });

  test('should parse function with keyword-only arguments', () => {
    const code = `
      m.def(
          "matmul",
          &mx::matmul,
          nb::arg(),
          nb::arg(),
          nb::kw_only(),
          "stream"_a = nb::none(),
          nb::sig("def matmul(a: array, b: array, /, *, stream: Union[None, Stream, Device] = None) -> array"));
    `;

    const bindings = parser.parse(code);
    assert.strictEqual(bindings.length, 1);
    assert.ok(bindings[0].signature.includes('*'));
  });

  test('should handle multiline docstrings', () => {
    const code = `
      m.def(
          "conv2d",
          &mx::conv2d,
          R"pbdoc(
        Apply a 2D convolution.

        Args:
            input: The input array.
            weight: The weight array.

        Returns:
            The convolved array.
      )pbdoc");
    `;

    const bindings = parser.parse(code);
    assert.strictEqual(bindings.length, 1);
    assert.ok(bindings[0].docstring.includes('Apply a 2D convolution'));
    assert.ok(bindings[0].docstring.includes('Args:'));
  });
});

describe('Parser: Class Definitions', () => {
  const parser = new NanobindRegexParser();

  test('should parse nb::class_ definition', () => {
    const code = `
      nb::class_<mx::array>(
          m,
          "array",
          R"pbdoc(An N-dimensional array object.)pbdoc")
          .def(nb::init<>())
          .def_prop_ro("shape", &mx::array::shape);
    `;

    const bindings = parser.parse(code);
    const classes = bindings.filter(b => b.type === 'class');
    assert.strictEqual(classes.length, 1);
    assert.strictEqual(classes[0].name, 'array');
    assert.strictEqual(classes[0].cppClass, 'mx::array');
  });

  test('should parse class with template parameters', () => {
    const code = `
      nb::class_<mx::distributed::Group>(
          m,
          "Group",
          R"pbdoc(A distributed group.)pbdoc");
    `;

    const bindings = parser.parse(code);
    const classes = bindings.filter(b => b.type === 'class');
    assert.strictEqual(classes.length, 1);
    assert.strictEqual(classes[0].cppClass, 'mx::distributed::Group');
  });
});

describe('Parser: Enum Definitions', () => {
  const parser = new NanobindRegexParser();

  test('should parse nb::enum_ definition', () => {
    const code = `
      nb::enum_<mx::Dtype::Category>(
          m,
          "DtypeCategory",
          R"pbdoc(Category of data types.)pbdoc")
          .value("integer", mx::Dtype::Category::integer)
          .value("floating", mx::Dtype::Category::floating);
    `;

    const bindings = parser.parse(code);
    const enums = bindings.filter(b => b.type === 'enum');
    assert.strictEqual(enums.length, 1);
    assert.strictEqual(enums[0].name, 'DtypeCategory');
    assert.strictEqual(enums[0].cppEnum, 'mx::Dtype::Category');
  });
});

describe('Parser: Module Attributes', () => {
  const parser = new NanobindRegexParser();

  test('should parse m.attr definitions', () => {
    const code = `
      m.attr("float32") = nb::cast(mx::float32);
      m.attr("int32") = nb::cast(mx::int32);
      m.attr("pi") = 3.14159;
    `;

    const bindings = parser.parse(code);
    const attrs = bindings.filter(b => b.type === 'attribute');
    assert.strictEqual(attrs.length, 3);
    assert.ok(attrs.some(a => a.name === 'float32'));
    assert.ok(attrs.some(a => a.name === 'int32'));
    assert.ok(attrs.some(a => a.name === 'pi'));
  });
});

describe('Parser: Signature Parsing', () => {
  test('should parse simple signature', () => {
    const sig = parseSignature('def add(a: array, b: array) -> array');
    assert.strictEqual(sig.name, 'add');
    assert.strictEqual(sig.params.length, 2);
    assert.strictEqual(sig.params[0].name, 'a');
    assert.strictEqual(sig.params[0].type, 'array');
    assert.strictEqual(sig.returnType, 'array');
  });

  test('should parse signature with defaults', () => {
    const sig = parseSignature('def zeros(shape: Sequence[int], dtype: Dtype = float32) -> array');
    assert.strictEqual(sig.params.length, 2);
    assert.strictEqual(sig.params[1].default, 'float32');
    assert.strictEqual(sig.params[1].isOptional, true);
  });

  test('should parse signature with Optional type', () => {
    const sig = parseSignature('def foo(x: Optional[array]) -> array');
    assert.strictEqual(sig.params[0].type, 'Optional[array]');
    assert.strictEqual(sig.params[0].isOptional, true);
  });

  test('should parse signature with Union type', () => {
    const sig = parseSignature('def bar(stream: Union[None, Stream, Device] = None) -> array');
    assert.ok(sig.params[0].type.includes('Union'));
  });

  test('should parse positional-only marker (/)', () => {
    const sig = parseSignature('def reshape(a: array, /, shape: Sequence[int]) -> array');
    assert.strictEqual(sig.params.length, 2);
  });

  test('should parse keyword-only marker (*)', () => {
    const sig = parseSignature('def matmul(a: array, b: array, *, stream: Stream = None) -> array');
    assert.strictEqual(sig.params.length, 3);
    assert.strictEqual(sig.params[2].isKeywordOnly, true);
  });
});

describe('Parser: Edge Cases', () => {
  const parser = new NanobindRegexParser();

  test('should handle nested parentheses in lambda', () => {
    const code = `
      m.def(
          "complex_fn",
          [](const mx::array& a) {
            return mx::sum(mx::abs(mx::multiply(a, a)));
          },
          "a"_a);
    `;

    const bindings = parser.parse(code);
    assert.strictEqual(bindings.length, 1);
    assert.strictEqual(bindings[0].name, 'complex_fn');
  });

  test('should handle strings with escaped quotes', () => {
    const code = `
      m.def(
          "test",
          &mx::test,
          R"pbdoc(Use "quotes" in docstring.)pbdoc");
    `;

    const bindings = parser.parse(code);
    assert.ok(bindings[0].docstring.includes('"quotes"'));
  });

  test('should handle empty input', () => {
    const bindings = parser.parse('');
    assert.strictEqual(bindings.length, 0);
  });

  test('should handle code without bindings', () => {
    const code = `
      #include <iostream>
      int main() {
        std::cout << "Hello" << std::endl;
        return 0;
      }
    `;

    const bindings = parser.parse(code);
    assert.strictEqual(bindings.length, 0);
  });
});

describe('Parser: Real MLX Patterns', () => {
  const parser = new NanobindRegexParser();

  test('should parse pattern from MLX ops.cpp', () => {
    // Real pattern from MLX
    const code = `
      m.def(
          "abs",
          [](const ScalarOrArray& a, mx::StreamOrDevice s) {
            return mx::abs(to_array(a), s);
          },
          nb::arg(),
          nb::kw_only(),
          "stream"_a = nb::none(),
          nb::sig("def abs(a: array, /, *, stream: Union[None, Stream, Device] = None) -> array"),
          R"pbdoc(
            Element-wise absolute value.

            Args:
                a (array): Input array.
                stream (Stream, optional): Stream or device.

            Returns:
                array: The absolute value of each element.
          )pbdoc");
    `;

    const bindings = parser.parse(code);
    assert.strictEqual(bindings.length, 1);
    assert.strictEqual(bindings[0].name, 'abs');
    assert.strictEqual(bindings[0].isLambda, true);
    assert.ok(bindings[0].signature.includes('def abs'));
    assert.ok(bindings[0].docstring.includes('Element-wise absolute value'));
  });

  test('should parse pattern from MLX array.cpp', () => {
    const code = `
      nb::class_<mx::Dtype>(
          m,
          "Dtype",
          R"pbdoc(
          An object to hold the type of a :class:\`array\`.

          See the :ref:\`list of types <data_types>\` for more details.
          )pbdoc")
          .def_prop_ro(
              "size", &mx::Dtype::size, R"pbdoc(Size of the type in bytes.)pbdoc")
          .def("__repr__", [](const mx::Dtype& t) {
            std::ostringstream os;
            os << "mlx.core." << t;
            return os.str();
          });
    `;

    const bindings = parser.parse(code);
    const classes = bindings.filter(b => b.type === 'class');
    assert.strictEqual(classes.length, 1);
    assert.strictEqual(classes[0].name, 'Dtype');
  });
});

describe('Parser: Statistics Validation', () => {
  test('should extract expected number of bindings from real MLX source', async () => {
    // This test validates against the actual MLX source if available
    const mlxSourceDir = '/tmp/mlx-source/python/src';

    let opsCode;
    try {
      opsCode = readFileSync(join(mlxSourceDir, 'ops.cpp'), 'utf-8');
    } catch {
      // Skip if MLX source not available
      console.log('  (skipped - MLX source not available)');
      return;
    }

    const parser = new NanobindRegexParser();
    const bindings = parser.parse(opsCode);
    const functions = bindings.filter(b => b.type === 'function');

    // ops.cpp should have a significant number of functions
    assert.ok(functions.length > 100, `Expected >100 functions, got ${functions.length}`);

    // Most should have signatures
    const withSig = functions.filter(f => f.signature);
    const sigRatio = withSig.length / functions.length;
    assert.ok(sigRatio > 0.7, `Expected >70% with signatures, got ${(sigRatio * 100).toFixed(1)}%`);

    console.log(`  Found ${functions.length} functions, ${withSig.length} with signatures (${(sigRatio * 100).toFixed(1)}%)`);
  });
});
