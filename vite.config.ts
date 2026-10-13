import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base: './' keeps the build portable (GitHub Pages sub-path or custom domain)
export default defineConfig({
  base: './',
  plugins: [react()],
})
