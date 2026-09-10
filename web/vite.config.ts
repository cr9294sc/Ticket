import { defineConfig } from 'vite';

export default defineConfig({
  // Use relative base path to support GitHub Pages and custom domain deployments
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false
  }
});

