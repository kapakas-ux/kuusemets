import { existsSync } from 'node:fs'
import puppeteer from 'puppeteer-core'

const CANDIDATES = [
  process.env.CHROME,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean)
const executablePath = CANDIDATES.find((p) => p && existsSync(p))
const URL = process.env.URL ?? 'https://kapakas-ux.github.io/kuusemets/'

const browser = await puppeteer.launch({
  executablePath,
  headless: 'new',
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
})
const page = await browser.newPage()
await page.setViewport({ width: 430, height: 932 })
const errors = []
const failed = []
const tileResponses = []
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('CONSOLE ' + m.text())
})
page.on('requestfailed', (r) => failed.push(`${r.failure()?.errorText} ${r.url().slice(0, 130)}`))
page.on('response', (r) => {
  const u = r.url()
  if (u.includes('/tiles/') || u.includes('tile.openstreetmap')) tileResponses.push(`${r.status()} ${u.slice(0, 130)}`)
})

await page.goto(URL, { waitUntil: 'load', timeout: 60000 })
await new Promise((r) => setTimeout(r, 16000))
await page.screenshot({ path: 'C:\\Users\\kapak\\AppData\\Local\\Temp\\opencode\\live.png' })

console.log('URL:', URL)
console.log('ERRORS:', errors.length ? '\n' + errors.slice(0, 10).join('\n') : 'none')
console.log('FAILED:', failed.length ? '\n' + failed.slice(0, 10).join('\n') : 'none')
console.log('TILE RESPONSES (' + tileResponses.length + '):')
for (const t of tileResponses.slice(0, 8)) console.log('  ' + t)
await browser.close()
