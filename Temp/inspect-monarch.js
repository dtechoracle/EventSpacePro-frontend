const fs = require('fs');
const b = fs.readFileSync('public/assets/preloaded-venues/Monarch.svg');
let t;
if (b[0] === 0xff && b[1] === 0xfe) t = b.toString('utf16le');
else if (b[0] === 0xfe && b[1] === 0xff) {
  const s = Buffer.from(b);
  s.swap16();
  t = s.toString('utf16le');
} else if (b.length > 4 && b[1] === 0 && b[3] === 0 && b[5] === 0) t = b.toString('utf16le');
else t = b.toString('utf8');
console.log('len', t.length);
console.log(t.slice(0, 500));
const m = t.match(/viewBox=["']([^"']+)["']/i);
console.log('viewBox:', m && m[1]);
const w = t.match(/<svg\b[^>]*\bwidth=["']([^"']+)["']/i);
const h = t.match(/<svg\b[^>]*\bheight=["']([^"']+)["']/i);
console.log('width', w && w[1], 'height', h && h[1]);
