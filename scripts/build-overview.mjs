// Build a compact nationwide spruce-density overview grid from the cached stands.
// Output: public/overview.geojson  (FeatureCollection of grid cells with `v` = spruce ha)
// Run: npm run data:overview
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getStands } from './lib/fetch-stands.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'public', 'overview.geojson')
const CELL = 0.03 // degrees (~2 km)

const features = await getStands()

function bboxCenter(geom) {
  let minX = 180, minY = 90, maxX = -180, maxY = -90
  const rings = geom.type === 'Polygon' ? geom.coordinates : geom.coordinates.flat()
  for (const ring of rings) {
    for (const [x, y] of ring) {
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  return [(minX + maxX) / 2, (minY + maxY) / 2]
}

const cells = new Map()
let totalArea = 0
for (const f of features) {
  if (!f.geometry) continue
  const [lon, lat] = bboxCenter(f.geometry)
  const key = `${Math.floor(lon / CELL)},${Math.floor(lat / CELL)}`
  const area = Number(f.properties?.pindala) || 0
  const cur = cells.get(key) ?? { count: 0, area: 0 }
  cur.count += 1
  cur.area += area
  cells.set(key, cur)
  totalArea += area
}

const round = (n) => Math.round(n * 1000) / 1000
const out = { type: 'FeatureCollection', features: [] }
for (const [key, v] of cells) {
  const [cx, cy] = key.split(',').map(Number)
  const x0 = cx * CELL, y0 = cy * CELL
  out.features.push({
    type: 'Feature',
    properties: { v: Math.round(v.area * 10) / 10, n: v.count },
    geometry: {
      type: 'Polygon',
      coordinates: [[[round(x0), round(y0)], [round(x0 + CELL), round(y0)], [round(x0 + CELL), round(y0 + CELL)], [round(x0), round(y0 + CELL)], [round(x0), round(y0)]]],
    },
  })
}

const json = JSON.stringify(out)
const maxArea = Math.max(...out.features.map((f) => f.properties.v))
writeFileSync(OUT, json)
console.log(`overview: ${out.features.length} cells, max area ${maxArea} ha, ${(json.length / 1e3).toFixed(0)} KB, total spruce ${Math.round(totalArea).toLocaleString()} ha`)
