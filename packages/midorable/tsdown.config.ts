import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/engine/index.ts', 'src/platform/index.ts', 'src/utils/scene/index.ts'],
  outDir: 'dist',
  dts: true,
});
