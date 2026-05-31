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
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:9000', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:9000', changeOrigin: true, ws: true },
    },
  },
})
