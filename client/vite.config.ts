import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React core
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Data fetching + state
          'vendor-query': ['@tanstack/react-query', 'zustand'],
          // Charts (heavy — recharts is ~400KB)
          'vendor-charts': ['recharts'],
          // Date utilities
          'vendor-dates': ['date-fns'],
          // UI utilities
          'vendor-ui': ['lucide-react', 'react-hot-toast', 'axios'],
        },
      },
    },
  },
})
