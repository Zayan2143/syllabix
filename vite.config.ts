import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: mode === 'mock'
    ? { alias: [{ find: /^\.\/backend$/, replacement: fileURLToPath(new URL('./src/lib/backend.demo.ts', import.meta.url)) }] }
    : undefined,
  build: { sourcemap: false, chunkSizeWarningLimit: 900 },
  test: { include: ['src/**/*.test.ts'] },
}) as any);
