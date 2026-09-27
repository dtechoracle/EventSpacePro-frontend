const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const WORKSPACE_STROKE_RATIO = 0.009;
const MAX_SIDE = 2048;

function readSvgSize(svgText) {
  const svgTag = svgText.match(/<svg\b[^>]*>/i)?.[0] || '';
  const width = svgTag.match(/\bwidth=["']([\d.]+)[a-z%]*["']/i)?.[1];
  const height = svgTag.match(/\bheight=["']([\d.]+)[a-z%]*["']/i)?.[1];
  const viewBox = svgTag.match(/\bviewBox=["']([^"']+)["']/i)?.[1];
  if (width && height) return { width: Number(width), height: Number(height), source: 'wh' };
  if (viewBox) {
    const parts = viewBox.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every(Number.isFinite)) {
      return { width: Math.abs(parts[2]), height: Math.abs(parts[3]), source: 'vb' };
    }
  }
  return { width: MAX_SIDE, height: MAX_SIDE, source: 'default' };
}

function prepareSvgForWorkspaceRaster(svgText, strokeWidth) {
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
  result = result.replace(/style\s*=\s*"([^"]*)"/gi, (_match, styleContent) => {
    let cleaned = styleContent
      .replace(/stroke-width\s*:[^;]+;?/gi, "")
      .replace(/(?<![a-z-])stroke\s*:[^;]+;?/gi, "")
      .replace(/(?<![-a-z])fill\s*:[^;]+;?/gi, "");
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
  result = result.replace(/<svg\b([^>]*?)>/i, (_match, attrs) => {
    let cleaned = attrs
      .replace(/\s+fill\s*=\s*["'][^"']*["']/gi, '')
      .replace(/\s+stroke\s*=\s*["'][^"']*["']/gi, '')
      .replace(/\s+stroke-width\s*=\s*["'][^"']*["']/gi, '');
    if (!/\s+fill-rule\s*=/i.test(cleaned)) {
      cleaned += ' fill-rule="evenodd"';
    }
    return `<svg${cleaned} fill="none" stroke="#000000" stroke-width="${strokeWidth}">`;
  });
  return result;
}

function viewBoxInfo(svgText) {
  const svgTag = svgText.match(/<svg\b[^>]*>/i)?.[0] || '';
  const viewBox = svgTag.match(/\bviewBox=["']([^"']+)["']/i)?.[1];
  if (!viewBox) return null;
  const parts = viewBox.trim().split(/[\s,]+/).map(Number);
  return parts.length === 4 ? parts : null;
}

const files = [
  'public/assets/modal/Furniture/4300mm X 2150mm Crescent Table.svg',
  'public/assets/modal/Furniture/L Shaped Sofa 01.svg',
  'public/assets/modal/Furniture/L Shaped Sofa 02.svg',
  'public/assets/modal/Furniture/1200mm X 600mm Coffee Table.svg',
  'public/assets/modal/Furniture/3 Seater Sofa 02.svg',
];

(async () => {
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    const size = readSvgSize(text);
    const vb = viewBoxInfo(text);
    const strokeFromWH = Math.max(1, Math.round(Math.max(size.width, size.height) * WORKSPACE_STROKE_RATIO));
    const strokeFromVB = vb ? Math.max(1, Math.round(Math.max(Math.abs(vb[2]), Math.abs(vb[3])) * WORKSPACE_STROKE_RATIO)) : null;
    console.log('\n===', path.basename(file));
    console.log('size source:', size.source, 'w/h:', size.width, size.height);
    console.log('viewBox:', vb ? vb.join(' ') : null);
    console.log('stroke from w/h:', strokeFromWH, '| stroke from viewBox:', strokeFromVB);

    const scale = Math.min(1, MAX_SIDE / Math.max(size.width, size.height));
    const prepared = prepareSvgForWorkspaceRaster(text, strokeFromWH);
    const outBase = path.join('Temp', path.basename(file, '.svg'));
    fs.mkdirSync('Temp', { recursive: true });
    fs.writeFileSync(outBase + '-current.svg', prepared, 'utf8');

    const meta = await sharp(Buffer.from(prepared), { density: 144, limitInputPixels: false }).metadata();
    await sharp(Buffer.from(prepared), { density: 144, limitInputPixels: false })
      .resize({
        width: Math.max(1, Math.round(size.width * scale)),
        height: Math.max(1, Math.round(size.height * scale)),
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ lossless: true, effort: 4 })
      .toFile(outBase + '-current.webp');

    const { channels, width: ow, height: oh, space } = await sharp(outBase + '-current.webp').metadata();
    const stats = await sharp(outBase + '-current.webp').stats();
    const alphaMean = stats.channels[3] ? stats.channels[3].mean : null;
    const rgbMeans = stats.channels.slice(0, 3).map(c => Math.round(c.mean));
    console.log('prepared root stroke:', (prepared.match(/<svg[^>]*>/i)||[''])[0].slice(0, 220));
    console.log('raw svg decode:', { width: meta.width, height: meta.height, density: meta.density });
    console.log('webp out:', { ow, oh, channels, space, rgbMeans, alphaMean });
  }
})().catch(e => { console.error(e); process.exit(1); });
