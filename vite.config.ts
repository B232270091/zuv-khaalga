import { defineConfig } from 'vite';
export default defineConfig({
  // Relative asset URLs work at / and at GitHub Pages /repository-name/.
  base: './',
  build: { rollupOptions: { output: { manualChunks: { three: ['three'] } } } },
});
