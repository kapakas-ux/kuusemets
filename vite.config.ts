import { defineConfig, type Plugin } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// maplibre-gl builds its web-worker URL dynamically, so Vite never sees it and the
// worker is missing from the bundle. Emit it alongside the other assets.
function emitMaplibreWorker(): Plugin {
  return {
    name: 'emit-maplibre-worker',
    apply: 'build',
    generateBundle() {
      try {
        const worker = fileURLToPath(
          new URL('./node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url),
        )
        this.emitFile({
          type: 'asset',
          fileName: 'assets/maplibre-gl-worker.mjs',
          source: readFileSync(worker),
        })
      } catch {
        this.warn('Could not emit maplibre-gl-worker.mjs')
      }
    },
  }
}

export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [svelte(), emitMaplibreWorker()],
  // maplibre-gl v6 ships an ESM web worker that Vite's dep optimizer mishandles.
  optimizeDeps: { exclude: ['maplibre-gl'] },
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
})
