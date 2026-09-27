const fs = require('fs');

function decode(buf) {
  if (buf[0] === 0xff && buf[1] === 0xfe) return buf.toString('utf16le');
  if (buf[0] === 0xfe && buf[1] === 0xff) {
    const s = Buffer.from(buf);
    s.swap16();
    return s.toString('utf16le');
  }
  if (buf.length > 4 && buf[1] === 0 && buf[3] === 0 && buf[5] === 0) return buf.toString('utf16le');
  return buf.toString('utf8');
}

for (const name of ['Balmoral', 'Monarch', 'Harbour point']) {
  const t = decode(fs.readFileSync('public/assets/preloaded-venues/' + name + '.svg'));
  console.log('===', name, 'len', t.length);
  console.log('svg tag', (t.match(/<svg[^>]*>/i) || [''])[0].slice(0, 400));
  const fills = Array.from(new Set((t.match(/fill="([^"]+)"/g) || []).map(s => s.slice(6, -1))));
  const strokes = Array.from(new Set((t.match(/stroke="([^"]+)"/g) || []).map(s => s.slice(8, -1))));
  const sw = Array.from(new Set((t.match(/stroke-width="([^"]+)"/g) || []).map(s => s.slice(14, -1))));
  console.log('fills', fills.slice(0, 25));
  console.log('strokes', strokes.slice(0, 25));
  console.log('stroke-widths', sw.slice(0, 25));
  console.log('path', (t.match(/<path/gi) || []).length, 'rect', (t.match(/<rect/gi) || []).length, 'line', (t.match(/<line/gi) || []).length, 'polyline', (t.match(/<polyline/gi) || []).length);
  const style = (t.match(/<style[^>]*>[\s\S]*?<\/style>/i) || [''])[0];
  console.log('style', style.slice(0, 500).replace(/\n/g, ' '));
  // sample first path tag
  const p = t.match(/<path[^>]{0,300}/i);
  console.log('first path', p ? p[0] : 'none');
  console.log('');
}
