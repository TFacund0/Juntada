import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // The app already ships its own public/manifest.webmanifest (linked
      // from index.html) — inject the service worker registration without
      // having the plugin generate/overwrite that file.
      manifest: false,
      injectRegister: 'auto',
      registerType: 'autoUpdate',
      workbox: {
        // Precache the built JS/CSS/HTML/images so a repeat visit on a slow
        // or flaky connection loads the app shell instantly from disk
        // instead of re-fetching it. Game state itself travels over the
        // WebSocket, which this never touches — nothing multiplayer-related
        // is cached, only static assets.
        globPatterns: ['**/*.{js,css,html,png,svg,ico,webmanifest}'],
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
  },
})
