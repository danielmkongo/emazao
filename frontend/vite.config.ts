import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import fs from 'fs'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Auto-copy logo from icon/ into public/ so it's always in the build
    {
      name: 'copy-logo',
      buildStart() {
        const src = path.resolve(__dirname, 'icon/emazao.png')
        const dest = path.resolve(__dirname, 'public/emazao.png')
        if (fs.existsSync(src)) fs.copyFileSync(src, dest)
      },
      configureServer(server) {
        const src = path.resolve(__dirname, 'icon/emazao.png')
        const dest = path.resolve(__dirname, 'public/emazao.png')
        if (fs.existsSync(src)) fs.copyFileSync(src, dest)
        server.watcher.on('change', f => {
          if (f === src) fs.copyFileSync(src, dest)
        })
      },
    },
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {
    rollupOptions: {
      output: {
        // Split the vendor code out of the app chunk. These libraries change
        // only when a dependency is upgraded, while app code changes on every
        // deploy — bundled together, one typo'd label forced every returning
        // visitor to re-download React, Framer Motion and Socket.IO as well.
        // Separated, those stay in the browser cache across releases, which is
        // what most users on Tanzanian mobile data actually feel.
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-motion': ['framer-motion'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:9000', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:9000', changeOrigin: true, ws: true },
    },
  },
})
