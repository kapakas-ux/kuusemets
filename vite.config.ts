import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [svelte()],
  // maplibre-gl v6 ships an ESM web worker that Vite's dep optimizer mishandles.
  optimizeDeps: { exclude: ['maplibre-gl'] },
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
})
