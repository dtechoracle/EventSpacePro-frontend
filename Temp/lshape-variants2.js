const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SRC = path.join('public', 'assets', 'modal', 'Furniture');
const OUT = path.join(process.cwd(), 'Temp', 'lshape-test2');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const files = ['L Shaped Sofa 01.svg', 'L Shaped Sofa 02.svg'];

function viewBoxOf(svg) {
  const m = svg.match(/viewBox="([\d.\-\s]+)"/i);
  if (!m) return null;
  const p = m[1].trim().split(/[\s,]+/).map(Number);
  return { width: p[2], height: p[3] };
}

function applyStroke(svg, w) {
  let out = svg;
  if (/<svg[^>]*\bstroke="/i.test(out)) out = out.replace(/(<svg[^>]*?\bstroke=")[^"]*(")/i, '$1#000000$2');
  else out = out.replace(/<svg\b/i, '<svg stroke="#000000"');
  if (/<svg[^>]*\bstroke-width="/i.test(out)) out = out.replace(/(<svg[^>]*?\bstroke-width=")[^"]*(")/i, `$1${w}$2`);
  else out = out.replace(/<svg\b/i, `<svg stroke-width="${w}"`);
  return out;
}

function stripStroke(svg) {
  return svg.replace(/\sstroke="[^"]*"/gi, '').replace(/\sstroke-width="[^"]*"/gi, '');
}

async function raster(svg, outPath, density = 72) {
  await sharp(Buffer.from(svg), { density }).png().toFile(outPath);
  const { data, info } = await sharp(outPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let opaque = 0;
  for (let i = 0; i < data.length; i += info.channels) if (data[i + 3] > 32) opaque++;
  return { pct: +(100 * opaque / (info.width * info.height)).toFixed(2), w: info.width, h: info.height };
}

async function ascii(pngPath, cols = 72, rows = 30) {
  const { data, info } = await sharp(pngPath).ensureAlpha()
    .resize(cols, rows, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .raw().toBuffer({ resolveWithObject: true });
  const chars = ' .:-=+*#%@';
  const lines = [];
  for (let y = 0; y < info.height; y++) {
    let line = '';
    for (let x = 0; x < info.width; x++) {
      const a = data[(y * info.width + x) * info.channels + 3];
      line += chars[Math.min(9, Math.floor((a / 256) * 10))];
    }
    lines.push(line);
  }
  return lines.join('\n');
}

(async () => {
  for (const name of files) {
    const svg = fs.readFileSync(path.join(SRC, name), 'utf8');
    const vb = viewBoxOf(svg);
    const sw = vb.width * 0.009;
    console.log('\n====', name, 'sw', sw.toFixed(1));

    const variants = {
      current: applyStroke(svg, sw),
      'fill-only': stripStroke(svg),
      'stroke-only': (() => {
        let s = stripStroke(applyStroke(svg, sw));
        s = s.replace(/\sfill="[^"]*"/gi, ' fill="none"');
        s = s.replace(/<path\b(?![^>]*\sfill=)/gi, '<path fill="none"');
        return s;
      })(),
    };

    for (const [label, vsvg] of Object.entries(variants)) {
      const out = path.join(OUT, name.replace(/\.svg$/, '') + '-' + label + '.png');
      try {
        const r = await raster(vsvg, out);
        console.log(`\n-- ${label}: ${r.pct}% opaque ${r.w}x${r.h}`);
        console.log(await ascii(out));
      } catch (e) {
        console.log('FAIL', label, e.message);
      }
    }
  }
})().catch(e => { console.error(e); process.exit(1); });
