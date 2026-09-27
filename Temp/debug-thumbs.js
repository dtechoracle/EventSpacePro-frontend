const fs = require('fs/promises');
const path = require('path');

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
  if (viewBox) {
    const pad = Math.max(viewBox.w, viewBox.h) * 0.04;
    result = result.replace(
      /viewBox=["'][^"']+["']/i,
      `viewBox="${viewBox.x - pad} ${viewBox.y - pad} ${viewBox.w + pad * 2} ${viewBox.h + pad * 2}"`
    );
  }
  result = result.replace(/style\s*=\s*"([^"]*)"/gi, (_m, styleContent) => {
    let cleaned = styleContent
      .replace(/stroke-width\s*:[^;]+;?/gi, '')
      .replace(/(?<![a-z-])stroke\s*:[^;]+;?/gi, '')
      .replace(/(?<![-a-z])fill\s*:[^;]+;?/gi, '');
    return cleaned.trim() ? `style="${cleaned.trim()}"` : '';
  });
  if (outlineOnly) {
    result = result.replace(/(<(?:path|circle|rect|ellipse|polygon|polyline)\b[^>]*?)\s+fill\s*=\s*["'][^"']*["']/gi, '$1');
    result = result.replace(/<(path|circle|rect|ellipse|polygon|polyline)\b/gi, '<$1 fill="none"');
  }
  result = result.replace(/<svg\b([^>]*?)>/i, (_m, attrs) => {
    let cleaned = attrs
      .replace(/\s+fill\s*=\s*["'][^"']*["']/gi, '')
      .replace(/\s+stroke\s*=\s*["'][^"']*["']/gi, '')
      .replace(/\s+stroke-width\s*=\s*["'][^"']*["']/gi, '');
    return `<svg${cleaned} fill="none" stroke="#000000" stroke-width="${strokeWidth}">`;
  });
  return result;
}

(async () => {
  const files = [
    ['public/assets/modal/Dance Floor/16ft by 16ft Dance Floor.svg', 0.012, true],
    ['public/assets/modal/Sitting_Styles/Boardroom.svg', 0.0005, true],
  ];
  for (const [rel, ratio, outline] of files) {
    const svgText = await fs.readFile(rel, 'utf8');
    const artboard = parseViewBox(svgText);
    const bbox = contentBBox(svgText);
    const useBBox = bbox && bbox.w > 1 && bbox.h > 1 && (bbox.w < artboard.w * 0.45 || bbox.h < artboard.h * 0.45);
    const vb = useBBox ? bbox : artboard;
    const strokeWidth = Math.max(0.5, Math.max(vb.w, vb.h) * ratio);
    const prepared = prepare(svgText, strokeWidth, vb, { outlineOnly: outline });
    console.log('====', path.basename(rel));
    console.log('artboard', artboard, 'bbox', bbox, 'useBBox', useBBox, 'vb', vb, 'stroke', strokeWidth);
    console.log('head:', prepared.slice(0, 400));
    console.log('path count', (prepared.match(/<path/g)||[]).length, 'fill=none count', (prepared.match(/fill="none"/g)||[]).length);
    console.log('root stroke-width present', /stroke-width="[\d.]+"/.test(prepared.slice(0, 500)));
    console.log();
  }
})();
