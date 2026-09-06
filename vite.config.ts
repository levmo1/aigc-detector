import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(process.cwd()) } },
  build: { outDir: 'dist', emptyOutDir: true },
  server: {
    // dev 模式下把 /api 代理到本地后端（npm run dev:server 启动）
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET ?? 'http://127.0.0.1:3210',
        changeOrigin: true,
      },
    },
  },
})
