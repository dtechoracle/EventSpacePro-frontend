const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, 'public');
const OUTPUT_ROOT = path.join(PUBLIC_DIR, 'assets', 'raster');
const WORKSPACE_STROKE_RATIO = 0.014;

const FILES = [
  'assets/modal/Layout/24ft by 12ft Stage.svg',
  'assets/modal/Layout/36ft by 12ft Stage.svg',
  'assets/modal/Layout/40ft by 12ft Stage.svg',
];

function readSvgSize(svgText) {
  const svgTag = svgText.match(/<svg\b[^>]*>/i)?.[0] || '';
  const width = svgTag.match(/\bwidth=["']([\d.]+)[a-z%]*["']/i)?.[1];
  const height = svgTag.match(/\bheight=["']([\d.]+)[a-z%]*["']/i)?.[1];
  const viewBox = svgTag.match(/\bviewBox=["']([^"']+)["']/i)?.[1];
  let viewBoxSize = null;
  if (viewBox) {
    const parts = viewBox.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every(Number.isFinite)) {
      viewBoxSize = { width: Math.abs(parts[2]), height: Math.abs(parts[3]) };
    }
  }
  if (width && height) return { width: Number(width), height: Number(height), viewBoxSize };
  if (viewBoxSize) return { ...viewBoxSize, viewBoxSize };
  return { width: 2048, height: 2048, viewBoxSize: null };
}

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
  result = result.replace(/style\s*=\s*"([^"]*)"/gi, (_m, styleContent) => {
    let cleaned = styleContent
      .replace(/stroke-width\s*:[^;]+;?/gi, '')
      .replace(/(?<![a-z-])stroke\s*:[^;]+;?/gi, '')
      .replace(/(?<![-a-z])fill\s*:[^;]+;?/gi, '');
    return cleaned.trim() ? `style="${cleaned.trim()}"` : '';
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

(async () => {
  for (const rel of FILES) {
    const svgPath = path.join(PUBLIC_DIR, rel);
    const outputPath = path.join(OUTPUT_ROOT, rel.replace(/\.svg$/i, '.webp'));
    const svgText = await fs.readFile(svgPath, 'utf8');
    const { width, height, viewBoxSize } = readSvgSize(svgText);
    const longer = Math.max(width, height);
    const strokeWidth = longer * WORKSPACE_STROKE_RATIO;
    const prepared = prepare(svgText, strokeWidth);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    const maxSize = 2048;
    const scale = Math.min(1, maxSize / Math.max(width, height));
    await sharp(Buffer.from(prepared), { density: 144, limitInputPixels: false })
      .resize(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)), {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ lossless: true, effort: 4 })
      .toFile(outputPath);
    const st = await fs.stat(outputPath);
    console.log(`${rel} -> ${st.size} bytes (stroke ${strokeWidth.toFixed(1)}, vb ${JSON.stringify(viewBoxSize)})`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
