const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');

const ROOT = process.cwd();
const VENUES_DIR = path.join(ROOT, 'public', 'assets', 'preloaded-venues');
const PNG_DIR = path.join(ROOT, 'public', 'assets', 'thumbnails', 'preloaded-venues');
const NAME = process.argv[2] || 'Balmoral';

function decodeSvg(buf) {
  if (buf[0] === 0xff && buf[1] === 0xfe) return buf.toString('utf16le');
  if (buf[0] === 0xfe && buf[1] === 0xff) {
    const swapped = Buffer.from(buf);
    swapped.swap16();
    return swapped.toString('utf16le');
  }
  if (buf.length > 4 && buf[1] === 0x00 && buf[3] === 0x00 && buf[5] === 0x00) {
    return buf.toString('utf16le');
  }
  return buf.toString('utf8');
}

(async () => {
  const svgPath = path.join(VENUES_DIR, `${NAME}.svg`);
  const pngPath = path.join(PNG_DIR, `${NAME}.png`);
  const raw = await fs.readFile(svgPath);
  let svgText = decodeSvg(raw);
  if (!/<svg[\s>]/i.test(svgText)) throw new Error(`Decoded ${NAME}.svg has no <svg> tag`);

  const viewBoxMatch = svgText.match(/viewBox=["']([\d\s.,-]+)["']/i);
  let vbWidth = 1000, vbHeight = 1000;
  if (viewBoxMatch) {
    const parts = viewBoxMatch[1].trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4) { vbWidth = Math.abs(parts[2]); vbHeight = Math.abs(parts[3]); }
  } else {
    const wMatch = svgText.match(/<svg\b[^>]*\bwidth=["']([\d.]+)["']/i);
    const hMatch = svgText.match(/<svg\b[^>]*\bheight=["']([\d.]+)["']/i);
    if (wMatch) vbWidth = Math.abs(Number(wMatch[1])) || vbWidth;
    if (hMatch) vbHeight = Math.abs(Number(hMatch[1])) || vbHeight;
    // Inject viewBox so sharp/Inkscape-style renderers map content correctly.
    if (!viewBoxMatch && vbWidth && vbHeight) {
      svgText = svgText.replace(/<svg\b/i, `<svg viewBox="0 0 ${vbWidth} ${vbHeight}"`);
    }
  }

  // Strip DOCTYPE (external DTD refs can stall/break strict renderers).
  svgText = svgText.replace(/<!DOCTYPE[\s\S]*?>/i, '');
  svgText = svgText.replace(/<\?xml[\s\S]*?\?>/i, '');
  svgText = svgText.replace(/<style id="preloaded-venue-style">[\s\S]*?<\/style>/gi, '');
  svgText = svgText.replace(/<!--[\s\S]*?-->/g, '');
  svgText = svgText.replace(/<metadata[\s\S]*?<\/metadata>/gi, '');

  // Balmoral/Monarch wrap content in matrix(scale, 0, 0, -scale, tx, ty).
  // stroke-width is in pre-transform units, so a "18" stroke becomes ~0.7
  // user units after scale≈0.038 — invisible. Detect scale and compensate.
  let transformScale = 1;
  const matrixMatch = svgText.match(/transform=["']matrix\(\s*([-\d.eE]+)[\s,]+([-\d.eE]+)[\s,]+([-\d.eE]+)[\s,]+([-\d.eE]+)/i);
  if (matrixMatch) {
    const a = parseFloat(matrixMatch[1]);
    const d = parseFloat(matrixMatch[4]);
    const mag = Math.hypot(a, parseFloat(matrixMatch[2])) || Math.hypot(parseFloat(matrixMatch[3]), d) || 1;
    if (mag > 0 && mag < 1) transformScale = mag;
  }

  const targetStroke = Math.max(4, Math.round(Math.max(vbWidth, vbHeight) * 0.005));
  const sw = Math.max(4, Math.round(targetStroke / transformScale));

  svgText = svgText.replace(/stroke-width="[^"]*"/gi, `stroke-width="${sw}"`);
  svgText = svgText.replace(/stroke="[^"]*"/gi, 'stroke="#1e293b"');
  svgText = svgText.replace(/fill="[^"]*"/gi, 'fill="none"');
  svgText = svgText.replace(/style="[^"]*stroke-width[^"]*"/gi, `style="stroke-width:${sw}"`);
  svgText = svgText.replace(/style="[^"]*stroke:[^"]*"/gi, 'style="stroke:#1e293b"');

  await fs.mkdir(PNG_DIR, { recursive: true });
  // density 144: 24 left hairline strokes nearly invisible after downscale.
  // Flatten onto white so line art is visible on the white assets sidebar
  // (transparent BGs made near-empty PNGs look blank).
  await sharp(Buffer.from(svgText), { density: 144, limitInputPixels: false })
    .resize({ width: 512, height: 512, fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 }, withoutEnlargement: false })
    .flatten({ background: '#ffffff' })
    .png({ compressionLevel: 9 })
    .toFile(pngPath);

  const st = await fs.stat(pngPath);
  console.log(`${NAME}.svg -> PNG: ${(st.size / 1024).toFixed(1)}KB (stroke ${sw}, scale ${transformScale.toFixed(4)}, vb ${vbWidth}x${vbHeight})`);
})().catch((e) => { console.error(e); process.exit(1); });
