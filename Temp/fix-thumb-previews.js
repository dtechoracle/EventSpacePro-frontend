const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, 'public');
const OUTPUT_ROOT = path.join(PUBLIC_DIR, 'assets', 'raster');
const MAX_SIDE = 1024;

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

function prepare(svgText, strokeWidth, viewBox, { outlineOnly }) {
  let result = svgText;
  let vb = viewBox;
  if (vb) {
    const pad = Math.max(vb.w, vb.h) * 0.05;
    vb = { x: vb.x - pad, y: vb.y - pad, w: vb.w + pad * 2, h: vb.h + pad * 2 };
    result = result.replace(/viewBox=["'][^"']+["']/i, `viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}"`);
  }

  result = result.replace(/style\s*=\s*"([^"]*)"/gi, (_m, styleContent) => {
    let cleaned = styleContent
      .replace(/stroke-width\s*:[^;]+;?/gi, '')
      .replace(/(?<![a-z-])stroke\s*:[^;]+;?/gi, '')
      .replace(/(?<![-a-z])fill\s*:[^;]+;?/gi, '');
    return cleaned.trim() ? `style="${cleaned.trim()}"` : '';
  });

  result = result.replace(/(<(?:path|circle|rect|line|polyline|ellipse|polygon|g)\b[^>]*?)\s+stroke-width\s*=\s*["'][^"']*["']/gi, '$1');
  result = result.replace(/(<(?:path|circle|rect|line|polyline|ellipse|polygon|g)\b[^>]*?)\s+stroke\s*=\s*["'][^"']*["']/gi, '$1');

  if (outlineOnly) {
    result = result.replace(/(<(?:path|circle|rect|ellipse|polygon|polyline)\b[^>]*?)\s+fill\s*=\s*["'][^"']*["']/gi, '$1');
    result = result.replace(/<(path|circle|rect|ellipse|polygon|polyline)\b/gi, '<$1 fill="none"');
  }

  result = result.replace(/<svg\b([^>]*?)>/i, (_m, attrs) => {
    let cleaned = attrs
      .replace(/\s+fill\s*=\s*["'][^"']*["']/gi, '')
      .replace(/\s+stroke\s*=\s*["'][^"']*["']/gi, '')
      .replace(/\s+stroke-width\s*=\s*["'][^"']*["']/gi, '');
    if (vb) {
      cleaned = cleaned.replace(/\s+width\s*=\s*["'][^"']*["']/gi, '');
      cleaned = cleaned.replace(/\s+height\s*=\s*["'][^"']*["']/gi, '');
      cleaned += ` width="${vb.w}" height="${vb.h}"`;
    }
    return `<svg${cleaned} fill="none" stroke="#000000" stroke-width="${strokeWidth}">`;
  });
  return { prepared: result, vb };
}

async function convert(svgRel, strokeRatio, outlineOnly) {
  const svgPath = path.join(PUBLIC_DIR, svgRel);
  const outputPath = path.join(OUTPUT_ROOT, svgRel.replace(/\.svg$/i, '.webp'));
  const svgText = await fs.readFile(svgPath, 'utf8');

  const artboard = parseViewBox(svgText) || { x: 0, y: 0, w: 800, h: 600 };
  const bbox = contentBBox(svgText);
  const useBBox =
    bbox &&
    bbox.w > 1 &&
    bbox.h > 1 &&
    (bbox.w < artboard.w * 0.45 || bbox.h < artboard.h * 0.45);
  const vb = useBBox ? bbox : artboard;
  const strokeWidth = Math.max(0.5, Math.max(vb.w, vb.h) * strokeRatio);
  const { prepared } = prepare(svgText, strokeWidth, vb, { outlineOnly });

  const aspect = vb.w / vb.h;
  const outW = aspect >= 1 ? MAX_SIDE : Math.max(1, Math.round(MAX_SIDE * aspect));
  const outH = aspect >= 1 ? Math.max(1, Math.round(MAX_SIDE / aspect)) : MAX_SIDE;

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await sharp(Buffer.from(prepared), { density: 300, limitInputPixels: false })
    .resize({ width: outW, height: outH, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ lossless: true, effort: 4 })
    .toFile(outputPath);

  const st = await fs.stat(outputPath);
  console.log(`${path.basename(svgRel)} -> ${outW}x${outH} ${st.size}B stroke=${strokeWidth.toFixed(2)}`);
}

(async () => {
  const dance = [
    'assets/modal/Dance Floor/16ft by 16ft Dance Floor.svg',
    'assets/modal/Dance Floor/16ft by 16ft Round Dance Floor.svg',
    'assets/modal/Dance Floor/20ft by 20ft Dance Floor.svg',
    'assets/modal/Dance Floor/20ft by 20ft Round Dance Floor.svg',
  ];
  for (const f of dance) await convert(f, 0.012, true);

  const sittingDir = path.join(PUBLIC_DIR, 'assets/modal/Sitting_Styles');
  const sitting = (await fs.readdir(sittingDir))
    .filter(f => f.toLowerCase().endsWith('.svg'))
    .map(f => `assets/modal/Sitting_Styles/${f}`);
  for (const f of sitting) await convert(f, 0.0015, true);

  // previews for visual check
  const sharp2 = sharp;
  for (const [rel, out] of [
    ['assets/modal/Dance Floor/16ft by 16ft Dance Floor.svg', 'Temp/dance-preview.png'],
    ['assets/modal/Sitting_Styles/Boardroom.svg', 'Temp/boardroom-preview.png'],
    ['assets/modal/Sitting_Styles/Circle.svg', 'Temp/circle-preview.png'],
    ['assets/modal/Sitting_Styles/Banquet.svg', 'Temp/banquet-preview.png'],
  ]) {
    const webpRel = rel.replace(/\.svg$/i, '.webp');
    const webpPath = path.join(OUTPUT_ROOT, webpRel);
    const buf = await sharp2(webpPath).resize(400, 400, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    }).flatten({ background: '#ffffff' }).png().toBuffer();
    await fs.writeFile(out, buf);
    const m = await sharp2(buf).metadata();
    const s = await sharp2(buf).stats();
    console.log('preview', out, m.width + 'x' + m.height, 'means=' + s.channels.map(c => Math.round(c.mean)).join(','));
  }
})().catch((e) => { console.error(e); process.exit(1); });
