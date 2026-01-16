import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // Temporarily exclude test_ops.test.ts due to native module segfault
    exclude: ['test/generated/test_ops.test.ts'],
    globals: false,
    testTimeout: 30000,
    teardownTimeout: 10000,
  },
});
