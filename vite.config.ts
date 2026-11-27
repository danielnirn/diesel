import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative paths so the app also works under a sub-path (GitHub Pages).
  base: './',
  plugins: [react()],
})
