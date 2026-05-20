import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
  },
  resolve: {
    alias: {
      '@rutan/midorable': join(__dirname, '../../packages/midorable/src/'),
      '@rutan/midorable-platform-browser': join(__dirname, '../../packages/platform-browser/src/'),
    },
  },
});
