import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-markdown': ['react-markdown', 'remark-gfm'],
          'vendor-highlighter': ['react-syntax-highlighter'],
          'vendor-icons': ['react-icons'],
          'vendor-virtual': ['@tanstack/react-virtual'],
        },
      },
    },
  },
})

