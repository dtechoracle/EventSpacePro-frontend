const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const FILES = [
  'assets/modal/Furniture/10 seater Crescent Table.svg',
  'assets/modal/Furniture/20 seater Intertwined Crescent Table.svg',
];
const PUBLIC_DIR = path.join(process.cwd(), 'public');
const OUT_ROOT = path.join(PUBLIC_DIR, 'assets', 'raster');
const STROKE_RATIO = 0.014;
const PAD_RATIO = 0.04;
const MAX_SIZE = 2048;

function svgTagInfo(svgText) {
  const tag = svgText.match(/<svg\b[^>]*>/i)?.[0] || '';
  const width = Number(tag.match(/\bwidth=["']([\d.]+)/i)?.[1]);
  const height = Number(tag.match(/\bheight=["']([\d.]+)/i)?.[1]);
  const vb = tag.match(/\bviewBox=["']([^"']+)["']/i)?.[1];
  const parts = vb ? vb.trim().split(/[\s,]+/).map(Number) : null;
  const viewBox = parts && parts.length === 4 && parts.every(Number.isFinite) ? parts : [0, 0, width, height];
  return { width, height, viewBox };
}

async function contentBBox(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;
  let minX = 1e9, minY = 1e9, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (data[(y * w + x) * 4 + 3] > 10) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, imgW: w, imgH: h };
}

(async () => {
  for (const rel of FILES) {
    const svgPath = path.join(PUBLIC_DIR, rel);
    const outPath = path.join(OUT_ROOT, rel.replace(/\.svg$/i, '.webp'));
    let svg = fs.readFileSync(svgPath, 'utf8');
    const { viewBox } = svgTagInfo(svg);

    // 1. Probe render (original artboard) to locate the drawing content
    const probe = await sharp(Buffer.from(svg), { density: 144, limitInputPixels: false }).png().toBuffer();
    const bb = await contentBBox(probe);
    if (!bb) { console.log(rel, 'EMPTY CONTENT — skipped'); continue; }

    // 2. Convert content bbox (probe px) to viewBox units
    const sx = viewBox[2] / bb.imgW;
    const sy = viewBox[3] / bb.imgH;
    const uX = viewBox[0] + bb.x * sx;
    const uY = viewBox[1] + bb.y * sy;
    const uW = bb.w * sx;
    const uH = bb.h * sy;
    const uMax = Math.max(uW, uH);
    const pad = uMax * PAD_RATIO;
    const strokeUnits = uMax * STROKE_RATIO;

    // 3. Tight viewBox + uniform bold stroke (strip per-element stroke-width)
    svg = svg
      .replace(/<svg\b([^>]*?)>/i, (_m, attrs) => {
        let a = attrs
          .replace(/\s+viewBox=["'][^"']*["']/i, '')
          .replace(/\s+stroke-width=["'][^"']*["']/gi, '')
          .replace(/\s+stroke=["'][^"']*["']/gi, '')
          .replace(/\s+fill=["'][^"']*["']/gi, '');
        return `<svg${a} viewBox="${uX - pad} ${uY - pad} ${uW + pad * 2} ${uH + pad * 2}" fill="none" stroke="#000000" stroke-width="${strokeUnits}">`;
      })
      .replace(/stroke-width\s*:\s*[^;"']+/gi, '')
      .replace(/\sstroke-width=["'][^"']*["']/gi, '');

    // 4. Render tight at high density, fit within MAX_SIZE
    const aspect = (uW + pad * 2) / (uH + pad * 2);
    const tw = aspect >= 1 ? MAX_SIZE : Math.round(MAX_SIZE * aspect);
    const th = aspect >= 1 ? Math.round(MAX_SIZE / aspect) : MAX_SIZE;
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    await sharp(Buffer.from(svg), { density: 288, limitInputPixels: false })
      .resize(tw, th)
      .webp({ lossless: true, effort: 4 })
      .toFile(outPath);

    const verifyBuf = fs.readFileSync(outPath);
    const verify = await sharp(verifyBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const vb2 = await contentBBox(verifyBuf);
    const fill = vb2 ? ((vb2.w * vb2.h) / (verify.info.width * verify.info.height) * 100).toFixed(1) : 0;
    console.log(`${rel}\n  content units ${uW.toFixed(1)}x${uH.toFixed(1)}, stroke ${strokeUnits.toFixed(2)} -> ${tw}x${th}, fill ${fill}%`);
  }
})().catch(e => { console.error(e); process.exit(1); });
