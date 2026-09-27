const fs = require('fs');

function summarize(file) {
  const t = fs.readFileSync(file, 'utf8');
  const paths = t.match(/<path\b/gi) || [];
  const fills = [...t.matchAll(/\sfill="([^"]+)"/gi)].map(m => m[1]);
  const strokes = [...t.matchAll(/\sstroke="([^"]+)"/gi)].map(m => m[1]);
  const sw = [...t.matchAll(/stroke-width="([^"]+)"/gi)].map(m => m[1]);
  const fillRules = (t.match(/fill-rule/gi) || []).length;
  console.log('\n===', file);
  console.log('bytes', t.length, 'path tags', paths.length, 'fill-rule mentions', fillRules);
  console.log('unique fill:', [...new Set(fills)]);
  console.log('unique stroke:', [...new Set(strokes)]);
  console.log('unique stroke-width:', [...new Set(sw)]);
}

[
  'public/assets/modal/Furniture/L Shaped Sofa 01.svg',
  'public/assets/modal/Furniture/L Shaped Sofa 02.svg',
  'public/assets/modal/Furniture/4300mm X 2150mm Crescent Table.svg',
  'public/assets/modal/Furniture/1200mm X 600mm Coffee Table.svg',
].forEach(summarize);
