import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Relative base so asset URLs resolve against a runtime <base href> (see index.html).
  // This allows the GUI to work behind a reverse-proxy sub-path without rebuilding.
  base: './',
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
