import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { VectorTile } = require('@mapbox/vector-tile')
const { PbfReader } = require('pbf')
const Pbf = PbfReader

const TILE = (z, x, y) =>
  `https://gsavalik.envir.ee/geoserver/gwc/service/wmts/rest/metsaregister:eraldis/metsaregister:KKP.eraldis.puistuplaan/EPSG:3857/EPSG:3857:${z}/${y}/${x}?format=application/vnd.mapbox-vector-tile`

for (const [z, x, y] of [
  [13, 4662, 2415],
  [12, 2331, 1207],
]) {
  const buf = Buffer.from(await (await fetch(TILE(z, x, y))).arrayBuffer())
  const vt = new VectorTile(new Pbf(buf))
  const layerName = Object.keys(vt.layers)[0]
  const layer = vt.layers[layerName]
  let spruce = 0
  let sample = null
  for (let i = 0; i < layer.length; i++) {
    const f = layer.feature(i)
    if (f.properties.peapuuliik_kood === 'KU') {
      spruce++
      if (!sample) sample = f.properties
    }
  }
  console.log(`z${z}: layer=${layerName} features=${layer.length} spruceKU=${spruce}`)
  console.log('  sample props:', JSON.stringify(sample).slice(0, 400))
}
