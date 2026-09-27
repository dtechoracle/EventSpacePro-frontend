const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

(async () => {
  const webp = 'public/assets/raster/assets/modal/Furniture/6 Seater L Shaped Sofa.webp';
  const m = await sharp(webp).metadata();
  const s = await sharp(webp).stats();
  console.log('webp', m.width + 'x' + m.height, 'alphaMean', Math.round(s.channels[3]?.mean ?? -1), 'rgb', s.channels.slice(0,3).map(c=>Math.round(c.mean)).join(','));

  // raw render of current SVG
  const svg = fs.readFileSync('public/assets/modal/Furniture/6 Seater L Shaped Sofa.svg', 'utf8');
  console.log('svg head', svg.slice(0, 200));
  console.log('has evenodd', /evenodd/.test(svg));

  const buf = await sharp(Buffer.from(svg), { density: 150, limitInputPixels: false }).png().toBuffer();
  const bm = await sharp(buf).metadata();
  console.log('direct svg render', bm.width + 'x' + bm.height);
  const preview = await sharp(buf).resize(400, 400, { fit: 'contain', background: { r:255,g:255,b:255,alpha:1 } }).flatten({background:'#fff'}).png().toBuffer();
  fs.writeFileSync('Temp/lsofa-direct.png', preview);

  // also check if webp content bbox is roughly centered sofa
  const wb = await sharp(webp).resize(200, 200, { fit:'contain', background:{r:255,g:255,b:255,alpha:1}}).flatten({background:'#fff'}).raw().toBuffer();
  let dark = 0;
  for (let i = 0; i < wb.length; i += 3) if (wb[i] < 128) dark++;
  console.log('dark pixels in 200x200', dark, '/', 200*200);
})().catch(e => { console.error(e); process.exit(1); });
