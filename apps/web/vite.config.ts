import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      // jsmediatags (ID3-Tags lesen, siehe lib/player.tsx-Umfeld/Music.tsx)
      // bringt einen optionalen React-Native-Codepfad mit, der im Browser nie
      // läuft, aber vom Produktions-Build trotzdem statisch aufgelöst wird —
      // auf leeren Stub umgeleitet, siehe src/shims/react-native-fs.ts.
      'react-native-fs': fileURLToPath(new URL('./src/shims/react-native-fs.ts', import.meta.url)),
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Familientool',
        short_name: 'Familientool',
        description: 'Privates Familientool — Dokumente, Objekte, Vorlagen',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'icons.svg',
            sizes: 'any',
            type: 'image/svg+xml',
          },
        ],
      },
    }),
  ],
})
