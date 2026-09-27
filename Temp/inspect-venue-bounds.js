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

function pathBounds(d) {
  const nums = d.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi);
  if (!nums) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  // crude: treat pairs as x,y (good enough for relative/absolute mix estimate)
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const x = parseFloat(nums[i]);
    const y = parseFloat(nums[i + 1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  if (minX === Infinity) return null;
  return { minX, minY, maxX, maxY };
}

function expand(b, o) {
  if (!b) return o;
  return {
    minX: Math.min(b.minX, o.minX),
    minY: Math.min(b.minY, o.minY),
    maxX: Math.max(b.maxX, o.maxX),
    maxY: Math.max(b.maxY, o.maxY),
  };
}

for (const name of ['Balmoral', 'Monarch']) {
  const t = decode(fs.readFileSync('public/assets/preloaded-venues/' + name + '.svg'));
  const svgTag = (t.match(/<svg[^>]*>/i) || [''])[0];
  const w = (svgTag.match(/width=["']([\d.]+)/i) || [])[1];
  const h = (svgTag.match(/height=["']([\d.]+)/i) || [])[1];
  const vb = (svgTag.match(/viewBox=["']([^"']+)/i) || [])[1];
  let bounds = null;
  const paths = t.match(/<path[^>]*\bd="([^"]+)"/gi) || [];
  for (const p of paths) {
    const d = (p.match(/\bd="([^"]+)"/i) || [])[1];
    if (!d) continue;
    bounds = expand(bounds, pathBounds(d));
  }
  console.log('===', name);
  console.log('width', w, 'height', h, 'viewBox', vb || 'MISSING');
  console.log('path bounds', bounds);
  if (bounds) {
    console.log('content size', bounds.maxX - bounds.minX, 'x', bounds.maxY - bounds.minY);
  }
  console.log('transforms', (t.match(/transform="[^"]+"/g) || []).slice(0, 5));
  console.log('');
}
