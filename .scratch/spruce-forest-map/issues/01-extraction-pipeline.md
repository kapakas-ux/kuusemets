# Spruce-stand extraction & tiling pipeline feasibility

Type: research
Status: resolved

## Question

What is the concrete, working path from the Forest Register WFS to static vector tiles the app can serve? Specifically: how to page through `metsaregister:eraldis` filtered to `peapuuliik_kood='KU'` (~344,868 polygons) without truncation; which toolchain converts the result to **PMTiles** (e.g. `ogr2ogr` + `tippecanoe`, or the `pmtiles` CLI); the resulting file size at a sensible max zoom; and whether **Cloudflare R2 + Pages** can serve that file with HTTP range requests. Capture the exact commands.

## Answer

Full findings: [research/01-extraction-pipeline.md](../research/01-extraction-pipeline.md). Working path confirmed:

- WFS 2.0.0 paging (`count` + `startIndex`, `sortBy=id`) retrieves all **344,868** features; no per-request cap observed, but page at 50k–100k.
- Pipeline: WFS GeoJSON (`srsName=EPSG:4326`) → `ogr2ogr` merge to GeoPackage (`-makevalid`, required) → FlatGeobuf → `tippecanoe -z13` → `.mbtiles` → `pmtiles convert`.
- Estimated PMTiles size **~40–90 MB at z13** (reasoned, not measured). Keep only a handful of attributes.
- Cloudflare R2 serves PMTiles over HTTP range (`206 Partial Content`) with a CORS policy; works with the `pmtiles` JS client.
- Refresh: scheduled **GitHub Actions** that rebuilds and re-uploads (versioned filename).
