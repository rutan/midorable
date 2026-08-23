import tailwindcss from '@tailwindcss/vite';
import ttsc from '@ttsc/unplugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  plugins: [ttsc(), react(), tailwindcss()],
});
