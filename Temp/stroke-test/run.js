const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = process.cwd();
const PORT = 8931;

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/harness.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(path.join(ROOT, 'Temp/stroke-test/harness.html')));
  } else if (url === '/palm.svg') {
    res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
    res.end(fs.readFileSync(path.join(ROOT, 'public/assets/preloaded-venues/5 Palm Imperial.svg')));
  } else {
    res.writeHead(404); res.end('nf');
  }
});

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1400 } });
  page.on('console', m => console.log('[console]', m.text()));
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  await page.goto(`http://localhost:${PORT}/harness.html`);
  await page.waitForFunction('window.__done === true', { timeout: 30000 });
  const report = await page.textContent('#report');
  console.log(report);
  await page.screenshot({ path: 'Temp/stroke-test/render.png' });
  await browser.close();
  server.close();
})().catch(e => { console.error(e); process.exit(1); });
