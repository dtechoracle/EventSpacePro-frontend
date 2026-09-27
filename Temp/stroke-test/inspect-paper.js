const fs = require('fs');
const dir = 'public/assets/preloaded-venues';
for (const f of ['Balmoral.svg', 'Monarch.svg', 'La Madison Dome.svg']) {
  const svg = fs.readFileSync(dir + '/' + f, 'utf8');
  const els = svg.match(/<(path|rect|circle|ellipse|line|polyline)[^>]*>?/g) || [];
  console.log('==', f, 'elements:', els.length);
  els.slice(0, 8).forEach(e => console.log('  ', e.slice(0, 220)));
}
