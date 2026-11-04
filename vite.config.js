import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        // Libraries change rarely: keep them in their own long-cacheable chunk.
        manualChunks(id) {
          // three/examples (glTF/Draco loaders) is only needed for uploads, so it
          // stays in the on-demand upload chunk instead.
          if (id.includes('node_modules') && !id.includes('three/examples')) return 'vendor'
        },
      },
    },
  },
})
