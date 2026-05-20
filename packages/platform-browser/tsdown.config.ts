import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/canvas/index.ts', 'src/webgl/index.ts', 'src/webgpu/index.ts'],
  outDir: 'dist',
  dts: true,
});
