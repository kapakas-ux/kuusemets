<script lang="ts">
  import { onMount } from 'svelte'
  import {
    Map,
    Marker,
    ScaleControl,
    type GeoJSONSource,
    type FilterSpecification,
    type MapLayerMouseEvent,
  } from 'maplibre-gl'
  import 'maplibre-gl/dist/maplibre-gl.css'
  import { dict, type Lang } from './lib/i18n'
  import {
    BASEMAP_TILES,
    SPRUCE_TILES,
    BASEMAP_ATTRIBUTION,
    DATA_ATTRIBUTION,
    loadClassifiers,
    fetchStandById,
    fetchStandsInBounds,
    metersPerPixel,
    type StandProps,
  } from './lib/forest'

  let lang = $state<Lang>('et')
  const t = (key: string) => dict[lang][key] ?? key

  let mapEl: HTMLDivElement
  let map: Map | undefined

  let labels = $state<{
    species: Record<string, string>
    site: Record<string, string>
    ownership: Record<string, string>
  }>({
    species: {},
    site: {},
    ownership: {},
  })
  let selected = $state<StandProps | null>(null)
  let selectedId = $state<number | string | null>(null)
  let selectedPoint = $state<{ lng: number; lat: number } | null>(null)
  let showAbout = $state(false)
  let showDensity = $state(false)
  let tracking = $state(false)
  let locating = $state(false)
  let geoError = $state('')
  let zoom = $state(7)
  let ready = $state(false)

  let userMarker: Marker | undefined
  let watchId: number | undefined
  let userPos: { lng: number; lat: number; acc: number } | null = null

  let viewTimer: ReturnType<typeof setTimeout> | undefined
  let viewReq = 0

  // Below this zoom the baked tiles render; at/above it we query the WFS for the viewport.
  const VIEW_MINZOOM = 12

  const boundaryWidth = [
    'interpolate',
    ['linear'],
    ['zoom'],
    6,
    0.25,
    10,
    0.5,
    13,
    0.9,
    16,
    1.4,
  ] as unknown as number

  function speciesLabel(code?: string) {
    if (!code) return '—'
    return labels.species[code] ?? code
  }
  function siteLabel(code?: string) {
    if (!code) return '—'
    return labels.site[code] ?? code
  }
  function ownershipLabel(code?: string) {
    if (!code) return '—'
    return labels.ownership[code] ?? code
  }

  function updateAccuracyRadius() {
    if (!map || !userPos) return
    const mpp = metersPerPixel(userPos.lat, map.getZoom())
    const radius = Math.max(6, Math.min(2000, userPos.acc / mpp))
    map.setPaintProperty('user-acc', 'circle-radius', radius)
  }

  function updateUserSource() {
    if (!map || !userPos) return
    const data = {
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [userPos.lng, userPos.lat] },
      properties: {},
    }
    const src = map.getSource('user-acc') as GeoJSONSource | undefined
    if (src) src.setData(data)
    updateAccuracyRadius()
  }

  function onPosition(pos: GeolocationPosition) {
    if (!map) return
    locating = false
    geoError = ''
    tracking = true
    const { longitude, latitude, accuracy } = pos.coords
    userPos = { lng: longitude, lat: latitude, acc: accuracy }
    if (!userMarker) {
      userMarker = new Marker({ color: '#1565c0' }).setLngLat([longitude, latitude]).addTo(map)
    } else {
      userMarker.setLngLat([longitude, latitude])
    }
    updateUserSource()
    map.flyTo({ center: [longitude, latitude], zoom: Math.max(map.getZoom(), 15), duration: 900 })
  }

  function onGeoError() {
    locating = false
    tracking = false
    geoError = t('geoDenied')
  }

  function toggleLocate() {
    if (tracking) {
      if (watchId !== undefined) navigator.geolocation.clearWatch(watchId)
      watchId = undefined
      tracking = false
      userPos = null
      userMarker?.remove()
      userMarker = undefined
      const src = map?.getSource('user-acc') as GeoJSONSource | undefined
      src?.setData({ type: 'FeatureCollection', features: [] })
      return
    }
    if (!('geolocation' in navigator)) {
      geoError = t('geoUnsupported')
      return
    }
    locating = true
    geoError = ''
    watchId = navigator.geolocation.watchPosition(onPosition, onGeoError, {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 15000,
    })
  }

  async function refreshViewport() {
    const m = map
    if (!m) return
    const src = m.getSource('spruceView') as GeoJSONSource | undefined
    if (!src) return
    if (m.getZoom() < VIEW_MINZOOM) {
      src.setData({ type: 'FeatureCollection', features: [] })
      return
    }
    const b = m.getBounds()
    const req = ++viewReq
    const fc = await fetchStandsInBounds(b.getWest(), b.getSouth(), b.getEast(), b.getNorth())
    if (req !== viewReq) return
    if (fc) src.setData(fc)
  }

  function scheduleViewport() {
    clearTimeout(viewTimer)
    viewTimer = setTimeout(refreshViewport, 250)
  }

  function setSelectedFilters(id: number | string | null) {
    const f = (['==', ['get', 'id'], id != null ? Number(id) : -1]) as unknown as FilterSpecification
    map?.setFilter('sel-baked', f)
    map?.setFilter('sel-view', f)
  }

  async function selectStand(props: StandProps, id: number | string | null) {
    selected = props
    selectedId = id
    setSelectedFilters(id)
    if (id != null) {
      const full = await fetchStandById(id)
      if (full && selectedId === id) selected = full
    }
  }

  function closeSheet() {
    selected = null
    selectedId = null
    selectedPoint = null
    setSelectedFilters(null)
  }

  function onStandClick(e: MapLayerMouseEvent) {
    const f = e.features?.[0]
    if (!f) return
    const props = (f.properties ?? {}) as StandProps
    const id = (props.id ?? f.id ?? null) as number | string | null
    selectedPoint = { lng: e.lngLat.lng, lat: e.lngLat.lat }
    void selectStand(props, id)
  }

  $effect(() => {
    ready
    const m = map
    if (!m || !m.getLayer('overview-fill')) return
    m.setLayoutProperty('overview-fill', 'visibility', showDensity ? 'visible' : 'none')
  })

  onMount(() => {
    map = new Map({
      container: mapEl,
      style: {
        version: 8,
        sources: {
          basemap: {
            type: 'raster',
            tiles: [BASEMAP_TILES],
            tileSize: 256,
            maxzoom: 19,
            attribution: BASEMAP_ATTRIBUTION,
          },
          // Baked static tiles: real stand boundaries below z12 (geometry + id only).
          spruce: {
            type: 'vector',
            tiles: [SPRUCE_TILES],
            minzoom: 0,
            maxzoom: 12,
            attribution: DATA_ATTRIBUTION,
          },
          // High-zoom boundaries, fetched per viewport from the WFS.
          spruceView: {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          },
          overview: {
            type: 'geojson',
            data: `${import.meta.env.BASE_URL}overview.geojson`,
          },
          'user-acc': {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          },
        },
        layers: [
          { id: 'basemap', type: 'raster', source: 'basemap' },
          {
            id: 'overview-fill',
            type: 'fill',
            source: 'overview',
            maxzoom: 12,
            layout: { visibility: 'none' },
            paint: {
              'fill-color': [
                'interpolate',
                ['linear'],
                ['get', 'v'],
                0,
                'rgba(46,125,50,0.06)',
                40,
                'rgba(46,125,50,0.28)',
                120,
                'rgba(46,125,50,0.5)',
                370,
                'rgba(20,64,26,0.78)',
              ],
              'fill-opacity': 0.85,
            },
          },
          {
            id: 'spruce-baked-fill',
            type: 'fill',
            source: 'spruce',
            'source-layer': 'eraldis',
            maxzoom: VIEW_MINZOOM,
            paint: { 'fill-color': '#2e7d32', 'fill-opacity': 0.38 },
          },
          {
            id: 'spruce-baked-line',
            type: 'line',
            source: 'spruce',
            'source-layer': 'eraldis',
            maxzoom: VIEW_MINZOOM,
            paint: { 'line-color': '#1b5e20', 'line-width': boundaryWidth, 'line-opacity': 0.9 },
          },
          {
            id: 'spruce-view-fill',
            type: 'fill',
            source: 'spruceView',
            minzoom: VIEW_MINZOOM,
            paint: { 'fill-color': '#2e7d32', 'fill-opacity': 0.4 },
          },
          {
            id: 'spruce-view-line',
            type: 'line',
            source: 'spruceView',
            minzoom: VIEW_MINZOOM,
            paint: { 'line-color': '#1b5e20', 'line-width': boundaryWidth, 'line-opacity': 0.9 },
          },
          {
            id: 'sel-baked',
            type: 'line',
            source: 'spruce',
            'source-layer': 'eraldis',
            maxzoom: VIEW_MINZOOM,
            filter: ['==', ['get', 'id'], -1],
            paint: { 'line-color': '#ffd54f', 'line-width': 3 },
          },
          {
            id: 'sel-view',
            type: 'line',
            source: 'spruceView',
            minzoom: VIEW_MINZOOM,
            filter: ['==', ['get', 'id'], -1],
            paint: { 'line-color': '#ffd54f', 'line-width': 3 },
          },
          {
            id: 'user-acc',
            type: 'circle',
            source: 'user-acc',
            paint: {
              'circle-radius': 12,
              'circle-color': '#1565c0',
              'circle-opacity': 0.15,
              'circle-stroke-color': '#1565c0',
              'circle-stroke-opacity': 0.5,
              'circle-stroke-width': 1,
            },
          },
        ],
      },
      center: [25.6, 58.75],
      zoom: 7,
      minZoom: 5,
      maxZoom: 18,
      attributionControl: { compact: true },
    })

    map.addControl(new ScaleControl({ maxWidth: 100, unit: 'metric' }), 'bottom-left')

    if (import.meta.env.DEV) {
      ;(window as unknown as { __map?: Map }).__map = map
    }

    map.on('load', () => {
      ready = true
      void refreshViewport()
    })
    map.on('zoom', () => {
      if (map) zoom = map.getZoom()
      updateAccuracyRadius()
    })
    map.on('moveend', scheduleViewport)

    for (const layer of ['spruce-baked-fill', 'spruce-view-fill']) {
      map.on('click', layer, onStandClick)
      map.on('mouseenter', layer, () => {
        if (map) map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', layer, () => {
        if (map) map.getCanvas().style.cursor = ''
      })
    }

    const onResize = () => map?.resize()
    window.addEventListener('resize', onResize)

    void loadClassifiers().then((m) => (labels = m))

    return () => {
      window.removeEventListener('resize', onResize)
      clearTimeout(viewTimer)
      if (watchId !== undefined) navigator.geolocation.clearWatch(watchId)
      map?.remove()
      map = undefined
    }
  })
