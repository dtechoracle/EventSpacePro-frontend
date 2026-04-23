const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, 'public');
const OUTPUT_ROOT = path.join(PUBLIC_DIR, 'assets', 'raster');
const MAX_SIDE = 2048;
const WORKSPACE_DEFAULT_STROKE_WIDTH = 1;

const INPUT_DIRS = [
  path.join(PUBLIC_DIR, 'assets', 'modal'),
  path.join(PUBLIC_DIR, 'Marquees'),
];

function readSvgSize(svgText) {
  const svgTag = svgText.match(/<svg\b[^>]*>/i)?.[0] || '';
  const width = svgTag.match(/\bwidth=["']([\d.]+)[a-z%]*["']/i)?.[1];
  const height = svgTag.match(/\bheight=["']([\d.]+)[a-z%]*["']/i)?.[1];
  const viewBox = svgTag.match(/\bviewBox=["']([^"']+)["']/i)?.[1];

  if (width && height) {
    return { width: Number(width), height: Number(height) };
  }

  if (viewBox) {
    const parts = viewBox.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every(Number.isFinite)) {
      return { width: Math.abs(parts[2]), height: Math.abs(parts[3]) };
    }
  }

  return { width: MAX_SIDE, height: MAX_SIDE };
}

function prepareSvgForWorkspaceRaster(svgText) {
  const style = `
    <style id="esp-workspace-raster-style">
      * {
        stroke: #000000 !important;
        stroke-width: ${WORKSPACE_DEFAULT_STROKE_WIDTH} !important;
        stroke-opacity: 1 !important;
        vector-effect: non-scaling-stroke;
        filter: none !important;
      }
      path, line, polyline, polygon, circle, ellipse, rect {
        fill: none !important;
        fill-opacity: 0 !important;
      }
      text, tspan {
        fill: #000000 !important;
        fill-opacity: 1 !important;
        stroke: none !important;
      }
    </style>
  `;

  return svgText.replace(/<svg\b([^>]*)>/i, (match) => `${match}${style}`);
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
  const rasterSvgText = prepareSvgForWorkspaceRaster(svgText);
  const { width, height } = readSvgSize(svgText);
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));

  await sharp(Buffer.from(rasterSvgText), { density: 144, limitInputPixels: false })
    .resize({
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale)),
      fit: 'inside',
      withoutEnlargement: true,
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
    await convertSvg(svgPath);
    converted += 1;
  }

  console.log(`Generated ${converted} WebP asset rasters in ${path.relative(ROOT, OUTPUT_ROOT)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
