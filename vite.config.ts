import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  // Relative base so the build also works on GitHub Pages under /<repo>/
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      input: {
        app: fileURLToPath(new URL('./index.html', import.meta.url)),
        debug3d: fileURLToPath(new URL('./debug3d.html', import.meta.url)),
      },
    },
  },
});
