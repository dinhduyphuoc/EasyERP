import path from 'node:path'
import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: true,
    allowedHosts: ['ddphuoc.site', '.ddphuoc.site', 'localhost'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return
          }

          if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/')) {
            return 'react-vendor'
          }

          if (id.includes('/node_modules/react-router/')) {
            return 'router-vendor'
          }

          if (id.includes('/node_modules/@mui/icons-material/')) {
            return 'mui-icons-vendor'
          }

          if (id.includes('/node_modules/@emotion/')) {
            return 'emotion-vendor'
          }

          if (id.includes('/node_modules/@mui/')) {
            return 'mui-vendor'
          }

          if (id.includes('/node_modules/axios/')) {
            return 'axios-vendor'
          }

          if (id.includes('/node_modules/react-toastify/')) {
            return 'toast-vendor'
          }
        },
      },
    },
  },
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
})
