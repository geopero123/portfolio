import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5174',
    },
  },
  build: {
    // three.js lives in its own lazy chunk; it is large but only loaded when the hero scene mounts
    chunkSizeWarningLimit: 1200,
  },
})
