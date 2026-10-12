# Client data strategy: tile schema, refresh cadence, stand-inspection join

Type: grilling
Status: resolved
Blocked by: 01

## Question

Given the pipeline established in ticket 01, decide:

- **Extraction filter**: the mapped set is *stands containing spruce* — join `eraldis` to `eraldis_element` where `puuliik_kood='KU'` — **not** merely spruce-dominant (`peapuuliik_kood='KU'`). Decide the join and check the resulting feature count is acceptable (ticket 01 measured the pipeline with the dominant filter).
- **Tile schema**: which stand attributes ride in the vector tiles, and at which zoom levels (what to simplify or drop at low zoom).
- **Refresh cadence & ownership**: how often the extract refreshes, and what runs it.
- **Stand inspection**: how tapping a stand retrieves its species composition — baked into the tiles, or a live WFS lookup of `metsaregister:eraldis_element` by stand id.

## Answer

**Mapped set — resolved back to spruce-dominant.** The `eraldis_element` join for "contains spruce" yields **1,155,275** stands (~65% of Estonia's 1,770,205): spruce is a minor component in most mixed stands, so that set is not a spruce-forest map. The mapped set is stands with `peapuuliik_kood='KU'` (**344,868**).

**Tile schema.** Geometry + `id`, `pindala`, `peapuuliik_kood`, `kasvukoht_kood`, `boniteedi_kood`, `arengukl_kood`, `keskm_vanus`, `korgus`; max zoom z13–14.

**Refresh cadence.** Monthly, rebuilt by the scheduled GitHub Actions job from ticket 01.

**Stand inspection.** Read attributes straight from the MVT feature properties on tap (no second request); fall back to a WFS `id=` lookup only if an attribute is missing.

**Prototype divergence (throwaway).** The prototype renders z≥12 from the live GWC WMTS MVT endpoint (`metsaregister:KKP.eraldis.puistuplaan` style) filtered client-side on `peapuuliik_kood=='KU'`, and z<12 from a static spruce-density grid (`npm run data:overview`), because baking PMTiles needs GDAL/tippecanoe. Production uses the baked PMTiles from tickets 01/02.

