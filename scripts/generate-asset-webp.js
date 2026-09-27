const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, 'public');
const OUTPUT_ROOT = path.join(PUBLIC_DIR, 'assets', 'raster');
const MAX_SIDE = 2048;

// Stroke width proportional to the artboard size so it stays visible when the
// raster is displayed at scaled-down sizes (thumbnails, zoomed-out floor
// plans). A fixed 1-unit stroke in a ~2700-unit QCAD viewBox renders as a
// near-invisible hairline. 0.9% of the larger artboard side keeps strokes
// readable at typical display scales.
const WORKSPACE_STROKE_RATIO = 0.009;

// Dense outline line art (sitting styles, etc.) needs a visible but thin
// stroke at thumbnail size. 0.22% of the larger side keeps chairs readable
// as outlines without fattening into blobs.
const THIN_STROKE_RATIO = 0.0022;

// CAD sheet exports often park a small drawing in the middle of a large
// artboard. Rasters of those look tiny unless we crop to content first.
const CONTENT_CROP_FILL_RATIO = 0.45;

const INPUT_DIRS = [
  path.join(PUBLIC_DIR, 'assets', 'modal'),
  path.join(PUBLIC_DIR, 'Marquees'),
];

function parseViewBox(svgText) {
  const m = svgText.match(/viewBox=["']([^"']+)["']/i);
  if (!m) return null;
  const parts = m[1].trim().split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || !parts.every(Number.isFinite)) return null;
  return { x: parts[0], y: parts[1], w: Math.abs(parts[2]), h: Math.abs(parts[3]) };
}

function contentBBox(svgText) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const ds = [...svgText.matchAll(/\sd="([^"]+)"/gi)];
  for (const m of ds) {
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

function getStrokeRatio(relativePublicPath) {
  const normalized = relativePublicPath.replace(/\\/g, '/');
  if (normalized.includes('/Sitting_Styles/')) return THIN_STROKE_RATIO;
  return WORKSPACE_STROKE_RATIO;
}

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

  if (width && height) {
    return {
      width: Number(width),
      height: Number(height),
      // stroke-width is painted in viewBox user units, which can differ from
      // the width/height attributes (e.g. 4300mm physical size vs a ~200-unit
      // CAD viewBox). Always prefer viewBox for stroke calculations.
      viewBoxSize,
    };
  }

  if (viewBoxSize) {
    return { ...viewBoxSize, viewBoxSize };
  }

  return { width: MAX_SIDE, height: MAX_SIDE, viewBoxSize: null };
}

function prepareSvgForWorkspaceRaster(svgText, strokeWidth, cropBox) {
  let result = svgText;

  // Pre-mark fill-only paths (no fill attr, no stroke attr/style, no fill-rule).
  // These rely on SVG's default black fill; root fill="none" would hide them.
  result = result.replace(/<path\b[^>]*?>/gi, (tag) => {
    const hasFill = /\sfill\s*=/i.test(tag);
    const hasStroke = /\sstroke\s*=/i.test(tag);
    const hasFR = /\bfill-rule\s*=/i.test(tag);
    if (hasFill || hasStroke || hasFR) return tag;
    const style = tag.match(/style\s*=\s*"([^"]*)"/i)?.[1] || '';
    if (/stroke\s*:/i.test(style) || /fill-rule\s*:/i.test(style)) return tag;
    return tag.replace(/<path\b/i, '<path fill="#000000"');
  });

  // 1. Expand viewBox by 5% so outer stroke width along asset edges is never clipped.
  //    When cropBox is set (content-cropped CAD sheet), replace viewBox entirely.
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

  // 2. From inline styles, strip stroke, stroke-width, and fill.
  //    librsvg ignores CSS !important when an inline style is present, so we
  //    must remove the conflicting properties directly.
  //    Keep fill-rule so filled-contour outlines (evenodd holes) stay correct.
  result = result.replace(/style\s*=\s*"([^"]*)"/gi, (_match, styleContent) => {
    let cleaned = styleContent
      .replace(/stroke-width\s*:[^;]+;?/gi, "")
      .replace(/(?<![a-z-])stroke\s*:[^;]+;?/gi, "")
      .replace(/(?<![-a-z])fill\s*:[^;]+;?/gi, "");
    return cleaned.trim() ? `style="${cleaned.trim()}"` : '';
  });

  // 3. Strip individual stroke-width, stroke, and fill attributes from child elements,
  //    except paths/groups that rely on fill-rule (filled contour outlines).
  result = result.replace(/(<(?:path|circle|rect|line|polyline|ellipse|polygon|g)\b[^>]*?)\s+stroke-width\s*=\s*["'][^"']*["']/gi, '$1');
  result = result.replace(/(<(?:path|circle|rect|line|polyline|ellipse|polygon|g)\b[^>]*?)\s+stroke\s*=\s*["'][^"']*["']/gi, '$1');
  // Preserve fill on evenodd paths and on groups with any fill-rule (e.g. nonzero
  // contour groups whose children have no fill of their own).
  result = result.replace(/(<path\b[^>]*?\bfill-rule\s*=\s*["']evenodd["'][^>]*?)\s+fill\s*=\s*["']([^"']*)["']/gi, '$1 fill="$2"');
  result = result.replace(/(<g\b[^>]*?\bfill-rule\s*=\s*["'][^"']+["'][^>]*?)\s+fill\s*=\s*["']([^"']*)["']/gi, '$1 fill="$2"');
  result = result.replace(/(<(?:circle|rect|line|polyline|ellipse|polygon)\b[^>]*?)\s+fill\s*=\s*["'][^"']*["']/gi, '$1');
  result = result.replace(/(<g\b(?![^>]*\bfill-rule\b)[^>]*?)\s+fill\s*=\s*["'][^"']*["']/gi, '$1');
  result = result.replace(/(<path\b(?![^>]*\bfill-rule\b)[^>]*?)\s+fill\s*=\s*["'][^"']*["']/gi, '$1');

  // Paths/groups with fill-rule keep their fill but get a REDUCED stroke.
  // They already paint a visible contour band via fill; full root stroke on top
  // doubles line weight (L-shaped sofas hit ~35% opacity vs ~10% for plain
  // stroke outlines). 0.35× keeps the band readable without looking bolder
  // than stroke-only assets.
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

  // 4. Set fill=none + stroke + stroke-width on the root <svg> so it cascades to all children.
  //    When cropBox is set, also override width/height to match the padded viewBox so
  //    sharp/librsvg rasterize at the cropped aspect instead of the original artboard size.
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
    return `<svg${cleaned} fill="none" stroke="#000000" stroke-width="${strokeWidth}">`;
  });

  return result;
}

async function walkSvgFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walkSvgFiles(fullPath));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.svg')) {
      files.push(fullPath);
    }
  }

  return files;
}

