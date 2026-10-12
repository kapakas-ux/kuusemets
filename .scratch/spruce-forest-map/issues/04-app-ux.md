# App UX: screens, stand detail, language, geolocation & privacy

Type: prototype
Status: resolved

## Question

Decide the app's shape, raising fidelity with a cheap concrete artifact:

- Which **screens/states** exist (map, stand-detail sheet, first-run geolocation prompt, attribution, legend).
- Exactly what the **stand-detail sheet** shows.
- The UI **language(s)**: Estonian, English, or both.
- The **location / privacy** posture: no accounts, no tracking, permission handling and what happens on denial.

## Answer

**Screens.** Full-screen map (locate-me button, attribution chip, legend chip); a **stand-detail bottom sheet** on tap; a dismissable first-run location prompt; an About/attribution sheet.

**Stand-detail sheet** shows: area (`pindala`, ha), dominant species, site type, site quality, development class, mean age, mean height, plus a "spruce-dominant" badge. Codes are mapped to Estonian text via the classifiers.

**Language.** Estonian primary with a compact **ET/EN** toggle.

**Privacy.** Geolocation only on the user's tap; no accounts, no analytics, no tracking. On denial the map still works (just no centre-on-me). Position is never sent anywhere beyond the normal map tile requests.

