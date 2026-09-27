const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const WORKSPACE_STROKE_RATIO = 0.009;

// Current prepare (copy from script)
function prepare(svgText, strokeWidth) {
  let result = svgText;
  result = result.replace(/viewBox=["']([\d\s.-]+)["']/i, (match, vb) => {
    const parts = vb.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every(Number.isFinite)) {
      const [x, y, w, h] = parts;
      const pad = Math.max(Math.abs(w), Math.abs(h)) * 0.05;
      return `viewBox="${x - pad} ${y - pad} ${w + pad * 2} ${h + pad * 2}"`;
    }
    return match;
  });
  result = result.replace(/style\s*=\s*"([^"]*)"/gi, (_m, sc) => {
    let cleaned = sc
      .replace(/stroke-width\s*:[^;]+;?/gi, '')
      .replace(/(?<![a-z-])stroke\s*:[^;]+;?/gi, '')
      .replace(/(?<![-a-z])fill\s*:[^;]+;?/gi, '');
    return cleaned.trim() ? `style="${cleaned.trim()}"` : '';
  });
  result = result.replace(/(<(?:path|circle|rect|line|polyline|ellipse|polygon|g)\b[^>]*?)\s+stroke-width\s*=\s*["'][^"']*["']/gi, '$1');
  result = result.replace(/(<(?:path|circle|rect|line|polyline|ellipse|polygon|g)\b[^>]*?)\s+stroke\s*=\s*["'][^"']*["']/gi, '$1');
  result = result.replace(/(<path\b[^>]*?\bfill-rule\s*=\s*["']evenodd["'][^>]*?)\s+fill\s*=\s*["']([^"']*)["']/gi, '$1 fill="$2"');
  result = result.replace(/(<(?:circle|rect|line|polyline|ellipse|polygon|g)\b[^>]*?)\s+fill\s*=\s*["'][^"']*["']/gi, '$1');
  result = result.replace(/(<path\b(?![^>]*\bfill-rule\b)[^>]*?)\s+fill\s*=\s*["'][^"']*["']/gi, '$1');
  result = result.replace(/<path\b[^>]*\bfill-rule\s*=\s*["']evenodd["'][^>]*\/?>/gi, (tag) => {
    let next = tag.replace(/\s+stroke\s*=\s*["'][^"']*["']/gi, '');
    next = next.replace(/\s+stroke-width\s*=\s*["'][^"']*["']/gi, '');
    return next;
  });
  result = result.replace(/<svg\b([^>]*?)>/i, (_m, attrs) => {
    let cleaned = attrs
      .replace(/\s+fill\s*=\s*["'][^"']*["']/gi, '')
      .replace(/\s+stroke\s*=\s*["'][^"']*["']/gi, '')
      .replace(/\s+stroke-width\s*=\s*["'][^"']*["']/gi, '');
    if (!/\s+fill-rule\s*=/i.test(cleaned)) cleaned += ' fill-rule="evenodd"';
    return `<svg${cleaned} fill="none" stroke="#000000" stroke-width="${strokeWidth}">`;
  });
  return result;
}

// Proposed: also preserve fill on g with fill-rule, and keep fill on fillable paths
function prepareFixed(svgText, strokeWidth) {
  let result = svgText;
  result = result.replace(/viewBox=["']([\d\s.-]+)["']/i, (match, vb) => {
    const parts = vb.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every(Number.isFinite)) {
      const [x, y, w, h] = parts;
      const pad = Math.max(Math.abs(w), Math.abs(h)) * 0.05;
      return `viewBox="${x - pad} ${y - pad} ${w + pad * 2} ${h + pad * 2}"`;
    }
    return match;
  });
  result = result.replace(/style\s*=\s*"([^"]*)"/gi, (_m, sc) => {
    let cleaned = sc
      .replace(/stroke-width\s*:[^;]+;?/gi, '')
      .replace(/(?<![a-z-])stroke\s*:[^;]+;?/gi, '')
      .replace(/(?<![-a-z])fill\s*:[^;]+;?/gi, '');
    return cleaned.trim() ? `style="${cleaned.trim()}"` : '';
  });
  result = result.replace(/(<(?:path|circle|rect|line|polyline|ellipse|polygon|g)\b[^>]*?)\s+stroke-width\s*=\s*["'][^"']*["']/gi, '$1');
  result = result.replace(/(<(?:path|circle|rect|line|polyline|ellipse|polygon|g)\b[^>]*?)\s+stroke\s*=\s*["'][^"']*["']/gi, '$1');
  // preserve fill on evenodd paths
  result = result.replace(/(<path\b[^>]*?\bfill-rule\s*=\s*["']evenodd["'][^>]*?)\s+fill\s*=\s*["']([^"']*)["']/gi, '$1 fill="$2"');
  // preserve fill on groups that have fill-rule (nonzero contour groups)
  result = result.replace(/(<g\b[^>]*?\bfill-rule\s*=\s*["'][^"']+["'][^>]*?)\s+fill\s*=\s*["']([^"']*)["']/gi, '$1 fill="$2"');
  // strip fill from other shapes (not g with fill-rule, not evenodd paths)
  result = result.replace(/(<(?:circle|rect|line|polyline|ellipse|polygon)\b[^>]*?)\s+fill\s*=\s*["'][^"']*["']/gi, '$1');
  // strip fill from g WITHOUT fill-rule
  result = result.replace(/(<g\b(?![^>]*\bfill-rule\b)[^>]*?)\s+fill\s*=\s*["'][^"']*["']/gi, '$1');
  // strip fill from paths WITHOUT fill-rule
  result = result.replace(/(<path\b(?![^>]*\bfill-rule\b)[^>]*?)\s+fill\s*=\s*["'][^"']*["']/gi, '$1');
  // fill-based paths: no fill, no stroke in ORIGINAL — mark before we lose that info.
  // After above strips, detect paths that have neither fill nor stroke nor fill-rule
  // and originally might have been fill-only. Use a pre-pass instead:
  result = result.replace(/<path\b[^>]*\bfill-rule\s*=\s*["']evenodd["'][^>]*\/?>/gi, (tag) => {
    let next = tag.replace(/\s+stroke\s*=\s*["'][^"']*["']/gi, '');
    next = next.replace(/\s+stroke-width\s*=\s*["'][^"']*["']/gi, '');
    return next;
  });
  result = result.replace(/<svg\b([^>]*?)>/i, (_m, attrs) => {
    let cleaned = attrs
      .replace(/\s+fill\s*=\s*["'][^"']*["']/gi, '')
      .replace(/\s+stroke\s*=\s*["'][^"']*["']/gi, '')
      .replace(/\s+stroke-width\s*=\s*["'][^"']*["']/gi, '');
    if (!/\s+fill-rule\s*=/i.test(cleaned)) cleaned += ' fill-rule="evenodd"';
    return `<svg${cleaned} fill="none" stroke="#000000" stroke-width="${strokeWidth}">`;
  });
  return result;
}

// Pre-pass: paths with no fill AND no stroke attribute AND no stroke in style → fill-based
function markFillOnly(svgText) {
  return svgText.replace(/<path\b[^>]*>/gi, (tag) => {
    const hasFill = /\sfill\s*=/i.test(tag);
    const hasStroke = /\sstroke\s*=/i.test(tag);
    const hasFR = /\bfill-rule\s*=/i.test(tag);
    if (!hasFill && !hasStroke && !hasFR) {
      // check if this path is inside... we can't easily. Just add fill.
      // But coffee table paths have stroke in style, not attr — they'd match here wrongly
      // if we only check attrs. Need to check the full path tag including style.
      const style = tag.match(/style\s*=\s*"([^"]*)"/i)?.[1] || '';
      const styleHasStroke = /stroke\s*:/i.test(style);
      if (!styleHasStroke) {
        return tag.replace(/<path\b/i, '<path fill="#000000"');
      }
    }
    return tag;
  });
}

async function alphaPct(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let opaque = 0;
  const total = info.width * info.height;
  for (let i = 3; i < data.length; i += info.channels) if (data[i] > 250) opaque++;
  return +(100 * opaque / total).toFixed(1);
}

async function render(svgText, out, targetW) {
  const vb = (svgText.match(/viewBox="([^"]+)"/i)[1]).trim().split(/\s+/).map(Number);
  const sw = Math.max(1, Math.round(Math.max(vb[2], vb[3]) * WORKSPACE_STROKE_RATIO));
  const prepared = prepareFixed(svgText, sw);
  const wAttr = Number((svgText.match(/\bwidth="([\d.]+)/i) || [])[1]);
  const hAttr = Number((svgText.match(/\bheight="([\d.]+)/i) || [])[1]);
  const scale = Math.min(1, targetW / Math.max(wAttr, hAttr));
  await sharp(Buffer.from(prepared), { density: 144, limitInputPixels: false })
    .resize({
      width: Math.max(1, Math.round(wAttr * scale)),
      height: Math.max(1, Math.round(hAttr * scale)),
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ lossless: true })
    .toFile(out);
  return sw;
}

(async () => {
  const files = [
    'public/assets/modal/Furniture/Sofa set with coffe table 01.svg',
    'public/assets/modal/Furniture/L Shaped Sofa 01.svg',
    'public/assets/modal/Furniture/L Shaped Sofa 02.svg',
    'public/assets/modal/Furniture/3 Seater Sofa 02.svg',
    'public/assets/modal/Furniture/1200mm X 600mm Coffee Table.svg',
    'public/assets/modal/Furniture/4300mm X 2150mm Crescent Table.svg',
  ];
  for (const f of files) {
    const raw = fs.readFileSync(f, 'utf8');
    const marked = markFillOnly(raw);
    const out = `Temp/fixed-${path.basename(f, '.svg')}.webp`;
    const sw = await render(marked, out, 2048);
    console.log(path.basename(f), 'stroke', sw, 'opaque%', await alphaPct(out));
  }
})().catch(e => { console.error(e); process.exit(1); });
