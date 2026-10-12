import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the build also works on GitHub Pages under /<repo>/
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
  },
});
