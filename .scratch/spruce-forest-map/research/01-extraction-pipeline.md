# Research: Spruce-stand extraction & tiling pipeline (ticket 01)

Verified live 2026-10-11/12 against `https://gsavalik.envir.ee/geoserver/metsaregister/ows`. Sources cited inline.

## 1. Paging the WFS

- WFS 2.0.0 `count` + `startIndex` pages correctly; `resultType=hits` gives `numberMatched=344868` (matches `peapuuliik_kood='KU'`). Same feature at the same `startIndex` across WFS 1.0.0/2.0.0.
- No per-request cap observed (a `count=500000` request returned all 344,868 features), but that payload is multi-hundred-MB — **page at 50,000–100,000** instead.
- Add `sortBy=id` so OFFSET paging is deterministic (PostGIS without ORDER BY can overlap/skip if the source updates mid-download).
- `srsName=EPSG:4326` returns GeoJSON with **lon,lat** axis order. GeoServer already emits CORS headers.
- `outputFormat=application/geopackage+sqlite3` fails (the `+` decodes to a space); use the short token `gpkg`.

Working page request:

```bash
curl -G "https://gsavalik.envir.ee/geoserver/metsaregister/ows" \
  --data-urlencode "service=WFS" --data-urlencode "version=2.0.0" \
  --data-urlencode "request=GetFeature" \
  --data-urlencode "typeNames=metsaregister:eraldis" \
  --data-urlencode "CQL_FILTER=peapuuliik_kood='KU'" \
  --data-urlencode "sortBy=id" --data-urlencode "count=100000" \
  --data-urlencode "startIndex=0" --data-urlencode "srsName=EPSG:4326" \
  --data-urlencode "outputFormat=application/json" -o page_000000.geojson
```

## 2. Feature → tile toolchain

Geometry is `MultiPolygon`, ~17.3 vertices/feature (max 148), mean stand area ~1.16 ha. Attributes are heavy (~35 fields). **Tippecanoe cannot read GeoPackage** — convert to FlatGeobuf or GeoJSON.

```bash
# 1. Merge pages → one reprojected GeoPackage, repairing invalid rings
ogr2ogr -f GPKG eraldis.gpkg page_000000.geojson -nln eraldis -t_srs EPSG:4326
for f in page_*.geojson; do
  ogr2ogr -f GPKG -update -append eraldis.gpkg "$f" -nln eraldis -t_srs EPSG:4326
done
ogr2ogr -f FlatGeobuf eraldis.fgb eraldis.gpkg -makevalid -lco SPATIAL_INDEX=YES -t_srs EPSG:4326

# 2. Tile
tippecanoe -o eraldis.mbtiles -l eraldis -z13 \
  --drop-densest-as-needed --extend-zooms-if-still-dropping \
  --simplification=10 --maximum-tile-bytes=500000 \
  -y peapuuliik_kood -y pindala -y kasvukoht_kood -y boniteedi_kood -y keskm_vanus \
  eraldis.fgb

# 3. PMTiles
pmtiles convert eraldis.mbtiles eraldis.pmtiles
pmtiles verify eraldis.pmtiles
```

`-makevalid` is **not optional** — self-intersecting WFS rings crash MVT encoding. Retain only a few attributes; keeping all 35 adds ~150–250 MB.

## 3. Size (reasoned — GDAL/tippecanoe unavailable here)

Full-attribute GeoJSON ~417 MB; geometry-only ~192 MB. **PMTiles estimate ~40–90 MB at z13** (`-zg` ~30–70 MB, `-z14` ~80–180 MB). Budget ~50 MB; it is a range, not a point.

## 4. Serving from Cloudflare R2 + Pages

Confirmed: R2 returns `206 Partial Content` + `Accept-Ranges: bytes`, and the PMTiles project recommends R2. Needs a bucket **CORS** policy allowing `GET`/`HEAD` with the `Range` header and exposing `ETag`; R2 only emits `Access-Control-*` when a matching `Origin` is sent. Prefer a custom domain over the rate-limited `r2.dev` URL.

## 5. Automation

Scheduled **GitHub Actions** (e.g. monthly): install GDAL/tippecanoe/pmtiles → page WFS → build → verify → `pmtiles upload` to R2 (versioned filename) → deploy Pages. A Cloudflare Workers cron suits incremental updates but heavy batch tiling is easier in Actions.

## Confidence & gaps

- Verified live: paging, `numberMatched`, formats, `gpkg` token, `EPSG:4326` lon/lat, geometry density, R2 range/CORS.
- Reasoned, not measured: all PMTiles sizes (no GDAL/tippecanoe in the research environment).
- Blockers to watch: invalid rings (`-makevalid`), GPKG→FGB conversion step, attribute payload, deterministic paging (`sortBy=id`).
