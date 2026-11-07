import { defineConfig } from 'vite';
export default defineConfig({
  base: '/',
  server: { port: 5173, allowedHosts: ['terminal.local'] },
  build: { outDir: 'dist' }
});

