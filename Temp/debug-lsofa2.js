const fs = require('fs');
const sharp = require('sharp');

(async () => {
  const svg = fs.readFileSync('public/assets/modal/Furniture/6 Seater L Shaped Sofa.svg', 'utf8');
  console.log('svg length', svg.length);
  console.log('path count', (svg.match(/<path/g) || []).length);
  console.log('subpath M count', (svg.match(/[Mm]\s/g) || []).length);

  // Direct render of source SVG
  const raw = await sharp(Buffer.from(svg), { density: 96, limitInputPixels: false })
    .resize(480, 360, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .flatten({ background: '#fff' })
    .png().toBuffer();
  fs.writeFileSync('Temp/lsofa-src.png', raw);
  const rs = await sharp(raw).stats();
  console.log('source render mean', rs.channels.map(c => Math.round(c.mean)).join(','));

  // Current webp composited
  const webp = fs.readFileSync('public/assets/raster/assets/modal/Furniture/6 Seater L Shaped Sofa.webp');
  const comp = await sharp(webp)
    .resize(480, 360, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .flatten({ background: '#fff' })
    .png().toBuffer();
  fs.writeFileSync('Temp/lsofa-webp2.png', comp);
  const ws = await sharp(comp).stats();
  console.log('webp composite mean', ws.channels.map(c => Math.round(c.mean)).join(','));

  // Check webp alpha distribution
  const rawWebp = await sharp(webp).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let nonzero = 0;
  const { data, info } = rawWebp;
  for (let i = 3; i < data.length; i += 4) if (data[i] > 10) nonzero++;
  console.log('webp pixels with alpha>10:', nonzero, '/', info.width * info.height, `(${(100*nonzero/(info.width*info.height)).toFixed(2)}%)`);
})().catch(e => { console.error(e); process.exit(1); });
