# Wayfinding map: Spruce forest map for Estonian mushroom pickers

Label: `wayfinder:map`

## Destination

A **build-ready spec** for a mobile-first PWA that helps find **Lactarius deterrimus** (kuuseriisikas) by showing a map of Estonia with the borders of **forest stands that contain spruce**, the user's location, and tap-for-details per stand. Spruce is the species' obligate host, so stands containing spruce are the target habitat. Reaching the end of this map means every decision below is settled, so someone can build the app without further planning.

## Notes

- **Domain**: Estonian forestry + mycology + open geodata. The target is **Lactarius deterrimus**, a milkcap whose obligate mycorrhizal host is **spruce** — so spruce stands are the *necessary* habitat and non-spruce forests cannot hold it. See `../../GLOSSARY.md`. UI language not yet decided (ticket 04).
- **Primary data source** (researched, ticket 01): Estonian Forest Register, Keskkonnaagentuur, via the public WFS `https://gsavalik.envir.ee/geoserver/metsaregister/ows?`; stand layer `metsaregister:eraldis` (polygons, `EPSG:3301`); species composition in `metsaregister:eraldis_element` (spruce = `puuliik_kood='KU'`). Licence **CC-BY 4.0** (credit Keskkonnaagentuur). No auth.
- **Standing preferences** (settled while naming the destination and mapping the frontier):
  - Mobile-first **PWA**; no native apps, no accounts.
  - Whole of Estonia; online-only for v1.
  - "Spruce forest" = a stand whose **dominant** species is spruce. (A "contains spruce" filter was tested and rejected: it matches 1,155,275 stands ≈ 65% of Estonia's forest.)
  - Map library: **MapLibre GL JS**.
  - Data delivery: pre-extracted static **vector tiles (PMTiles)**, scheduled refresh.
  - Basemap: **Maa-amet WMS** (`kaart.maaamet.ee/wms/alus`), OSM fallback.
  - Hosting: **Cloudflare Pages + R2**.
  - App stack: **Vite + TypeScript + Svelte**.
  - MVP features: map of spruce stands, show my location, tap a stand for details.
- **Skills** every session should consult: `wayfinder`, `grilling`, `domain-modeling`, `research`, `prototype`.
- **Prototype built** (execution carried into this map at the dev's request): a Svelte + Vite + TypeScript PWA in the repo root. Run `npm install && npm run dev`. Basemap is **OpenStreetMap** (Maa-amet's Põhikaart is blank at low zoom). Real spruce-stand **boundaries render at every zoom**: baked static tiles (`npm run data:tiles` → `public/tiles/`, z0–11, geometry+id, ~44 MB) below z12, and **per-viewport WFS queries** at z≥12 (the GWC live tile style proved flaky and went blank at high zoom). The old spruce-**density grid** is an optional "Tihedus" toggle (`npm run data:overview`). Production replaces both with PMTiles on R2 (tickets 01/02/03). Only **government-owned** spruce stands are shown — private ownership (Eraomand) is excluded via `omandivorm_kood IN ('R','T','M','A','KK')` (~158.5k of 344.9k stands). Smoke test: `npm run smoke` (needs the dev server running).

## Decisions so far

- [Spruce-stand extraction & tiling pipeline feasibility](issues/01-extraction-pipeline.md): WFS paging → `ogr2ogr` → FlatGeobuf → `tippecanoe` → PMTiles (~40–90 MB), served from R2 over HTTP range requests.
- [CRS reprojection & basemap rendering](issues/02-crs-and-basemap.md): fetch stands from the WFS as `EPSG:4326`; render the basemap via `wms/alus-geo` (EPSG:3857) as a MapLibre raster source.
- [Client data strategy](issues/03-client-data-strategy.md): mapped set = spruce-dominant stands (`peapuuliik_kood='KU'`, 344,868); MVT carries the needed attributes; monthly refresh; tap reads tile properties.
- [App UX](issues/04-app-ux.md): full-screen map + stand-detail sheet + About; ET/EN; geolocation on demand, no accounts/tracking.
- [Hosting, deployment & PWA](issues/05-hosting-and-pwa.md): Cloudflare Pages + R2; app-shell service worker; offline out of scope.
- [Attribution & license compliance](issues/06-attribution.md): "Metsaregister, Keskkonnaagentuur (CC BY 4.0) · Aluskaart: Maa- ja Ruumiamet", map-corner + About.

## Not yet specified

- Product **name, branding and domain**.
- **Data-freshness UX** ("data as of …") and where it is surfaced.
- Handling **data-quality edge cases** (stands lacking geometry, unknown species codes, sliver polygons).
- **Low-end device performance budget**.
- **Analytics/telemetry and consent** — or deliberately none.
- **Search / geocoding** ("find a place") — likely v2.
- **Other-forest layers**: non-spruce stands (pine, etc.) so pickers can look for *other* mushrooms too. Nice-to-have; same pipeline with a different species filter. Graduates once the spruce layer ships.

## Out of scope

- Mushroom **species guides, season calendars and picking-rule content** (the target species is known, but no such content is shown).
- **Offline mode** / downloadable maps.
- **Saved / favourite** spots.
- In-app **turn-by-turn directions** to a stand.
- **Native iOS/Android** apps.
- **User accounts**.
