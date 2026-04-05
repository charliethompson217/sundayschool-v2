import path from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['functions/**/*.test.ts', 'types/**/*.test.ts'],
  },
  resolve: {
    alias: [{ find: /^@\/types\/(.+)$/, replacement: path.resolve(__dirname, 'types/$1') }],
  },
});
