export const WFS = 'https://gsavalik.envir.ee/geoserver/metsaregister/ows'

export const BASEMAP_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

/** Baked static tiles of spruce-dominant stands (geometry + id), all zoom levels. */
export const SPRUCE_TILES = `${import.meta.env.BASE_URL}tiles/{z}/{x}/{y}.pbf`

export const BASEMAP_ATTRIBUTION = '© OpenStreetMap contributors'
export const DATA_ATTRIBUTION = 'Metsaregister, Keskkonnaagentuur (CC BY 4.0)'

/** Fetch spruce-dominant stands intersecting a lon/lat box (used for high-zoom views). */
export async function fetchStandsInBounds(
  west: number,
  south: number,
  east: number,
  north: number,
  limit = 8000,
): Promise<GeoJSON.FeatureCollection | null> {
  const cql = `peapuuliik_kood='KU' AND BBOX(shape,${west},${south},${east},${north},'EPSG:4326')`
  const url =
    `${WFS}?service=WFS&version=2.0.0&request=GetFeature` +
    `&typeNames=metsaregister:eraldis&outputFormat=application/json` +
    `&srsName=EPSG:4326&count=${limit}&CQL_FILTER=${encodeURIComponent(cql)}`
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return (await res.json()) as GeoJSON.FeatureCollection
  } catch {
    return null
  }
}

export interface ClassifierMaps {
  species: Record<string, string>
  site: Record<string, string>
}

export async function fetchClassifier(layer: string): Promise<Record<string, string>> {
  try {
    const url =
      `${WFS}?service=WFS&version=2.0.0&request=GetFeature` +
      `&typeNames=metsaregister:${layer}&outputFormat=application/json`
    const res = await fetch(url)
    if (!res.ok) return {}
    const json = await res.json()
    const out: Record<string, string> = {}
    for (const f of json.features ?? []) {
      const p = f.properties ?? {}
      const code = p.kood ?? p.KOOD
      const label = p.kirjeldus ?? p.KIRJELDUS
      if (code != null) out[String(code)] = String(label ?? code)
    }
    return out
  } catch {
    return {}
  }
}

export async function loadClassifiers(): Promise<ClassifierMaps> {
  const [species, site] = await Promise.all([
    fetchClassifier('kl_puuliik'),
    fetchClassifier('kl_kasvukoht'),
  ])
  return { species, site }
}

export interface StandProps {
  id?: number | string
  pindala?: number
  peapuuliik_kood?: string
  kasvukoht_kood?: string
  boniteedi_kood?: string
  arengukl_kood?: string
  keskm_vanus?: number | null
  korgus?: number | null
  kuivendatud?: boolean
  [k: string]: unknown
}

export async function fetchStandById(id: number | string): Promise<StandProps | null> {
  try {
    const cql = encodeURIComponent(`id=${id}`)
    const url =
      `${WFS}?service=WFS&version=2.0.0&request=GetFeature` +
      `&typeNames=metsaregister:eraldis&outputFormat=application/json` +
      `&srsName=EPSG:4326&CQL_FILTER=${cql}`
    const res = await fetch(url)
    if (!res.ok) return null
    const json = await res.json()
    return json.features?.[0]?.properties ?? null
  } catch {
    return null
  }
}

export function metersPerPixel(lat: number, zoom: number): number {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom)
}
