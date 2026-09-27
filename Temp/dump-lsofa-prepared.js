const fs = require('fs');
const path = require('path');

// Copy of prepare from generate-asset-webp.js for debugging
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

const svg = fs.readFileSync('public/assets/modal/Furniture/6 Seater L Shaped Sofa.svg', 'utf8');
const strokeWidth = 5.76;
const prepared = prepareSvgForWorkspaceRaster(svg, strokeWidth, null);
console.log('=== PATH TAG ===');
const pathTag = prepared.match(/<path[^>]+>/)[0];
console.log(pathTag.slice(0, 500));
console.log('...');
console.log('=== SVG TAG ===');
console.log(prepared.match(/<svg[^>]+>/)[0]);
console.log('=== has path stroke-width', /<path[^>]*stroke-width/.test(prepared));
console.log('=== frStroke expected', strokeWidth * 0.28);
fs.writeFileSync('Temp/lsofa-prepared.svg', prepared);
