# Hosting, deployment & PWA packaging

Type: grilling
Status: resolved
Blocked by: 01

## Question

Decide the deployment topology:

- **Cloudflare Pages** for the app and **R2** for the PMTiles (confirm against ticket 01's size/range-request findings).
- The **build/deploy trigger**, and how the scheduled data refresh hooks into deployment.
- The **custom-domain** plan.
- **PWA packaging** details: manifest, install prompt, service-worker scope — noting offline is out of scope.

## Answer

- **Hosting**: Cloudflare Pages for the static PWA; Cloudflare **R2** for the baked PMTiles (served with range requests and the CORS policy from tickets 01/02).
- **Deploy**: push-to-deploy on Pages; the monthly data job uploads a versioned `.pmtiles` and updates a small manifest.
- **Custom domain**: TBD (fog).
- **PWA**: web manifest + app-shell service worker (icons, offline app shell only — map data stays online, since offline is out of scope).

