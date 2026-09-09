const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');

const ROOT = process.cwd();
const VENUES_DIR = path.join(ROOT, 'public', 'assets', 'preloaded-venues');
const OUTPUT_DIR = path.join(ROOT, 'public', 'assets', 'raster', 'assets', 'preloaded-venues');

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const files = await fs.readdir(VENUES_DIR);
  let count = 0;

  for (const file of files) {
    if (!file.toLowerCase().endsWith('.svg')) continue;
    const svgPath = path.join(VENUES_DIR, file);
    const outputPath = path.join(OUTPUT_DIR, file.replace(/\.svg$/i, '.webp'));

    const svgText = await fs.readFile(svgPath, 'utf8');

    const viewBoxMatch = svgText.match(/viewBox=["']([\d\s.-]+)["']/i);
    let vbWidth = 2048;
    let vbHeight = 2048;
    if (viewBoxMatch) {
      const parts = viewBoxMatch[1].trim().split(/[\s,]+/).map(Number);
      if (parts.length === 4) {
        vbWidth = Math.abs(parts[2]);
        vbHeight = Math.abs(parts[3]);
      }
    }

    const strokeWidth = Math.max(2, Math.round(Math.max(vbWidth, vbHeight) * 0.005));
    const style = `<style id="esp-venue-raster-style">* { stroke: #000000 !important; stroke-width: ${strokeWidth} !important; vector-effect: non-scaling-stroke; } path, line, polyline, polygon, circle, ellipse, rect { fill: none !important; }</style>`;
    const rasterSvgText = svgText.replace(/<svg\b([^>]*)>/i, (m) => `${m}${style}`);

    await sharp(Buffer.from(rasterSvgText), { density: 144, limitInputPixels: false })
      .resize({
        width: 2048,
        height: 2048,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 90, effort: 4 })
      .toFile(outputPath);

    const stats = await fs.stat(outputPath);
    console.log(`Generated venue raster WebP: ${file} (${stats.size} bytes)`);
    count += 1;
  }

  console.log(`Successfully generated ${count} venue WebP rasters.`);
}

main().catch((err) => {
  console.error('Error generating venue WebPs:', err);
  process.exit(1);
});
