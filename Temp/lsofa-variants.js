const fs = require('fs');
const sharp = require('sharp');

async function render(svg, out, w = 480) {
  const buf = await sharp(Buffer.from(svg), { density: 96, limitInputPixels: false })
    .resize(w, Math.round(w * 0.75), { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .flatten({ background: '#fff' })
    .png().toBuffer();
  fs.writeFileSync(out, buf);
  const m = await sharp(out).metadata();
  const s = await sharp(out).stats();
  console.log(out, m.width + 'x' + m.height, 'mean=' + s.channels.map(c => Math.round(c.mean)).join(','), buf.length + 'B');
}

(async () => {
  const raw = fs.readFileSync('public/assets/modal/Furniture/6 Seater L Shaped Sofa.svg', 'utf8');

  // A: original style (no evenodd, solid fill, no stroke processing)
  await render(raw, 'Temp/lsofa-A-raw.png');

  // B: with evenodd (current file)
  await render(raw.replace('fill="#000"', 'fill="#000"'), 'Temp/lsofa-B-evenodd.png');

  // C: without evenodd
  await render(raw.replace(' fill-rule="evenodd"', ''), 'Temp/lsofa-C-none.png');

  // D: outline only like generator does (fill none, stroke)
  let d = raw.replace(' fill-rule="evenodd"', '');
  d = d.replace('<path fill="#000"', '<path fill="none" stroke="#000" stroke-width="5.76"');
  d = d.replace('width="640mm"', 'width="640"').replace('height="480mm"', 'height="480"');
  await render(d, 'Temp/lsofa-D-outline.png');

  // E: what generator produces for fill-rule path (fill kept + reduced stroke)
  let e = raw;
  e = e.replace('width="640mm"', 'width="640"').replace('height="480mm"', 'height="480"');
  e = e.replace(/<path fill="#000" fill-rule="evenodd"/, '<path fill="#000" stroke="#000" stroke-width="1.61" fill-rule="evenodd"');
  await render(e, 'Temp/lsofa-E-fr.png');

  // Also render current webp upscaled
  const webp = 'public/assets/raster/assets/modal/Furniture/6 Seater L Shaped Sofa.webp';
  const wb = await sharp(webp).resize(480, 360, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } }).flatten({ background: '#fff' }).png().toBuffer();
  fs.writeFileSync('Temp/lsofa-webp.png', wb);
  const wm = await sharp(wb).metadata();
  const ws = await sharp(wb).stats();
  console.log('Temp/lsofa-webp.png', wm.width + 'x' + wm.height, 'mean=' + ws.channels.map(c => Math.round(c.mean)).join(','));
})().catch(e => { console.error(e); process.exit(1); });
