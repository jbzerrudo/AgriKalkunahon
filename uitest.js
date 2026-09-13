// Headless UI check: load every card at phone width, fill sample inputs, submit, screenshot, report console errors.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = __dirname;
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(root, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  const type = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' }[path.extname(f)] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type }); fs.createReadStream(f).pipe(res);
});
(async () => {
  await new Promise(r => server.listen(8765, r));
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const shots = path.join(__dirname, 'shots'); fs.mkdirSync(shots, { recursive: true });
  await page.goto('http://localhost:8765/index.html'); await page.waitForTimeout(300);
  await page.screenshot({ path: shots + '/00-home.png', fullPage: true });
  const fill = async (sel, v) => { await page.fill(sel, String(v)); };
  const sel = async (s, v) => { await page.selectOption(s, v); };
  // WATER
  await page.goto('http://localhost:8765/index.html#/water'); await page.waitForTimeout(200);
  await fill('#lat', 15.5); await fill('#lon', 120.9); await fill('#elev', 40); await sel('#site', 'interior');
  await sel('#crop', 'maize'); await sel('#stage', 'mid'); await sel('#soil', 'loam');
  await fill('#tmax', 33); await fill('#tmin', 24); await fill('#days', 8); await fill('#rmm0', 12); await fill('#rago0', 3);
  await sel('#method', 'surface'); await fill('#area', 1.5); await fill('#pump', 15);
  await page.click('button.primary'); await page.waitForTimeout(200);
  await page.screenshot({ path: shots + '/01-water.png', fullPage: true });
  const waterText = await page.textContent('.result .verdict .en');
  // RICE
  await page.goto('http://localhost:8765/index.html#/rice'); await page.waitForTimeout(200);
  await sel('#season', 'dry'); const d = new Date(Date.now() - 40 * 86400000).toISOString().slice(0, 10); await fill('#est', d);
  await fill('#tube', 16); await page.click('button.primary'); await page.waitForTimeout(200);
  await page.screenshot({ path: shots + '/02-rice.png', fullPage: true });
  const riceText = await page.textContent('.result .verdict .en');
  // RAIN
  await page.goto('http://localhost:8765/index.html#/rain'); await page.waitForTimeout(200);
  await fill('#P', 180); await page.click('button.primary'); await page.waitForTimeout(200);
  await page.screenshot({ path: shots + '/03-rain.png', fullPage: true });
  // SPRAY
  await page.goto('http://localhost:8765/index.html#/spray'); await page.waitForTimeout(200);
  await fill('#sT', 31); await fill('#sRH', 65); await sel('#sW', '9'); await fill('#sHour', 9.5);
  await page.click('button.primary'); await page.waitForTimeout(200);
  await page.screenshot({ path: shots + '/04-spray.png', fullPage: true });
  const sprayText = await page.textContent('.result .verdict .en');
  // DRY
  await page.goto('http://localhost:8765/index.html#/dry'); await page.waitForTimeout(200);
  await fill('#dT', 33); await fill('#dRH', 62); await fill('#dCav', 40); await fill('#dMC', 24);
  await page.click('button.primary'); await page.waitForTimeout(200);
  await page.screenshot({ path: shots + '/05-dry.png', fullPage: true });
  const dryText = await page.textContent('.result .verdict .en');
  // STRESS
  await page.goto('http://localhost:8765/index.html#/stress'); await page.waitForTimeout(200);
  await sel('#xCrop', 'rice'); await sel('#xPhase', 'anthesis');
  await fill('#x0x', 36); await fill('#x0n', 25); await page.click('button.primary'); await page.waitForTimeout(200);
  await page.screenshot({ path: shots + '/06-stress.png', fullPage: true });
  const stressText = await page.textContent('.result .verdict .en');
  // FROST
  await page.goto('http://localhost:8765/index.html#/frost'); await page.waitForTimeout(200);
  await fill('#fT', 7); await fill('#fRH', 55); await sel('#fSky', 'clear'); await sel('#fWind', 'calm');
  await page.click('button.primary'); await page.waitForTimeout(200);
  await page.screenshot({ path: shots + '/07-frost.png', fullPage: true });
  const frostText = await page.textContent('.result .verdict .en');
  // DISEASE
  await page.goto('http://localhost:8765/index.html#/disease'); await page.waitForTimeout(200);
  await fill('#zT', 22); await fill('#zRH', 88); await page.check('#zLogger'); await fill('#zA1', 12); await fill('#zA2', 7); await fill('#zB1', 11); await fill('#zB2', 8);
  await page.click('button.primary'); await page.waitForTimeout(200);
  await page.screenshot({ path: shots + '/08-disease.png', fullPage: true });
  // TIMING
  await page.goto('http://localhost:8765/index.html#/timing'); await page.waitForTimeout(200);
  await fill('#tSow', '2026-06-15'); await fill('#tPlant', '2026-08-01'); await fill('#tTx', 32); await fill('#tTn', 24);
  await page.click('button.primary'); await page.waitForTimeout(200);
  await page.screenshot({ path: shots + '/09-timing.png', fullPage: true });
  const timingText = await page.textContent('.result .verdict .en');
  // SOURCES, ABOUT
  await page.goto('http://localhost:8765/index.html#/sources'); await page.waitForTimeout(200); await page.screenshot({ path: shots + '/10-sources.png', fullPage: true });
  await page.goto('http://localhost:8765/index.html#/about'); await page.waitForTimeout(200); await page.screenshot({ path: shots + '/11-about.png', fullPage: true });
  // persistence check
  await page.goto('http://localhost:8765/index.html#/water'); await page.waitForTimeout(200);
  const kept = await page.inputValue('#tmax');
  console.log(JSON.stringify({ waterText, riceText, sprayText, dryText, stressText, frostText, timingText, kept, errors }, null, 1));
  await browser.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
