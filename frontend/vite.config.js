import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const BACKEND = 'local'

const backendUrl = BACKEND === 'render'
  ? 'https://order-system-w9a8.onrender.com'
  : 'http://localhost:5000'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': backendUrl,
      '/uploads': backendUrl,
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui':    ['lucide-react', 'react-hot-toast'],
          'vendor-socket': ['socket.io-client'],
          'vendor-http':  ['axios'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
})
