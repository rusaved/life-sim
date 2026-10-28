import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: { __BUILD_LABEL__: '""', __PLATFORM__: '"null"' },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
