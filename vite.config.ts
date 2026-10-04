import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const rootDir = dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => {
  const isDev = mode === 'development'
  return {
    plugins: [
      react(),
      VitePWA({
        // Auto-update service worker: Workbox precaches the static build output
        // and swaps in new builds automatically once deployed.
        registerType: 'autoUpdate',
        injectRegister: false,
        includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
        workbox: isDev
          ? { globPatterns: [], cleanupOutdatedCaches: true }
          : {
              globPatterns: ['**/*.{js,css,html,svg,png,jpg,jpeg,pptx,ico,woff,woff2,ttf,wasm}'],
              cleanupOutdatedCaches: true,
              clientsClaim: true,
              skipWaiting: true,
              navigateFallback: 'index.html',
              maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
            },
      manifest: {
        id: '/',
        name: 'Guard The Heart',
        short_name: 'GuardHeart',
        description: 'Offline-first challenge and scoreboard tracker backed by SQLite.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#027479',
        background_color: '#fff4e6',
        categories: ['games', 'utilities'],
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      devOptions: {
        enabled: true,
        type: 'module',
        navigateFallback: 'index.html',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(rootDir, './src'),
      // Sequelize is a Node CommonJS library; the browser build supplies
      // minimal, side-effect-safe stand-ins for the Node builtins it touches.
      moment: resolve(rootDir, 'src/shims/moment.cjs'),
      assert: resolve(rootDir, 'src/shims/assert.cjs'),
      util: resolve(rootDir, 'src/shims/util.cjs'),
      crypto: resolve(rootDir, 'src/shims/crypto.cjs'),
      fs: resolve(rootDir, 'src/shims/fs.cjs'),
      path: resolve(rootDir, 'src/shims/path.cjs'),
      url: resolve(rootDir, 'src/shims/url.cjs'),
      'node:assert': resolve(rootDir, 'src/shims/assert.cjs'),
      'node:util': resolve(rootDir, 'src/shims/util.cjs'),
      'node:crypto': resolve(rootDir, 'src/shims/crypto.cjs'),
      'node:fs': resolve(rootDir, 'src/shims/fs.cjs'),
      'node:path': resolve(rootDir, 'src/shims/path.cjs'),
      'node:url': resolve(rootDir, 'src/shims/url.cjs'),
      // Unused PostgreSQL-only dependency that Sequelize requires eagerly.
      'pg-hstore': resolve(rootDir, 'src/shims/pg-hstore.cjs'),
    },
  },
  optimizeDeps: {
    include: ['sequelize', 'sql.js'],
    esbuildOptions: {
      target: 'esnext',
    },
  },
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 2048,
    commonjsOptions: {
      requireReturnsDefault: 'preferred',
    },
  },
  worker: {
    format: 'es',
  },
}
})