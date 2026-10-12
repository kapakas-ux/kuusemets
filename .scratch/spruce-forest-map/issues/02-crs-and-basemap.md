# CRS reprojection & basemap rendering

Type: research
Status: resolved

## Question

The register stand data is `EPSG:3301` (L-EST97) and MapLibre GL JS works in Web Mercator (`EPSG:3857`). Verify how to reproject the stand data into tiles without visible offset, and how to render the **Maa-amet WMS** basemap (`kaart.maaamet.ee/wms/alus`, served in `EPSG:3301`) as a raster source in MapLibre correctly. Capture the exact MapLibre source/layer configuration (tile URL template, WMS params, CRS) and the required attribution strings.

## Answer

Full findings: [research/02-crs-and-basemap.md](../research/02-crs-and-basemap.md).

- Fetch stands from the WFS in **`SRSNAME=EPSG:4326`** (returns lon,lat GeoJSON); feed WGS84 to the tiler.
- Use the **WGS84 basemap `https://kaart.maaamet.ee/wms/alus-geo?`** (supports EPSG:3857). **Not** `wms/alus`, which is EPSG:3301-only and returns `InvalidSRS` for 3857/4326.
- MapLibre: plain raster source with a `{bbox-epsg-3857}` WMS GetMap template, `layers=pohi_vr2`.
- Attribution: `Eesti põhikaart 2026, Maa- ja Ruumiamet | Metsaregister, Keskkonnaagentuur (CC BY 4.0)`.
- Caveat: Maa-amet terms discourage mass WMS caching; front with a cache/TMS for production traffic.