</script>

<div class="map" bind:this={mapEl} style="position:absolute; inset:0; width:100%; height:100%"></div>

<div class="topbar">
  <div class="brand">
    <svg class="logo" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2 6 10h3l-4 6h5v4h4v-4h5l-4-6h3z" fill="#2e7d32" />
      <rect x="10.5" y="19" width="3" height="3" rx="0.6" fill="#6d4c41" />
    </svg>
    <div>
      <h1>{t('title')}</h1>
      <small>{t('subtitle')}</small>
    </div>
  </div>
  <div class="spacer"></div>
  <button
    class="pillbtn"
    class:active={showDensity}
    onclick={() => (showDensity = !showDensity)}
    aria-pressed={showDensity}
  >
    {t('density')}
  </button>
  <div class="lang" role="group" aria-label="language">
    <button class:active={lang === 'et'} onclick={() => (lang = 'et')}>ET</button>
    <button class:active={lang === 'en'} onclick={() => (lang = 'en')}>EN</button>
  </div>
  <button class="pillbtn" onclick={() => (showAbout = true)} aria-label={t('openAbout')}>i</button>
</div>

<div class="legend">
  <span class="swatch"></span>
  {t('legend')}
</div>

<button
  class="fab"
  class:tracking
  onclick={toggleLocate}
  disabled={locating}
  aria-label={t('locate')}
  title={t('locate')}
