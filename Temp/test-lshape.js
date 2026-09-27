const fs = require('fs');
const sharp = require('sharp');
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

async function alphaPct(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let opaque = 0;
  const total = info.width * info.height;
  for (let i = 3; i < data.length; i += info.channels) if (data[i] > 250) opaque++;
  return +(100 * opaque / total).toFixed(1);
}

(async () => {
  // Crescent with viewBox-based stroke
  const crescent = fs.readFileSync('public/assets/modal/Furniture/4300mm X 2150mm Crescent Table.svg', 'utf8');
  const vb = (crescent.match(/viewBox="([^"]+)"/i)[1]).trim().split(/\s+/).map(Number);
  const swVB = Math.max(1, Math.round(Math.max(vb[2], vb[3]) * WORKSPACE_STROKE_RATIO));
  const prepC = prepare(crescent, swVB);
  await sharp(Buffer.from(prepC), { density: 144, limitInputPixels: false })
    .resize({ width: 2048, height: 1024, fit: 'inside', withoutEnlargement: true })
    .webp({ lossless: true })
    .toFile('Temp/crescent-vb.webp');
  console.log('crescent vb stroke', swVB, 'opaque%', await alphaPct('Temp/crescent-vb.webp'));

  // L shaped variants
  for (const name of ['L Shaped Sofa 01', 'L Shaped Sofa 02']) {
    const src = fs.readFileSync(`public/assets/modal/Furniture/${name}.svg`, 'utf8');
    const vb2 = (src.match(/viewBox="([^"]+)"/i)[1]).trim().split(/\s+/).map(Number);
    const sw = Math.max(1, Math.round(Math.max(vb2[2], vb2[3]) * WORKSPACE_STROKE_RATIO));
    const widthAttr = Number((src.match(/\bwidth="([\d.]+)/i) || [])[1]);
    const heightAttr = Number((src.match(/\bheight="([\d.]+)/i) || [])[1]);
    const scale = Math.min(1, 2048 / Math.max(widthAttr, heightAttr));

    // current pipeline
    const prep = prepare(src, sw);
    const out1 = `Temp/${name}-current.webp`;
    await sharp(Buffer.from(prep), { density: 144, limitInputPixels: false })
      .resize({
        width: Math.max(1, Math.round(widthAttr * scale)),
        height: Math.max(1, Math.round(heightAttr * scale)),
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ lossless: true })
      .toFile(out1);

    // without root stroke (fill only)
    const prepNoStroke = prep.replace(/ stroke="#000000" stroke-width="\d+"/, ' stroke="none" stroke-width="0"');
    const out2 = `Temp/${name}-nostroke.webp`;
    await sharp(Buffer.from(prepNoStroke), { density: 144, limitInputPixels: false })
      .resize({
        width: Math.max(1, Math.round(widthAttr * scale)),
        height: Math.max(1, Math.round(heightAttr * scale)),
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ lossless: true })
      .toFile(out2);

    // thicker stroke 3%
    const prepThick = prepare(src, Math.max(1, Math.round(Math.max(vb2[2], vb2[3]) * 0.03)));
    const out3 = `Temp/${name}-thick.webp`;
    await sharp(Buffer.from(prepThick), { density: 144, limitInputPixels: false })
      .resize({
        width: Math.max(1, Math.round(widthAttr * scale)),
        height: Math.max(1, Math.round(heightAttr * scale)),
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ lossless: true })
      .toFile(out3);

    console.log(name, {
      sw,
      current: await alphaPct(out1),
      nostroke: await alphaPct(out2),
      thick3pct: await alphaPct(out3),
    });
  }
})().catch(e => { console.error(e); process.exit(1); });
