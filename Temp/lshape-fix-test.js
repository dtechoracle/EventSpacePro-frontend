const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SRC = path.join('public', 'assets', 'modal', 'Furniture');
const OUT = path.join(process.cwd(), 'Temp', 'lshape-fix');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const files = [
  'L Shaped Sofa 01.svg',
  'L Shaped Sofa 02.svg',
  '3 Seater Sofa 02.svg',
  'Sofa set with coffe table 01.svg',
  '6 Seater L Shaped Sofa.svg',
];

function viewBoxOf(svg) {
  const m = svg.match(/viewBox="([\d.\-\s]+)"/i);
  if (!m) {
    const w = parseFloat(svg.match(/\bwidth=["']([\d.]+)/i)?.[1] || '0');
    const h = parseFloat(svg.match(/\bheight=["']([\d.]+)/i)?.[1] || '0');
    return w && h ? { width: w, height: h } : null;
  }
  const p = m[1].trim().split(/[\s,]+/).map(Number);
  return { width: Math.abs(p[2]), height: Math.abs(p[3]) };
}

function setRootStroke(svg, w) {
  let out = svg;
  if (/<svg[^>]*\bstroke-width="/i.test(out)) {
    out = out.replace(/(<svg[^>]*?\bstroke-width=")[^"]*(")/i, `$1${w}$2`);
  } else {
    out = out.replace(/<svg\b/i, `<svg stroke-width="${w}"`);
  }
  if (/<svg[^>]*\bstroke="/i.test(out)) {
    out = out.replace(/(<svg[^>]*?\bstroke=")[^"]*(")/i, '$1#000000$2');
  } else {
    out = out.replace(/<svg\b/i, '<svg stroke="#000000"');
  }
  if (/<svg[^>]*\sfill="/i.test(out)) {
    out = out.replace(/(<svg[^>]*?\sfill=")[^"]*(")/i, '$1none$2');
  } else {
    out = out.replace(/<svg\b/i, '<svg fill="none"');
  }
  return out;
}

// Mimic pipeline: expand vb 5%, strip child fills except fill-rule, root fill=none stroke
function prepare(svg, strokeW) {
  let result = svg;
  // expand viewBox 5%
  result = result.replace(/viewBox=["']([\d\s.-]+)["']/i, (match, vb) => {
    const parts = vb.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every(Number.isFinite)) {
      const [x, y, w, h] = parts;
      const pad = Math.max(Math.abs(w), Math.abs(h)) * 0.05;
      return `viewBox="${x - pad} ${y - pad} ${w + pad * 2} ${h + pad * 2}"`;
    }
    return match;
  });
  // strip child stroke/fill except fill-rule paths/groups
  result = result.replace(/(<(?:path|circle|rect|line|polyline|ellipse|polygon|g)\b[^>]*?)\s+stroke-width\s*=\s*["'][^"']*["']/gi, '$1');
  result = result.replace(/(<(?:path|circle|rect|line|polyline|ellipse|polygon|g)\b[^>]*?)\s+stroke\s*=\s*["'][^"']*["']/gi, '$1');
  result = result.replace(/(<path\b[^>]*?\bfill-rule\s*=\s*["']evenodd["'][^>]*?)\s+fill\s*=\s*["']([^"']*)["']/gi, '$1 fill="$2"');
  result = result.replace(/(<g\b[^>]*?\bfill-rule\s*=\s*["'][^"']+["'][^>]*?)\s+fill\s*=\s*["']([^"']*)["']/gi, '$1 fill="$2"');
  result = result.replace(/(<(?:circle|rect|line|polyline|ellipse|polygon)\b[^>]*?)\s+fill\s*=\s*["'][^"']*["']/gi, '$1');
  result = result.replace(/(<g\b(?![^>]*\bfill-rule\b)[^>]*?)\s+fill\s*=\s*["'][^"']*["']/gi, '$1');
  result = result.replace(/(<path\b(?![^>]*\bfill-rule\b)[^>]*?)\s+fill\s*=\s*["'][^"']*["']/gi, '$1');
  result = setRootStroke(result, strokeW);
  return result;
}

// Variant: fill-rule paths get stroke="none" so only their fill band shows;
// non-fill-rule paths still get root stroke.
function prepareNoStrokeOnFR(svg, strokeW) {
  let result = prepare(svg, strokeW);
  result = result.replace(/<path\b[^>]*\bfill-rule\s*=\s*["'][^"']+["'][^>]*\/?>/gi, (tag) => {
    let t = tag.replace(/\s+stroke\s*=\s*["'][^"']*["']/gi, '');
    t = t.replace(/\s+stroke-width\s*=\s*["'][^"']*["']/gi, '');
    if (/\s+stroke\s*=/i.test(t)) return t;
    return t.replace(/<path\b/i, '<path stroke="none"');
  });
  return result;
}

// Variant: fill-rule paths get a reduced stroke (fraction of root)
function prepareReducedFRStroke(svg, strokeW, factor = 0.35) {
  let result = prepare(svg, strokeW);
  const reduced = strokeW * factor;
  result = result.replace(/<path\b[^>]*\bfill-rule\s*=\s*["'][^"']+["'][^>]*\/?>/gi, (tag) => {
    let t = tag.replace(/\s+stroke\s*=\s*["'][^"']*["']/gi, '');
    t = t.replace(/\s+stroke-width\s*=\s*["'][^"']*["']/gi, '');
    return t.replace(/<path\b/i, `<path stroke="#000000" stroke-width="${reduced}"`);
  });
  return result;
}

async function raster(svg, outPath, density = 72) {
  await sharp(Buffer.from(svg), { density }).png().toFile(outPath);
  const { data, info } = await sharp(outPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let opaque = 0;
  for (let i = 0; i < data.length; i += info.channels) if (data[i + 3] > 32) opaque++;
  return { pct: +(100 * opaque / (info.width * info.height)).toFixed(2), w: info.width, h: info.height };
}

async function asciiAtUI(pngPath, size = 64) {
  const { data, info } = await sharp(pngPath).ensureAlpha()
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .raw().toBuffer({ resolveWithObject: true });
  const chars = ' .:-=+*#%@';
  const cols = 64, rows = 28;
  const small = await sharp(pngPath).ensureAlpha()
    .resize(cols, rows, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .raw().toBuffer({ resolveWithObject: true });
  const lines = [];
  for (let y = 0; y < small.info.height; y++) {
    let line = '';
    for (let x = 0; x < small.info.width; x++) {
      const a = small.data[(y * small.info.width + x) * small.info.channels + 3];
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
    const sw = (vb ? vb.width : 1000) * 0.009;
    console.log('\n====', name, 'sw', sw.toFixed(2));

    const variants = {
      'current': prepare(svg, sw),
      'no-stroke-on-FR': prepareNoStrokeOnFR(svg, sw),
      'reduced-FR-0.35': prepareReducedFRStroke(svg, sw, 0.35),
      'reduced-FR-0.5': prepareReducedFRStroke(svg, sw, 0.5),
    };

    for (const [label, vsvg] of Object.entries(variants)) {
      const out = path.join(OUT, name.replace(/\.svg$/, '') + '-' + label.replace(/[^a-z0-9.-]/gi, '_') + '.png');
      try {
        const r = await raster(vsvg, out);
        console.log(`  ${label}: ${r.pct}% opaque`);
        if (name.includes('L Shaped') || name.includes('3 Seater')) {
          console.log(await asciiAtUI(out));
        }
      } catch (e) {
        console.log('  FAIL', label, e.message);
      }
    }
  }
})().catch(e => { console.error(e); process.exit(1); });