async function convertSvg(svgPath) {
  const relativePublicPath = path.relative(PUBLIC_DIR, svgPath);
  const outputPath = path.join(
    OUTPUT_ROOT,
    relativePublicPath.replace(/\.svg$/i, '.webp')
  );

  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const svgText = await fs.readFile(svgPath, 'utf8');
  const artboard = parseViewBox(svgText);
  const size = readSvgSize(svgText);
  const bbox = contentBBox(svgText);

  // Crop CAD-sheet style exports where content is a small island in the artboard
  // (dance floors, etc.) so thumbnails fill the card instead of a tiny center mark.
  const useCrop =
    !!artboard &&
    !!bbox &&
    bbox.w > 1 &&
    bbox.h > 1 &&
    (bbox.w < artboard.w * CONTENT_CROP_FILL_RATIO ||
      bbox.h < artboard.h * CONTENT_CROP_FILL_RATIO);
  const cropBox = useCrop ? bbox : null;
  const renderBox = cropBox || artboard || { x: 0, y: 0, w: size.width, h: size.height };

  const ratio = getStrokeRatio(relativePublicPath.replace(/\\/g, '/'));
  const strokeWidth = Math.max(0.5, Math.max(renderBox.w, renderBox.h) * ratio);
  const rasterSvgText = prepareSvgForWorkspaceRaster(svgText, strokeWidth, cropBox);

  // Always rasterize at MAX_SIDE on the long edge (aspect-preserving) so
  // content-cropped CAD sheets (tiny viewBox units) still produce usable
  // thumbnail resolution instead of a ~70px image.
  const aspect = renderBox.w / renderBox.h;
  const outW = aspect >= 1 ? MAX_SIDE : Math.max(1, Math.round(MAX_SIDE * aspect));
  const outH = aspect >= 1 ? Math.max(1, Math.round(MAX_SIDE / aspect)) : MAX_SIDE;
  await sharp(Buffer.from(rasterSvgText), { density: 300, limitInputPixels: false })
    .resize({
      width: outW,
      height: outH,
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({
      lossless: true,
      effort: 4,
    })
    .toFile(outputPath);

  return outputPath;
}

async function main() {
  const inputFiles = [];

  for (const dir of INPUT_DIRS) {
    try {
      inputFiles.push(...await walkSvgFiles(dir));
    } catch {
      // Some projects may not include every asset directory.
    }
  }

  let converted = 0;
  for (const svgPath of inputFiles) {
    try {
      await convertSvg(svgPath);
      converted += 1;
    } catch (err) {
      console.error(`Skipped ${path.basename(svgPath)}:`, err.message);
    }
  }

  console.log(`Generated ${converted} WebP asset rasters in ${path.relative(ROOT, OUTPUT_ROOT)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
