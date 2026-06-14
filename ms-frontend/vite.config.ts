import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    watch: {
      // En Windows+Docker los eventos inotify no se propagan desde el host.
      // usePolling activa chokidar polling para detectar cambios de archivos.
      usePolling: true,
      interval: 300,
    },
    proxy: {
      '/api': {
        target: 'http://ms-orchestrator:3001',
        changeOrigin: true,
      },
    },
  },
});
