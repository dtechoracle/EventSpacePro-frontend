const sharp = require('sharp');
const path = require('path');

const ROOT = path.join(process.cwd());

async function analyze(label, file) {
  const meta = await sharp(file).metadata();
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  let dark = 0, opaque = 0, total = 0;
  for (let i = 0; i < data.length; i += ch) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const a = ch === 4 ? data[i + 3] : 255;
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (a > 10) {
      opaque++;
      if (lum < 128) dark++;
    }
    total++;
  }
  console.log(`${label}: ${meta.width}x${meta.height} ch=${ch} opaquePixels=${((opaque/total)*100).toFixed(2)}% darkOfOpaque=${((dark/Math.max(1,opaque))*100).toFixed(2)}%`);
}

(async () => {
  await analyze('CURRENT(regenerated)', path.join(ROOT, 'public/assets/raster/assets/modal/Furniture/10 seater round table 01.webp'));
})();
