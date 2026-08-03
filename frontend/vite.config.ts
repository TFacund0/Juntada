import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // The app already ships its own public/manifest.webmanifest (linked
      // from index.html) — inject the service worker registration without
      // having the plugin generate/overwrite that file.
      manifest: false,
      injectRegister: false,
      registerType: "autoUpdate",
      workbox: {
        // Precache the built JS/CSS/HTML/images so a repeat visit on a slow
        // or flaky connection loads the app shell instantly from disk
        // instead of re-fetching it. Game state itself travels over the
        // WebSocket, which this never touches — nothing multiplayer-related
        // is cached, only static assets.
        globPatterns: ["**/*.{js,css,html,png,svg,ico,webmanifest}"],
        // React Router runs client-side routes like /group/:code that don't
        // exist as real files — without this, a deep link or page refresh on
        // one of those in production falls through to the static host's
        // default 404 instead of loading the SPA shell.
        navigateFallback: "/index.html",
        // A waiting service worker otherwise only takes over once every tab
        // is closed, so a deploy could sit "installed but inactive" for a
        // long time — the app keeps serving the previous bundle until then.
        // These force the new worker to activate and take control right
        // away; registration in src/main.tsx then reloads the page once
        // that happens, so a deploy shows up on the next check instead of
        // needing ~10 manual refreshes.
        skipWaiting: true,
        clientsClaim: true,
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        // React/ReactDOM/React Router barely ever change between deploys,
        // unlike the app's own code — splitting them into their own chunk
        // means a returning player's browser reuses this from cache (it's
        // content-hashed and served with an immutable Cache-Control header,
        // see backend/src/http/routes.ts) across most deploys, only
        // re-downloading the actual app-shell chunk that changed. Without
        // this split, any change anywhere invalidates one giant chunk that
        // also happens to be the one Vite already flags as oversized.
        manualChunks(id) {
          if (id.includes("node_modules") && /[\\/]react/.test(id)) return "vendor-react";
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
  },
});
