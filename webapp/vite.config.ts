import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/__admin/gui/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    proxy: {
      '/__admin': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
