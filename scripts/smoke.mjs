// Headless smoke test: loads the dev server, checks for errors, and reports
// what the map renders at low and high zoom. Run: npm run smoke (dev server must be running).
import { existsSync } from 'node:fs'
import puppeteer from 'puppeteer-core'

const CANDIDATES = [
  process.env.CHROME,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean)
const executablePath = CANDIDATES.find((p) => p && existsSync(p))
if (!executablePath) {
  console.error('No Chrome/Edge found. Set CHROME env var to the browser executable.')
  process.exit(1)
}
const URL = process.env.URL ?? 'http://localhost:5173/'

const browser = await puppeteer.launch({
  executablePath,
  headless: 'new',
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
})
const page = await browser.newPage()
await page.setViewport({ width: 430, height: 932 })
const errors = []
page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`CONSOLE: ${m.text()}`)
})
page.on('requestfailed', (r) => errors.push(`REQFAIL ${r.failure()?.errorText}: ${r.url().slice(0, 150)}`))
page.on('response', (r) => {
  if (r.status() >= 400) errors.push(`HTTP ${r.status()}: ${r.url().slice(0, 150)}`)
})

await page.goto(URL, { waitUntil: 'load', timeout: 60000 })
await new Promise((r) => setTimeout(r, 12000))

async function report(label) {
  const info = await page.evaluate(() => {
    const m = window.__map
    if (!m) return { noMap: true }
    const count = (l) => m.queryRenderedFeatures({ layers: [l] }).length
    return {
      zoom: Number(m.getZoom().toFixed(2)),
      basemapLoaded: m.isSourceLoaded('basemap'),
      bakedSpruce: count('spruce-baked-fill'),
      viewSpruce: count('spruce-view-fill'),
    }
  })
  console.log(`${label}: ${JSON.stringify(info)}`)
  return info
}
await report('low-zoom')

await page.evaluate(() => window.__map?.jumpTo({ center: [26.6032, 58.4286], zoom: 14 }))
await new Promise((r) => setTimeout(r, 9000))
await report('high-zoom')

await page.evaluate(() => window.__map?.jumpTo({ center: [26.6032, 58.4286], zoom: 17 }))
await new Promise((r) => setTimeout(r, 9000))
await report('max-zoom')

// Tap a rendered spruce stand and read the "Take me there" link.
const target = await page.evaluate(() => {
  const m = window.__map
  const f = m.queryRenderedFeatures({ layers: ['spruce-view-fill'] })[0]
  if (!f) return null
  const g = f.geometry
  const rings = g.type === 'Polygon' ? g.coordinates : g.coordinates.flat()
  let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9
  for (const ring of rings)
    for (const [x, y] of ring) {
      minx = Math.min(minx, x); maxx = Math.max(maxx, x)
      miny = Math.min(miny, y); maxy = Math.max(maxy, y)
    }
  const c = m.project([(minx + maxx) / 2, (miny + maxy) / 2])
  return { x: Math.round(c.x), y: Math.round(c.y), id: f.properties.id }
})
if (target) {
  await page.mouse.click(target.x, target.y)
  await new Promise((r) => setTimeout(r, 2500))
}
const cta = await page.evaluate(() => {
  const a = document.querySelector('a.cta')
  return a ? { href: a.getAttribute('href'), text: a.textContent?.trim() } : null
})
console.log(`take-me-there (target ${target ? target.id : 'none'}):`, JSON.stringify(cta))

await browser.close()
if (errors.length) {
  console.error('ERRORS:\n' + errors.join('\n'))
  process.exit(1)
}
console.log('OK — no page errors')
