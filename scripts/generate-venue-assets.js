const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');

const ROOT = process.cwd();
const VENUES_DIR = path.join(ROOT, 'public', 'assets', 'preloaded-venues');
const WEBP_DIR = path.join(ROOT, 'public', 'assets', 'raster', 'assets', 'preloaded-venues');
const PNG_DIR = path.join(ROOT, 'public', 'assets', 'thumbnails', 'preloaded-venues');

async function processOne(file) {
  const svgPath = path.join(VENUES_DIR, file);
  const webpPath = path.join(WEBP_DIR, file.replace(/\.svg$/i, '.webp'));
  const pngPath = path.join(PNG_DIR, file.replace(/\.svg$/i, '.png'));

  const svgText = await fs.readFile(svgPath, 'utf8');

  const viewBoxMatch = svgText.match(/viewBox=["']([\d\s.-]+)["']/i);
  let vbWidth = 2048, vbHeight = 2048;
  if (viewBoxMatch) {
    const parts = viewBoxMatch[1].trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4) { vbWidth = Math.abs(parts[2]); vbHeight = Math.abs(parts[3]); }
  }

  const strokeWidth = Math.max(2, Math.round(Math.max(vbWidth, vbHeight) * 0.005));
  const style = `<style>* { stroke: #000000 !important; stroke-width: ${strokeWidth} !important; } path, line, polyline, polygon, circle, ellipse, rect { fill: none !important; }</style>`;
  let rasterSvgText = svgText.replace(/<svg\b([^>]*)>/i, (m) => `${m}${style}`);
  rasterSvgText = rasterSvgText.replace(/<style id="preloaded-venue-style">[\s\S]*?<\/style>/gi, '');

  const buf = Buffer.from(rasterSvgText);

  await sharp(buf, { density: 72, limitInputPixels: false })
    .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 90 })
    .toFile(webpPath);

  await sharp(buf, { density: 72, limitInputPixels: false })
    .resize({ width: 512, height: 512, fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 }, withoutEnlargement: true })
    .png()
    .toFile(pngPath);

  const webpStat = await fs.stat(webpPath);
  const pngStat = await fs.stat(pngPath);
  console.log(`${file} -> WebP: ${(webpStat.size/1024).toFixed(1)}KB, PNG: ${(pngStat.size/1024).toFixed(1)}KB`);
}

const fileArg = process.argv[2];
if (fileArg) {
  processOne(fileArg).catch(e => { console.error(e); process.exit(1); });
} else {
  (async () => {
    await fs.mkdir(WEBP_DIR, { recursive: true });
    await fs.mkdir(PNG_DIR, { recursive: true });
    const files = (await fs.readdir(VENUES_DIR)).filter(f => f.toLowerCase().endsWith('.svg'));
    for (const f of files) {
      console.log(`Processing: ${f}...`);
      await processOne(f);
    }
    console.log('Done!');
  })().catch(e => { console.error(e); process.exit(1); });
}
