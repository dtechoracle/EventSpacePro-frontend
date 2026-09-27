const sharp = require('sharp');
const dir = 'public/assets/raster/assets/modal/Furniture/';
const files = [
  '10 seater Crescent Table.webp',
  '20 seater Intertwined Crescent Table.webp',
  '10 seater square table.webp',
  '10 seater round table 01.webp',
  '10 seater serpentine table.webp'
];
async function bbox(f) {
  try {
    const { data, info } = await sharp(dir + f).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let minX = 1e9, minY = 1e9, maxX = -1, maxY = -1;
    const w = info.width, h = info.height;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 10) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
    const cw = maxX - minX + 1, ch = maxY - minY + 1;
    console.log(f.padEnd(45), `${w}x${h}`, 'content:', `${cw}x${ch}`,
      `| pad L${(minX / w * 100).toFixed(1)}% T${(minY / h * 100).toFixed(1)}% R${((w - 1 - maxX) / w * 100).toFixed(1)}% B${((h - 1 - maxY) / h * 100).toFixed(1)}%`,
      `| fill ${(cw * ch / (w * h) * 100).toFixed(1)}%`);
  } catch (e) { console.log(f, 'ERR', e.message); }
}
(async () => { for (const f of files) await bbox(f); })();
