// Build static vector tiles for spruce-dominant forest stands (Estonia).
// Pure JS: cached WFS features -> geojson-vt -> vt-pbf -> public/tiles/{z}/{x}/{y}.pbf
// Run: npm run data:tiles
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getStands } from './lib/fetch-stands.mjs'

const require = createRequire(import.meta.url)
const gvtMod = require('geojson-vt')
const geojsonvt = gvtMod.default ?? gvtMod
const vtpbfMod = require('vt-pbf')
const vtpbf = vtpbfMod.default ?? vtpbfMod

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'public', 'tiles')
const MAXZOOM = Number(process.env.MAXZOOM ?? 13)
const TOLERANCE = Number(process.env.TOLERANCE ?? 3)
const LAYER = 'eraldis'

const features = await getStands()

// Tiles carry geometry + id only (tap details are fetched from the WFS by id).
const tiled = features.map((f) => ({
  type: 'Feature',
  id: f.id,
  properties: { id: f.properties?.id },
  geometry: f.geometry,
}))

console.log(`Building tile index for ${tiled.length} features (maxZoom ${MAXZOOM})…`)
const index = new geojsonvt(
  { type: 'FeatureCollection', features: tiled },
  { maxZoom: MAXZOOM, indexMaxZoom: MAXZOOM, tolerance: TOLERANCE, extent: 4096, buffer: 64, promoteId: 'id' },
)

rmSync(OUT, { recursive: true, force: true })

let tileCount = 0
let bytes = 0
for (let z = 0; z <= MAXZOOM; z++) {
  const n = 2 ** z
  let zoomTiles = 0
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) {
      const tile = index.getTile(z, x, y)
      if (!tile || !tile.features.length) continue
      const buf = vtpbf.fromGeojsonVt({ [LAYER]: tile }, { version: 2, extent: 4096 })
      const dir = join(OUT, String(z), String(x))
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, `${y}.pbf`), buf)
      tileCount++
      zoomTiles++
      bytes += buf.length
    }
  }
  console.log(`  z${z}: ${zoomTiles} tiles`)
}

console.log(`Done: ${tileCount} tiles, ${(bytes / 1e6).toFixed(1)} MB -> ${OUT}`)
