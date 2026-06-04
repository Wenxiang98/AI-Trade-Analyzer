import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: false, // we supply our own public/manifest.json
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            // Cache Supabase auth calls briefly
            urlPattern: /^https:\/\/.*\.supabase\.co\/auth/,
            handler: 'NetworkFirst',
            options: { cacheName: 'supabase-auth', expiration: { maxAgeSeconds: 60 } },
          },
          {
            // Cache market data for 5 minutes
            urlPattern: /\/api\/market\//,
            handler: 'NetworkFirst',
            options: { cacheName: 'market-data', expiration: { maxAgeSeconds: 300 } },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    host: true,
  },
});
