const fs = require('fs');

function inspect(file) {
  const t = fs.readFileSync(file, 'utf8');
  const root = (t.match(/<svg[^>]*>/i) || [''])[0];
  const paths = t.match(/<path\b[^>]*>/gi) || [];
  const fills = t.match(/\sfill="[^"]*"/gi) || [];
  const strokes = t.match(/\sstroke="[^"]*"/gi) || [];
  const sw = t.match(/stroke-width="[^"]*"/gi) || [];
  console.log('\n===', file);
  console.log('ROOT:', root.slice(0, 350));
  console.log('path count:', paths.length);
  console.log('first path:', (paths[0] || '').slice(0, 400));
  console.log('fill attrs:', fills.length, fills.slice(0, 6));
  console.log('stroke attrs:', strokes.length, strokes.slice(0, 6));
  console.log('stroke-width attrs:', sw.length, sw.slice(0, 6));
  const withFillRule = paths.filter(p => /fill-rule/i.test(p)).length;
  const withFill = paths.filter(p => /\sfill=/i.test(p)).length;
  console.log('paths with fill-rule:', withFillRule, 'with fill attr:', withFill);
}

[
  'Temp/4300mm X 2150mm Crescent Table-current.svg',
  'Temp/L Shaped Sofa 01-current.svg',
  'Temp/L Shaped Sofa 02-current.svg',
  'Temp/3 Seater Sofa 02-current.svg',
].forEach(inspect);
