const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const urls = [];
  p.on('response', r => { if (r.url().endsWith('.js')) urls.push(r.url()); });
  p.on('console', m => { if (m.type() === 'error') console.log('[console.error]', m.text().slice(0, 300)); });
  try {
    await p.goto('http://localhost:3000/dashboard/editor', { waitUntil: 'networkidle', timeout: 45000 });
  } catch (e) { console.log('goto:', e.message); }
  await p.waitForTimeout(4000);
  console.log('final url:', p.url());
  const seen = new Set();
  for (const u of [...new Set(urls)]) {
    try {
      const txt = await p.evaluate(async (url) => (await fetch(url)).text(), u);
      if (txt.includes('stroke-top-layer') && !seen.has(u)) {
        seen.add(u);
        console.log('CHUNK', u.split('/').pop().slice(0, 80),
          '| FIX(new):', txt.includes('never qualifies'),
          '| OLD:', txt.includes('area > canvasArea * 0.75'));
      }
    } catch (e) {}
  }
  await b.close();
})();
