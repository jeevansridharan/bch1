import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Polyfills needed by mainnet-js (Buffer, process, crypto, etc.)
    nodePolyfills({
      include: ['buffer', 'process', 'stream', 'util', 'crypto', 'events'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
  define: {
    // Ensure global is available for some BCH library internals
    'global': 'globalThis',
  },
  optimizeDeps: {
    // Let Vite pre-bundle mainnet-js properly
    include: ['mainnet-js'],
  },
})
