import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Relative base so the built app also runs from a file server subfolder.
  base: './',
  plugins: [react()],
  build: {
    // The corpus lives in public/, so warn only on genuinely large JS.
    chunkSizeWarningLimit: 900,
  },
})
