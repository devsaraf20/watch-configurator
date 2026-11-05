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
          // Libraries only needed on demand stay in their own lazy chunks:
          // three/examples (glTF/Draco loaders, for uploads) and mediabunny (video encoding).
          const lazy = ['three/examples', 'mediabunny']
          if (id.includes('node_modules') && !lazy.some((l) => id.includes(l))) return 'vendor'
        },
      },
    },
  },
})
