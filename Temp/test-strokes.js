const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Reproduce prepare + render crescent with stroke from viewBox vs width/height
const WORKSPACE_STROKE_RATIO = 0.009;

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

function parse(svgText) {
  const svgTag = svgText.match(/<svg\b[^>]*>/i)?.[0] || '';
  const width = svgTag.match(/\bwidth=["']([\d.]+)[a-z%]*["']/i)?.[1];
  const height = svgTag.match(/\bheight=["']([\d.]+)[a-z%]*["']/i)?.[1];
  const viewBox = svgTag.match(/\bviewBox=["']([^"']+)["']/i)?.[1];
  const vb = viewBox ? viewBox.trim().split(/[\s,]+/).map(Number) : null;
  return {
    w: width ? Number(width) : null,
    h: height ? Number(height) : null,
    vb,
  };
}

async function alphaPct(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let opaque = 0;
  const total = info.width * info.height;
  for (let i = 3; i < data.length; i += info.channels) if (data[i] > 250) opaque++;
  return (100 * opaque / total).toFixed(1);
}

(async () => {
  const crescent = 'public/assets/modal/Furniture/4300mm X 2150mm Crescent Table.svg';
  const text = fs.readFileSync(crescent, 'utf8');
  const p = parse(text);
  console.log('crescent parse', p);

  const strokeWH = Math.max(1, Math.round(Math.max(p.w, p.h) * WORKSPACE_STROKE_RATIO));
  const strokeVB = Math.max(1, Math.round(Math.max(Math.abs(p.vb[2]), Math.abs(p.vb[3])) * WORKSPACE_STROKE_RATIO));
  console.log('strokeWH', strokeWH, 'strokeVB', strokeVB);

  for (const [label, sw] of [['wh', strokeWH], ['vb', strokeVB]]) {
    const prepared = prepare(text, sw);
    const out = `Temp/crescent-${label}.webp`;
    await sharp(Buffer.from(prepared), { density: 144, limitInputPixels: false })
      .resize({ width: 2048, height: 1024, fit: 'inside', withoutEnlargement: true })
      .webp({ lossless: true })
      .toFile(out);
    console.log(label, 'opaque%', await alphaPct(out));
  }

  // L shaped: test with stroke disabled vs enabled
  for (const name of ['L Shaped Sofa 01', 'L Shaped Sofa 02']) {
    const f = `public/assets/modal/Furniture/${name}.svg`;
    const t = fs.readFileSync(f, 'utf8');
    const parsed = parse(t);
    const sw = Math.max(1, Math.round(Math.max(Math.abs(parsed.vb[2]), Math.abs(parsed.vb[3])) * WORKSPACE_STROKE_RATIO));
    const prepared = prepare(t, sw);
    const out = `Temp/${name}.webp`;
    await sharp(Buffer.from(prepared), { density: 144, limitInputPixels: false })
      .webp({ lossless: true, effort: 4 })
      .toFile(out);
    console.log(name, 'vb', parsed.vb, 'stroke', sw, 'opaque%', await alphaPct(out));
  }
})().catch(e => { console.error(e); process.exit(1); });
