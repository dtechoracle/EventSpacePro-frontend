const sharp = require('sharp');
const fs = require('fs'), path = require('path');
const root = 'public/assets/raster';
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.webp')) files.push(p);
  }
})(root);
(async () => {
  const bad = [];
  for (const f of files) {
    try {
      const { data, info } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const w = info.width, h = info.height;
      let minX = 1e9, minY = 1e9, maxX = -1, maxY = -1;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] > 10) {
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
      }
      if (maxX < 0) { bad.push([f, 0, w + 'x' + h, 'EMPTY']); continue; }
      const fill = (maxX - minX + 1) * (maxY - minY + 1) / (w * h) * 100;
      if (fill < 45) bad.push([f, fill.toFixed(1), w + 'x' + h, `content ${maxX - minX + 1}x${maxY - minY + 1}`]);
    } catch (e) { bad.push([f, 'ERR', e.message, '']); }
  }
  bad.sort((a, b) => parseFloat(a[1] || 0) - parseFloat(b[1] || 0));
  console.log('total webps:', files.length, '| fill<45%:', bad.length);
  bad.forEach(b => console.log(b[1].toString().padStart(6) + '%', b[2].padEnd(12), b[3].padEnd(22), b[0]));
})();
