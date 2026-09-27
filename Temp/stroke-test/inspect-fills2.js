const fs = require('fs');
const dir = 'public/assets/preloaded-venues';
const files = [
  '5 Palm Imperial.svg',
  'Eko hotel Convention Centre (Individual Halls).svg',
  'Eko hotel Convention Centre (Main Hall).svg',
  'Harbour point.svg',
  'Landmark Centre Halls.svg',
  'Balmoral.svg',
  'Monarch.svg',
  'La Madison Dome.svg'
];
for (const f of files) {
  const s = fs.readFileSync(dir + '/' + f, 'utf8');
  const m = s.match(/fill=[^ >]+|fill\s*:\s*[^;"']+/gi) || [];
  const counts = {};
  m.forEach(x => {
    const k = x.replace(/\s+/g, '').toLowerCase();
    counts[k] = (counts[k] || 0) + 1;
  });
  console.log(f, JSON.stringify(counts));
}
