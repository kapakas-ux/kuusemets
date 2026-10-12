# Research: CRS reprojection & basemap rendering (ticket 02)

Verified live 2026-10-12 against the WFS and Maa-amet WMS GetCapabilities.

## 1. Reprojecting the stand data

- `metsaregister:eraldis` WFS default CRS is `EPSG:3301`; `OtherCRS` includes `EPSG:4326`. A live `GetFeature` with `srsName=urn:ogc:def:crs:EPSG::4326` returns GeoJSON with **lon,lat** coords.
- **Recommended:** request WGS84 from the WFS (or `ogr2ogr -t_srs EPSG:4326` on a 3301 export) and feed WGS84 GeoJSON to the tiler. Don't hand-project to 3857 (GeoJSON is defined in WGS84).
- L-EST97 → WGS84 residual is only the ETRS89↔WGS84 drift (~0.6–0.8 m in Europe today) — invisible on a display map. Pitfall: always set `SRSNAME` (else default 3301); GeoJSON output is lon,lat despite GML 2.0 lat,lon.

## 2. Maa-amet WMS basemaps

- `https://kaart.maaamet.ee/wms/alus?` → **EPSG:3301 only**. A 3857/4326 `GetMap` returns `ServiceException code="InvalidSRS"`.
- `https://kaart.maaamet.ee/wms/alus-geo?` → **EPSG:4326 and EPSG:3857**. A live 3857 `GetMap` returned a valid PNG. Layers include `pohi_vr2` (Põhikaart), `of10000` (orthophoto), `cir_ngr` (forestry CIR), etc.

## 3. MapLibre source (recommended)

Because `alus-geo` supports EPSG:3857, use a plain raster source with a `{bbox-epsg-3857}` WMS GetMap template — no proxy, no reprojection:

```js
map.addSource('maaamet-basemap', {
  type: 'raster',
  tiles: [
    'https://kaart.maaamet.ee/wms/alus-geo?' +
    'service=WMS&version=1.3.0&request=GetMap' +
    '&layers=pohi_vr2&styles=' +
    '&crs=EPSG:3857&bbox={bbox-epsg-3857}' +
    '&width=256&height=256&format=image/png&transparent=false'
  ],
  tileSize: 256,
  attribution: 'Eesti põhikaart 2026, Maa- ja Ruumiamet | Metsaregister, Keskkonnaagentuur (CC BY 4.0)'
});
map.addLayer({ id: 'maaamet-basemap', type: 'raster', source: 'maaamet-basemap' });
```

Stand polygons: fetch `metsaregister:eraldis` with `SRSNAME=EPSG:4326` and feed WGS84 to the tiler / `geojson` source.

## 4. Attribution

- Maa- ja Ruumiamet terms clause 6: name the data, the age/date, and "Maa- ja Ruumiamet" — e.g. `Eesti põhikaart 2026, Maa- ja Ruumiamet`. (The agency rebranded from "Maa-amet" to **"Maa- ja Ruumiamet"**.)
- Forest Register: author/publisher **Keskkonnaagentuur**, licence **CC BY 4.0** → `Metsaregister, Keskkonnaagentuur (CC BY 4.0)`.

## Confidence & gaps

- Verified live: `alus` = 3301 only; `alus-geo` = 4326+3857 and returns a valid 3857 PNG; WFS default 3301 + `OtherCRS` 4326; attribution wording.
- Caveat: Maa-amet terms clause 12 discourage mass WMS caching — for a high-traffic public app, front `alus-geo` with a cache or the MaRu TMS/WMTS service.
