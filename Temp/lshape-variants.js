const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { execSync } = require('child_process');

// Render L-shaped SVGs three ways: as-is (current pipeline), fill-only (no stroke), stroke-only (no fill)
// to diagnose what the user sees as "the same issue" (blob vs outline vs invisible)

const files = [
  'L Shaped Sofa 01.svg',
  'L Shaped Sofa 02.svg',
  '3 Seater Sofa 02.svg',
];

const SRC = path.join('public', 'assets', 'modal', 'Furniture');
const OUT = path.join(process.cwd(), 'Temp', 'lshape-test');

function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

function readSvg(name) {
  return fs.readFileSync(path.join(SRC, name), 'utf8');
}

// Mimic generate-asset-webp.js prepare step enough for testing:
// - viewBox-based stroke width (0.9%)
// - strip fill from shapes (current pipeline strips fill from non-fill-rule paths)
function viewBoxOf(svg) {
  const m = svg.match(/viewBox="([\d.\-\s]+)"/i);
  if (!m) return null;
  const parts = m[1].trim().split(/[\s,]+/).map(Number);
  return { minX: parts[0], minY: parts[1], width: parts[2], height: parts[3] };
}

function strokeWidth(vb) {
  if (!vb) return 0;
  return vb.width * 0.009;
}

function applyStroke(svg, w) {
  // Add/replace stroke on root svg
  let out = svg;
  if (/<svg[^>]*\bstroke="/i.test(out)) {
    out = out.replace(/(<svg[^>]*?\bstroke=")[^"]*(")/i, `$1#000000$2`);
  } else {
    out = out.replace(/<svg\b/i, `<svg stroke="#000000"`);
  }
  if (/<svg[^>]*\bstroke-width="/i.test(out)) {
    out = out.replace(/(<svg[^>]*?\bstroke-width=")[^"]*(")/i, `$1${w}$2`);
  } else {
    out = out.replace(/<svg\b/i, `<svg stroke-width="${w}"`);
  }
  return out;
}

function stripStroke(svg) {
  return svg
    .replace(/\sstroke="[^"]*"/gi, '')
    .replace(/\sstroke-width="[^"]*"/gi, '');
}

function forceFill(svg) {
  // Ensure all paths have fill
  return svg.replace(/<path\b(?![^>]*\sfill=)/gi, '<path fill="#000000"');
}

async function raster(svg, outPath) {
  await sharp(Buffer.from(svg), { density: 150 })
    .png()
    .toFile(outPath);
  const { data, info } = await sharp(outPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let opaque = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i + 3] > 32) opaque++;
  }
  const pct = (100 * opaque / (info.width * info.height)).toFixed(2);
  return { pct, w: info.width, h: info.height };
}

function ascii(pngPath, cols = 72, rows = 30) {
  // sync-ish via sharp pipeline in main
  return null;
}

(async () => {
  ensureDir(OUT);
  for (const name of files) {
    const svg = readSvg(name);
    const vb = viewBoxOf(svg);
    const sw = strokeWidth(vb);
    console.log('\n====', name, 'viewBox', vb, 'strokeWidth', sw.toFixed(1));

    const variants = {
      'current': applyStroke(svg, sw),
      'fill-only': stripStroke(svg),
      'stroke-only': stripStroke(applyStroke(svg, sw)).replace(/\sfill="[^"]*"/gi, ' fill="none"').replace(/<path\b(?![^>]*\sfill=)/gi, '<path fill="none"'),
      'heavy-stroke': applyStroke(svg, sw * 3),
    };

    for (const [label, vsvg] of Object.entries(variants)) {
      const out = path.join(OUT, name.replace(/\.svg$/, '') + '-' + label + '.png');
      try {
        const r = await raster(vsvg, out);
        // ascii at UI-ish density
        const { data, info } = await sharp(out).ensureAlpha()
          .resize(72, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .raw().toBuffer({ resolveWithObject: true });
        const chars = ' .:-=+*#%@';
        console.log(`\n-- ${label}: ${r.pct}% opaque ${r.w}x${r.h}`);
        for (let y = 0; y < info.height; y++) {
          let line = '';
          for (let x = 0; x < info.width; x++) {
            const a = data[(y * info.width + x) * info.channels + 3];
            line += chars[Math.min(9, Math.floor((a / 256) * 10))];
          }
          console.log(line);
        }
      } catch (e) {
        console.log('  FAIL', label, e.message);
      }
    }
  }
})().catch(e => { console.error(e); process.exit(1); });
