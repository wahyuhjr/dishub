import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
  // Automatic JSX runtime (matches Next.js's own default) so .jsx files
  // pulled into tests (e.g. pdf-generator.jsx, via @react-pdf/renderer)
  // don't need an explicit `import React from 'react'` just to satisfy
  // esbuild's classic transform.
  esbuild: {
    jsx: 'automatic',
  },
  resolve: {
    alias: {
      '@': path.resolve(dirname, './src'),
      // Vitest runs in plain Node without Next.js's "react-server"
      // bundler condition, so importing the real `server-only` package
      // would throw. Alias it to a no-op stub for tests only — the real
      // Next.js build still resolves the genuine package.
      'server-only': path.resolve(dirname, './src/test/stubs/server-only.js'),
    },
  },
});
