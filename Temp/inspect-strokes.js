const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

function parseViewBox(svgText) {
  const m = svgText.match(/viewBox=["']([^"']+)["']/i);
  if (!m) return null;
  const parts = m[1].trim().split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || !parts.every(Number.isFinite)) return null;
  return { x: parts[0], y: parts[1], w: Math.abs(parts[2]), h: Math.abs(parts[3]) };
}

(async () => {
  const files = [
    'public/assets/modal/Furniture/6 Seater L Shaped Sofa.svg',
    'public/assets/modal/Furniture/L Shaped Sofa 01.svg',
    'public/assets/modal/Furniture/L Shaped Sofa 02.svg',
    'public/assets/modal/Sitting_Styles/Boardroom.svg',
  ];
  for (const f of files) {
    const svg = fs.readFileSync(f, 'utf8');
    const vb = parseViewBox(svg);
    const hasFR = /fill-rule/.test(svg);
    const pathCount = (svg.match(/<path/g) || []).length;
    const strokes = [...svg.matchAll(/stroke-width=["']([^"']+)["']/g)].map(m => m[1]).slice(0, 5);
    const styles = [...svg.matchAll(/stroke-width\s*:\s*([^;"]+)/g)].map(m => m[1]).slice(0, 5);
    console.log(path.basename(f));
    console.log('  vb', vb, 'paths', pathCount, 'fill-rule', hasFR);
    console.log('  attr sw', strokes, 'style sw', styles);
    console.log('  ratio for 0.009:', vb ? (Math.max(vb.w, vb.h) * 0.009).toFixed(2) : 'n/a');
    console.log('  ratio for 0.0015:', vb ? (Math.max(vb.w, vb.h) * 0.0015).toFixed(2) : 'n/a');
  }

  // previews
  const pairs = [
    ['public/assets/raster/assets/modal/Furniture/6 Seater L Shaped Sofa.webp', 'Temp/lsofa-preview.png'],
    ['public/assets/raster/assets/modal/Sitting_Styles/Boardroom.webp', 'Temp/boardroom-preview.png'],
    ['public/assets/raster/assets/modal/Sitting_Styles/Theatre or Auditorium.webp', 'Temp/theatre-preview.png'],
  ];
  for (const [src, dst] of pairs) {
    const buf = await sharp(src)
      .resize(400, 400, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .flatten({ background: '#fff' })
      .png().toBuffer();
    fs.writeFileSync(dst, buf);
    const m = await sharp(dst).metadata();
    console.log('preview', dst, m.width + 'x' + m.height, buf.length + 'B');
  }
})().catch(e => { console.error(e); process.exit(1); });
