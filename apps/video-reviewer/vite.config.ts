import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The reviewer's data and media come from scripts/serve-reviewer.mjs in apps/claude-remotion.
// Proxying in dev keeps the app on one origin, so fetch() and <video src> behave the same here as
// they do when this is built and served by that same process.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:5199',
      '/media': 'http://127.0.0.1:5199',
    },
  },
})
