const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../public/assets/preloaded-venues');
const files = [
  'Eko hotel Convention Centre (Main Hall).svg',
  'Eko hotel Convention Centre (Individual Halls).svg'
];

files.forEach(name => {
  const p = path.join(dir, name);
  console.log('Cleaning: ', p);
  let s = fs.readFileSync(p, 'utf8');

  // Strip exact matplotlib figure bounding box fills (patch_1 and patch_2)
  s = s.replace(/<g id="patch_1">\s*<path d="[^"]*" style="fill: #ffffff"\/>/g, '<g id="patch_1"><path d="" style="fill: none"/></g>');
  s = s.replace(/<g id="patch_2">\s*<path d="[^"]*" style="fill: #212830"\/>/g, '<g id="patch_2"><path d="" style="fill: none"/></g>');

  fs.writeFileSync(p, s, 'utf8');
});

console.log('Eko SVGs cleaned successfully!');
