// Shared: download (and cache) spruce-dominant forest stands from the Estonian Forest Register WFS.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const CACHE = join(__dirname, '..', '.cache', 'stands.json')

const WFS = 'https://gsavalik.envir.ee/geoserver/metsaregister/ows'
// Spruce-dominant stands that are government-owned (state / public-law / municipal),
// excluding private ownership (Eraomand) and unknown.
const FILTER = "peapuuliik_kood='KU' AND omandivorm_kood IN ('R','T','M','A','KK')"
const PAGE = 100000
const KEEP = ['id', 'pindala', 'peapuuliik_kood', 'kasvukoht_kood', 'boniteedi_kood', 'arengukl_kood', 'keskm_vanus', 'korgus', 'kuivendatud']

function slim(props) {
  const out = {}
  for (const k of KEEP) if (props[k] !== undefined) out[k] = props[k]
  return out
}

async function fetchPage(startIndex) {
  const params = new URLSearchParams({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typeNames: 'metsaregister:eraldis',
    CQL_FILTER: FILTER,
    srsName: 'EPSG:4326',
    outputFormat: 'application/json',
    sortBy: 'id',
    count: String(PAGE),
    startIndex: String(startIndex),
  })
  const res = await fetch(`${WFS}?${params}`)
  if (!res.ok) throw new Error(`WFS HTTP ${res.status}`)
  return res.json()
}

export async function getStands() {
  if (existsSync(CACHE)) {
    const cached = JSON.parse(readFileSync(CACHE, 'utf8'))
    console.log(`Loaded ${cached.length} cached features from ${CACHE}`)
    return cached
  }
  console.log('Downloading spruce-dominant stands from WFS…')
  const features = []
  let startIndex = 0
  for (let i = 0; i < 50; i++) {
    const page = await fetchPage(startIndex)
    for (const f of page.features) {
      if (!f.geometry) continue
      features.push({ type: 'Feature', id: f.properties?.id, properties: slim(f.properties ?? {}), geometry: f.geometry })
    }
    console.log(`  page ${i}: +${page.features.length} (total ${features.length})`)
    if (page.features.length < PAGE) break
    startIndex += PAGE
  }
  mkdirSync(dirname(CACHE), { recursive: true })
  writeFileSync(CACHE, JSON.stringify(features))
  console.log(`Cached ${features.length} features to ${CACHE}`)
  return features
}
