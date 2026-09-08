const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');

const ROOT = process.cwd();
const VENUES_DIR = path.join(ROOT, 'public', 'assets', 'preloaded-venues');
const PNG_DIR = path.join(ROOT, 'public', 'assets', 'thumbnails', 'preloaded-venues');

async function processOne(file) {
  const svgPath = path.join(VENUES_DIR, file);
  const pngPath = path.join(PNG_DIR, file.replace(/\.svg$/i, '.png'));

  let svgText = await fs.readFile(svgPath, 'utf8');

  const viewBoxMatch = svgText.match(/viewBox=["']([\d\s.-]+)["']/i);
  let vbWidth = 1000, vbHeight = 1000;
  if (viewBoxMatch) {
    const parts = viewBoxMatch[1].trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4) { vbWidth = Math.abs(parts[2]); vbHeight = Math.abs(parts[3]); }
  }

  const sw = Math.max(3, Math.round(Math.max(vbWidth, vbHeight) * 0.004));

  // Strip problematic elements
  svgText = svgText.replace(/<style id="preloaded-venue-style">[\s\S]*?<\/style>/gi, '');
  svgText = svgText.replace(/<!--[\s\S]*?-->/g, '');
  svgText = svgText.replace(/<metadata[\s\S]*?<\/metadata>/gi, '');

  // Per-element stroke override via attribute manipulation (avoids !important issues with sharp)
  svgText = svgText.replace(/stroke-width="[^"]*"/gi, `stroke-width="${sw}"`);
  svgText = svgText.replace(/stroke="[^"]*"/gi, 'stroke="#272235"');
  svgText = svgText.replace(/fill="[^"]*"/gi, 'fill="none"');

  // Also strip inline style stroke overrides
  svgText = svgText.replace(/style="[^"]*stroke-width[^"]*"/gi, `style="stroke-width:${sw}"`);
  svgText = svgText.replace(/style="[^"]*stroke:[^"]*"/gi, 'style="stroke:#272235"');

  const buf = Buffer.from(svgText);

  await sharp(buf, { density: 24, limitInputPixels: false })
    .resize({ width: 512, height: 512, fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 }, withoutEnlargement: true })
    .png()
    .toFile(pngPath);

  const pngStat = await fs.stat(pngPath);
  console.log(`${file} -> PNG: ${(pngStat.size/1024).toFixed(1)}KB (stroke: ${sw})`);
}

(async () => {
  await fs.mkdir(PNG_DIR, { recursive: true });
  const files = (await fs.readdir(VENUES_DIR)).filter(f => f.toLowerCase().endsWith('.svg'));
  for (const f of files) {
    console.log(`Processing: ${f}...`);
    await processOne(f);
  }
  console.log('Done!');
})().catch(e => { console.error(e); process.exit(1); });
