const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, 'public');
const OUTPUT_ROOT = path.join(PUBLIC_DIR, 'assets', 'raster');
const MAX_SIDE = 2048;
const WORKSPACE_STROKE_RATIO = 0.009;
const THIN_STROKE_RATIO = 0.0022;
const CONTENT_CROP_FILL_RATIO = 0.45;

function parseViewBox(svgText) {
  const m = svgText.match(/viewBox=["']([^"']+)["']/i);
  if (!m) return null;
  const parts = m[1].trim().split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || !parts.every(Number.isFinite)) return null;
  return { x: parts[0], y: parts[1], w: Math.abs(parts[2]), h: Math.abs(parts[3]) };
}

function contentBBox(svgText) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const m of svgText.matchAll(/\sd="([^"]+)"/gi)) {
    const re = /([MLHVZmlhvz])([^MLHVZmlhvz]*)/g;
    let c;
    let cx = 0, cy = 0;
    while ((c = re.exec(m[1]))) {
      const cmd = c[1].toUpperCase();
      const nums = (c[2].match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || []).map(Number);
      if (cmd === 'M' || cmd === 'L') {
        for (let i = 0; i + 1 < nums.length; i += 2) {
          cx = nums[i]; cy = nums[i + 1];
          if (cx < minX) minX = cx;
          if (cx > maxX) maxX = cx;
          if (cy < minY) minY = cy;
          if (cy > maxY) maxY = cy;
        }
      } else if (cmd === 'H') {
        for (const x of nums) {
          cx = x;
          if (cx < minX) minX = cx;
          if (cx > maxX) maxX = cx;
        }
      } else if (cmd === 'V') {
        for (const y of nums) {
          cy = y;
          if (cy < minY) minY = cy;
          if (cy > maxY) maxY = cy;
        }
      }
    }
  }
  if (!Number.isFinite(minX)) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function getStrokeRatio(rel) {
  return rel.includes('/Sitting_Styles/') ? THIN_STROKE_RATIO : WORKSPACE_STROKE_RATIO;
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
  result = result.replace(/(<path\b[^>]*?\bfill-rule\s*=\s*["']evenodd["'][^>]*?)\s+fill\s*=\s*["']([^"']*)["']/gi, '$1 fill="$2"');
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
  result = result.replace(/<g\b[^>]*\bfill-rule\s*=\s*["'][^"']+["'][^>]*>/gi, (tag) => {
    let next = tag.replace(/\s+stroke\s*=\s*["'][^"']*["']/gi, '');
    next = next.replace(/\s+stroke-width\s*=\s*["'][^"']*["']/gi, '');
    return next.replace(/<g\b/i, `<g stroke="#000000" stroke-width="${frStroke}"`);
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
    if (!/\s+fill-rule\s*=/i.test(cleaned)) {
      cleaned += ' fill-rule="evenodd"';
    }
    return `<svg${cleaned} fill="none" stroke="#000000" stroke-width="${strokeWidth}">`;
  });

  return result;
}

async function convert(svgPath) {
  const relativePublicPath = path.relative(PUBLIC_DIR, svgPath);
  const outputPath = path.join(OUTPUT_ROOT, relativePublicPath.replace(/\.svg$/i, '.webp'));
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const svgText = await fs.readFile(svgPath, 'utf8');
  const artboard = parseViewBox(svgText);
  const bbox = contentBBox(svgText);

  const useCrop =
    !!artboard && !!bbox && bbox.w > 1 && bbox.h > 1 &&
    (bbox.w < artboard.w * CONTENT_CROP_FILL_RATIO || bbox.h < artboard.h * CONTENT_CROP_FILL_RATIO);
  const cropBox = useCrop ? bbox : null;
  const renderBox = cropBox || artboard || { x: 0, y: 0, w: 2048, h: 2048 };

  const ratio = getStrokeRatio(relativePublicPath.replace(/\\/g, '/'));
  const strokeWidth = Math.max(0.5, Math.max(renderBox.w, renderBox.h) * ratio);
  const rasterSvgText = prepareSvgForWorkspaceRaster(svgText, strokeWidth, cropBox);

  const aspect = renderBox.w / renderBox.h;
  const outW = aspect >= 1 ? MAX_SIDE : Math.max(1, Math.round(MAX_SIDE * aspect));
  const outH = aspect >= 1 ? Math.max(1, Math.round(MAX_SIDE / aspect)) : MAX_SIDE;
  await sharp(Buffer.from(rasterSvgText), { density: 300, limitInputPixels: false })
    .resize({ width: outW, height: outH, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ lossless: true, effort: 4 })
    .toFile(outputPath);

  console.log(path.basename(svgPath), `stroke=${strokeWidth.toFixed(2)}`, `${outW}x${outH}`);
}

(async () => {
  const sittingDir = path.join(PUBLIC_DIR, 'assets/modal/Sitting_Styles');
  const sitting = (await fs.readdir(sittingDir)).filter(f => f.endsWith('.svg'));
  for (const f of sitting) await convert(path.join(sittingDir, f));

  await convert(path.join(PUBLIC_DIR, 'assets/modal/Furniture/6 Seater L Shaped Sofa.svg'));

  // previews
  const pairs = [
    ['assets/raster/assets/modal/Sitting_Styles/Boardroom.webp', 'Temp/boardroom-preview.png'],
    ['assets/raster/assets/modal/Sitting_Styles/Theatre or Auditorium.webp', 'Temp/theatre-preview.png'],
    ['assets/raster/assets/modal/Sitting_Styles/Circle.webp', 'Temp/circle-preview.png'],
    ['assets/raster/assets/modal/Furniture/6 Seater L Shaped Sofa.webp', 'Temp/lsofa-preview.png'],
  ];
  for (const [rel, dst] of pairs) {
    const buf = await sharp(path.join(PUBLIC_DIR, rel))
      .resize(400, 400, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .flatten({ background: '#fff' })
      .png().toBuffer();
    await fs.writeFile(dst, buf);
    console.log('preview', dst, buf.length + 'B');
  }
})().catch(e => { console.error(e); process.exit(1); });
