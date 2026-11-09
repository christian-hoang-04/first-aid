import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: { dedupe: ['react', 'react-dom'] },
  server: {
    proxy: {
      '/api': { target: process.env.API_PROXY_TARGET || 'http://127.0.0.1:8080', changeOrigin: true },
      '/voice-runtime': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        rewrite: () => '/api/livekit/token',
      },
    },
  },
})
