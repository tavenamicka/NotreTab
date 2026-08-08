import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import http from 'http'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Expose sur tous les adaptateurs réseau (WiFi, etc.)
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        rewrite: (path) => path.replace(/^\/api/, ''),
        // One TCP connection per request — prevents ECONNRESET on json-server keepalive
        agent: new http.Agent({ keepAlive: false }),
      }
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.js'],
  }
})
