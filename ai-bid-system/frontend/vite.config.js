import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      // 只要是 /v1 开头的请求，统统毫无保留地转发给 target
      '/v1': {
        target: process.env.VITE_DIFY_TARGET || 'http://localhost', // 你的 Dify 后端真实地址
        changeOrigin: true
        // 删掉 rewrite！什么都不写，原汁原味转发！
      },
      '/baidu-api': {
        target: 'https://aip.baidubce.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/baidu-api/, '')
      }
    }
  }
})