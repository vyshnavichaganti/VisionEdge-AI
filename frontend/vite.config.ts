import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'https://visionedge-ai-4jrg.onrender.com',
        changeOrigin: true,
      },
      '/health': {
        target: process.env.VITE_API_URL || 'https://visionedge-ai-4jrg.onrender.com',
        changeOrigin: true,
      },
      '/ready': {
        target: process.env.VITE_API_URL || 'https://visionedge-ai-4jrg.onrender.com',
        changeOrigin: true,
      }
    }
  }
});
