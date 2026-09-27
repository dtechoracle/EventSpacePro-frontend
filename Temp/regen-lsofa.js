const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, 'public');
const OUTPUT_ROOT = path.join(PUBLIC_DIR, 'assets', 'raster');
const MAX_SIDE = 2048;
const WORKSPACE_STROKE_RATIO = 0.009;

function parseViewBox(svgText) {
  const m = svgText.match(/viewBox=["']([^"']+)["']/i);
  if (!m) return null;
  const parts = m[1].trim().split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || !parts.every(Number.isFinite)) return null;
  return { x: parts[0], y: parts[1], w: Math.abs(parts[2]), h: Math.abs(parts[3]) };
}

function prepareSvgForWorkspaceRaster(svgText, strokeWidth, cropBox) {
  let result = svgText;

  result = result.replace(/<path\b[^>]*?>/gi, (tag) => {
    const hasFill = /\sfill\s*=/i.test(tag);
    const hasStroke = /\sstroke\s*=/i.test(tag);
    const hasFR = /\bfill-rule\s*=/i.test(tag);
    if (hasFill || hasStroke || hasFR) return tag;
    const style = tag.match(/style\s*=\s*"([^"]*)"/i)?.[1] || '';
    if (/stroke\s*:/i.test(style) || /fill-rule\s*:/i.test(style)) return tag;
    return tag.replace(/<path\b/i, '<path fill="#000000"');
  });

  if (cropBox) {
    const pad = Math.max(cropBox.w, cropBox.h) * 0.05;
    result = result.replace(
      /viewBox=["'][^"']+["']/i,
      `viewBox="${cropBox.x - pad} ${cropBox.y - pad} ${cropBox.w + pad * 2} ${cropBox.h + pad * 2}"`
    );
  } else {
    result = result.replace(/viewBox=["']([\d\s.-]+)["']/i, (match, vb) => {
      const parts = vb.trim().split(/[\s,]+/).map(Number);
      if (parts.length === 4 && parts.every(Number.isFinite)) {
        const [x, y, w, h] = parts;
        const pad = Math.max(Math.abs(w), Math.abs(h)) * 0.05;
        return `viewBox="${x - pad} ${y - pad} ${w + pad * 2} ${h + pad * 2}"`;
      }
      return match;
    });
  }

  result = result.replace(/style\s*=\s*"([^"]*)"/gi, (_match, styleContent) => {
    let cleaned = styleContent
      .replace(/stroke-width\s*:[^;]+;?/gi, '')
      .replace(/(?<![a-z-])stroke\s*:[^;]+;?/gi, '')
      .replace(/(?<![-a-z])fill\s*:[^;]+;?/gi, '');
    return cleaned.trim() ? `style="${cleaned.trim()}"` : '';
  });

  result = result.replace(/(<(?:path|circle|rect|line|polyline|ellipse|polygon|g)\b[^>]*?)\s+stroke-width\s*=\s*["'][^"']*["']/gi, '$1');
  result = result.replace(/(<(?:path|circle|rect|line|polyline|ellipse|polygon|g)\b[^>]*?)\s+stroke\s*=\s*["'][^"']*["']/gi, '$1');
  result = result.replace(/(<path\b[^>]*?\bfill-rule\s*=\s*["'][^"']+["'][^>]*?)\s+fill\s*=\s*["']([^"']*)["']/gi, '$1 fill="$2"');
  result = result.replace(/(<g\b[^>]*?\bfill-rule\s*=\s*["'][^"']+["'][^>]*?)\s+fill\s*=\s*["']([^"']*)["']/gi, '$1 fill="$2"');
  result = result.replace(/(<(?:circle|rect|line|polyline|ellipse|polygon)\b[^>]*?)\s+fill\s*=\s*["'][^"']*["']/gi, '$1');
  result = result.replace(/(<g\b(?![^>]*\bfill-rule\b)[^>]*?)\s+fill\s*=\s*["'][^"']*["']/gi, '$1');
  result = result.replace(/(<path\b(?![^>]*\bfill-rule\b)[^>]*?)\s+fill\s*=\s*["'][^"']*["']/gi, '$1');

  const frStroke = strokeWidth * 0.28;
  result = result.replace(/<path\b[^>]*\bfill-rule\s*=\s*["'][^"']+["'][^>]*\/?>/gi, (tag) => {
    let next = tag.replace(/\s+stroke\s*=\s*["'][^"']*["']/gi, '');
    next = next.replace(/\s+stroke-width\s*=\s*["'][^"']*["']/gi, '');
    return next.replace(/<path\b/i, `<path stroke="#000000" stroke-width="${frStroke}"`);
  });

  let padded = null;
  if (cropBox) {
    const pad = Math.max(cropBox.w, cropBox.h) * 0.05;
    padded = { w: cropBox.w + pad * 2, h: cropBox.h + pad * 2 };
  }
  result = result.replace(/<svg\b([^>]*?)>/i, (_match, attrs) => {
    let cleaned = attrs
      .replace(/\s+fill\s*=\s*["'][^"']*["']/gi, '')
      .replace(/\s+stroke\s*=\s*["'][^"']*["']/gi, '')
      .replace(/\s+stroke-width\s*=\s*["'][^"']*["']/gi, '');
    if (padded) {
      cleaned = cleaned.replace(/\s+width\s*=\s*["'][^"']*["']/gi, '');
      cleaned = cleaned.replace(/\s+height\s*=\s*["'][^"']*["']/gi, '');
      cleaned += ` width="${padded.w}" height="${padded.h}"`;
    }
    // Do NOT force root fill-rule=evenodd — it overrides child nonzero fills via inheritance.
    return `<svg${cleaned} fill="none" stroke="#000000" stroke-width="${strokeWidth}">`;
  });

  return result;
}

(async () => {
  const svgRel = 'assets/modal/Furniture/6 Seater L Shaped Sofa.svg';
  const svgPath = path.join(PUBLIC_DIR, svgRel);
  const outputPath = path.join(OUTPUT_ROOT, svgRel.replace(/\.svg$/i, '.webp'));
  const svgText = await fs.readFile(svgPath, 'utf8');
  const artboard = parseViewBox(svgText) || { x: 0, y: 0, w: 640, h: 480 };
  const strokeWidth = Math.max(0.5, Math.max(artboard.w, artboard.h) * WORKSPACE_STROKE_RATIO);
  const prepared = prepareSvgForWorkspaceRaster(svgText, strokeWidth, null);

  const pathTag = prepared.match(/<path[^>]+>/)[0];
  console.log('path head:', pathTag.slice(0, 180));
  console.log('root:', prepared.match(/<svg[^>]+>/)[0]);
  console.log('stroke', strokeWidth, 'fr', strokeWidth * 0.28);

  const aspect = artboard.w / artboard.h;
  const outW = aspect >= 1 ? MAX_SIDE : Math.round(MAX_SIDE * aspect);
  const outH = aspect >= 1 ? Math.round(MAX_SIDE / aspect) : MAX_SIDE;

  await sharp(Buffer.from(prepared), { density: 300, limitInputPixels: false })
    .resize({ width: outW, height: outH, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ lossless: true, effort: 4 })
    .toFile(outputPath);

  const buf = await sharp(outputPath)
    .resize(480, 360, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .flatten({ background: '#fff' })
    .png().toBuffer();
  await fs.writeFile('Temp/lsofa-webp.png', buf);
  const s = await sharp(buf).stats();
  console.log('preview mean', s.channels.map(c => Math.round(c.mean)).join(','), 'bytes', buf.length);
})().catch(e => { console.error(e); process.exit(1); });
