import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev: Vite serves the UI on :5173 and forwards /api to the Express proxy on :8091 (8090 is left for Docker).
export default defineConfig({
  root: 'web',
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: { '/api': 'http://localhost:8091' },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
  },
});
