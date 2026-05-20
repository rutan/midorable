import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const fixtureDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: fixtureDir,
  resolve: {
    alias: {
      '@rutan/midorable': resolve(fixtureDir, '../../../../midorable/src'),
      '@rutan/midorable-platform-browser': resolve(fixtureDir, '../../../src'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 41731,
    strictPort: true,
  },
});