>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <circle cx="12" cy="12" r="6" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke-linecap="round" />
  </svg>
</button>

{#if geoError}
  <div class="hint error" style="bottom: calc(96px + var(--safe-b))">{geoError}</div>
{/if}

{#if selected}
  <div class="sheet" role="dialog" aria-label={t('details')}>
    <div class="grabber"></div>
    <div class="sheet-head">
      <span class="badge">{t('spruceBadge')}</span>
      <h2>{t('details')}</h2>
      <button class="iconbtn" onclick={closeSheet} aria-label={t('close')}>✕</button>
    </div>
    <dl class="grid">
      <div class="field">
        <dt>{t('area')}</dt>
        <dd>{selected.pindala ?? '—'} {t('hectares')}</dd>
      </div>
      <div class="field">
        <dt>{t('dominant')}</dt>
        <dd>{speciesLabel(selected.peapuuliik_kood)}</dd>
      </div>
      <div class="field">
        <dt>{t('siteType')}</dt>
        <dd>{siteLabel(selected.kasvukoht_kood)}</dd>
      </div>
      <div class="field">
        <dt>{t('siteQuality')}</dt>
        <dd>{selected.boniteedi_kood ?? '—'}</dd>
      </div>
      <div class="field">
        <dt>{t('devClass')}</dt>
        <dd>{selected.arengukl_kood ?? '—'}</dd>
      </div>
      <div class="field">
        <dt>{t('meanAge')}</dt>
        <dd>{selected.keskm_vanus ?? '—'} {t('years')}</dd>
      </div>
      <div class="field">
        <dt>{t('meanHeight')}</dt>
        <dd>{selected.korgus ?? '—'} {t('meters')}</dd>
      </div>
      <div class="field">
        <dt>{t('drained')}</dt>
        <dd>{selected.kuivendatud ? t('yes') : t('no')}</dd>
      </div>
      <div class="field span2">
        <dt>{t('ownership')}</dt>
        <dd>{ownershipLabel(selected.omandivorm_kood)}</dd>
      </div>
    </dl>
    {#if selectedPoint}
      <a
        class="cta"
        href="https://www.google.com/maps/dir/?api=1&destination={selectedPoint.lat},{selectedPoint.lng}"
        target="_blank"
        rel="noreferrer"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2 3 21l9-4 9 4z" />
        </svg>
        {t('takeMeThere')}
      </a>
    {/if}
  </div>
{/if}

{#if showAbout}
  <div class="scrim" onclick={() => (showAbout = false)} role="presentation"></div>
  <div class="about" role="dialog" aria-label={t('aboutTitle')}>
    <div class="grabber"></div>
    <div class="sheet-head">
      <h2>{t('aboutTitle')}</h2>
      <button class="iconbtn" onclick={() => (showAbout = false)} aria-label={t('close')}>✕</button>
    </div>
    <p>{t('aboutBody')}</p>
    <p>{t('target')}</p>
    <div class="credit">
      <div>🌲 {t('dataCredit')}</div>
      <div>🗺️ {t('basemapCredit')}</div>
      <div>
        <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer"
          >CC BY 4.0</a
        >
      </div>
    </div>
  </div>
{/if}
