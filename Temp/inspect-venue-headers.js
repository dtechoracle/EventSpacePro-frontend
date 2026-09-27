const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'public', 'assets', 'preloaded-venues');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.svg'));
for (const f of files) {
  const text = fs.readFileSync(path.join(dir, f), 'utf8');
  const svgMatch = text.match(/<svg[^>]*>/i);
  const head = svgMatch ? svgMatch[0].slice(0, 500) : 'NO SVG TAG';
  const hasViewBox = /viewBox=/i.test(head);
  const hasWidth = /width=/i.test(head);
  const strokeCount = (text.match(/stroke-width/gi) || []).length;
  const nonScale = /non-scaling-stroke/i.test(text);
  const pathCount = (text.match(/<path/gi) || []).length;
  console.log('====', f, 'len=', text.length);
  console.log(head);
  console.log('viewBox=', hasViewBox, 'width=', hasWidth, 'stroke-width attrs=', strokeCount, 'non-scaling=', nonScale, 'paths=', pathCount);
  console.log('');
}
