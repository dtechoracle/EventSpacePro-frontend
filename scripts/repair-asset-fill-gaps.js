const fs = require('fs/promises');
const path = require('path');

const ROOT = process.cwd();
const DEFAULT_DIR = path.join(ROOT, 'public', 'assets', 'modal', 'Furniture');
const REPORT_DEFAULT = path.join(ROOT, 'scripts', 'asset-fill-gap-report.json');

function parseArgs(argv) {
  const args = {
    write: false,
    dir: DEFAULT_DIR,
    match: '',
    report: '',
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--write') {
      args.write = true;
    } else if (arg === '--dir') {
      args.dir = path.resolve(ROOT, argv[i + 1] || DEFAULT_DIR);
      i += 1;
    } else if (arg === '--match') {
      args.match = (argv[i + 1] || '').toLowerCase();
      i += 1;
    } else if (arg === '--report') {
      args.report = path.resolve(ROOT, argv[i + 1] || REPORT_DEFAULT);
      i += 1;
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    }
  }

  return args;
}

function printHelp() {
  console.log(`
Usage:
  node scripts/repair-asset-fill-gaps.js [--write] [--dir <path>] [--match <text>] [--report <file>]

What it does:
  - audits SVG asset files for missing fill targets / missing outer stroke copies
  - auto-repairs safe cases by duplicating closed shapes as auto-fill targets
  - restores a stroke-only outline when a fill target exists without a matching outline
  - reports ambiguous files that still likely need manual review

Examples:
  node scripts/repair-asset-fill-gaps.js
  node scripts/repair-asset-fill-gaps.js --write
  node scripts/repair-asset-fill-gaps.js --match "office chair"
  node scripts/repair-asset-fill-gaps.js --write --report scripts/asset-fill-gap-report.json
`);
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

function parseSvgBounds(svgText) {
  const svgTag = svgText.match(/<svg\b[^>]*>/i)?.[0] || '';
  const width = svgTag.match(/\bwidth=["']([\d.]+)[a-z%]*["']/i)?.[1];
  const height = svgTag.match(/\bheight=["']([\d.]+)[a-z%]*["']/i)?.[1];
  const viewBox = svgTag.match(/\bviewBox=["']([^"']+)["']/i)?.[1];

  let svgWidth = width ? Number(width) : 0;
  let svgHeight = height ? Number(height) : 0;
  let minX = 0;
  let minY = 0;

  if (viewBox) {
    const parts = viewBox.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every(Number.isFinite)) {
      minX = parts[0];
      minY = parts[1];
      svgWidth = Math.abs(parts[2]) || svgWidth;
      svgHeight = Math.abs(parts[3]) || svgHeight;
    }
  }

  if (!svgWidth || !svgHeight) {
    svgWidth = 2048;
    svgHeight = 2048;
  }

  return {
    minX,
    minY,
    width: svgWidth,
    height: svgHeight,
    area: svgWidth * svgHeight,
    maxSide: Math.max(svgWidth, svgHeight),
  };
}

function parseAttributes(tagText) {
  const attrs = {};
  const re = /([:@a-zA-Z_][\w:.-]*)\s*=\s*(["'])([\s\S]*?)\2/g;
  let match;
  while ((match = re.exec(tagText))) {
    attrs[match[1]] = match[3];
  }
  return attrs;
}

function parseStyle(styleText) {
  const style = {};
  if (!styleText) return style;

  styleText.split(';').forEach((chunk) => {
    const [rawKey, rawValue] = chunk.split(':');
    if (!rawKey || !rawValue) return;
    style[rawKey.trim().toLowerCase()] = rawValue.trim();
  });

  return style;
}

function escapeAttr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function hasAutoFillMarker(attrs) {
  return (
    attrs.id === 'auto-fill' ||
    attrs['data-auto-fill'] === 'true' ||
    (attrs.class || '').split(/\s+/).includes('auto-fill')
  );
}

function isStrokeNone(attrs, style) {
  const stroke = (attrs.stroke || style.stroke || '').toLowerCase();
  return stroke === 'none';
}

function isFillNone(attrs, style) {
  const fill = (attrs.fill || style.fill || '').toLowerCase();
  return fill === 'none';
}

function isExplicitFillTarget(attrs, style) {
  if (hasAutoFillMarker(attrs)) return true;
  const fill = (attrs.fill || style.fill || '').toLowerCase();
  if (fill !== 'inherit') return false;
  const stroke = (attrs.stroke || style.stroke || '').toLowerCase();
  return !stroke || stroke === 'none';
}

function tokenizePathData(d) {
  return d.match(/[AaCcHhLlMmQqSsTtVvZz]|[-+]?(?:\d+\.\d+|\d+|\.\d+)(?:e[-+]?\d+)?/g) || [];
}

function parsePathBounds(d) {
  const tokens = tokenizePathData(d);
  if (!tokens.length) return null;

  let i = 0;
  let cmd = '';
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let closed = false;

  function addPoint(px, py) {
    if (!Number.isFinite(px) || !Number.isFinite(py)) return;
    minX = Math.min(minX, px);
    maxX = Math.max(maxX, px);
    minY = Math.min(minY, py);
    maxY = Math.max(maxY, py);
  }

  function nextNumber() {
    const token = tokens[i];
    if (token == null || /^[A-Za-z]$/.test(token)) return null;
    i += 1;
    return Number(token);
  }

  while (i < tokens.length) {
    if (/^[A-Za-z]$/.test(tokens[i])) {
      cmd = tokens[i];
      i += 1;
    } else if (!cmd) {
      break;
    }

    switch (cmd) {
      case 'M':
      case 'm': {
        let first = true;
        while (true) {
          const nx = nextNumber();
          const ny = nextNumber();
          if (nx == null || ny == null) break;
          x = cmd === 'm' ? x + nx : nx;
          y = cmd === 'm' ? y + ny : ny;
          addPoint(x, y);
          if (first) {
            startX = x;
            startY = y;
            first = false;
          }
          cmd = cmd === 'm' ? 'l' : 'L';
        }
        break;
      }
      case 'L':
      case 'l': {
        while (true) {
          const nx = nextNumber();
          const ny = nextNumber();
          if (nx == null || ny == null) break;
          x = cmd === 'l' ? x + nx : nx;
          y = cmd === 'l' ? y + ny : ny;
          addPoint(x, y);
        }
        break;
      }
      case 'H':
      case 'h': {
        while (true) {
          const nx = nextNumber();
          if (nx == null) break;
          x = cmd === 'h' ? x + nx : nx;
          addPoint(x, y);
        }
        break;
      }
      case 'V':
      case 'v': {
        while (true) {
          const ny = nextNumber();
          if (ny == null) break;
          y = cmd === 'v' ? y + ny : ny;
          addPoint(x, y);
        }
        break;
      }
      case 'C':
      case 'c': {
        while (true) {
          const vals = [];
          for (let j = 0; j < 6; j += 1) {
            const n = nextNumber();
            if (n == null) break;
            vals.push(n);
          }
          if (vals.length < 6) break;
          const points = cmd === 'c'
            ? [
                [x + vals[0], y + vals[1]],
                [x + vals[2], y + vals[3]],
                [x + vals[4], y + vals[5]],
              ]
            : [
                [vals[0], vals[1]],
                [vals[2], vals[3]],
                [vals[4], vals[5]],
              ];
          points.forEach(([px, py]) => addPoint(px, py));
          [x, y] = points[2];
        }
        break;
      }
      case 'S':
      case 's':
      case 'Q':
      case 'q': {
        const step = cmd.toLowerCase() === 's' ? 4 : 4;
        while (true) {
          const vals = [];
          for (let j = 0; j < step; j += 1) {
            const n = nextNumber();
            if (n == null) break;
            vals.push(n);
          }
          if (vals.length < step) break;
          const points = cmd === cmd.toLowerCase()
            ? [
                [x + vals[0], y + vals[1]],
                [x + vals[2], y + vals[3]],
              ]
            : [
                [vals[0], vals[1]],
                [vals[2], vals[3]],
              ];
          points.forEach(([px, py]) => addPoint(px, py));
          [x, y] = points[1];
        }
        break;
      }
      case 'T':
      case 't': {
        while (true) {
          const nx = nextNumber();
          const ny = nextNumber();
          if (nx == null || ny == null) break;
          x = cmd === 't' ? x + nx : nx;
          y = cmd === 't' ? y + ny : ny;
          addPoint(x, y);
        }
        break;
      }
      case 'A':
      case 'a': {
        while (true) {
          const vals = [];
          for (let j = 0; j < 7; j += 1) {
            const n = nextNumber();
            if (n == null) break;
            vals.push(n);
          }
          if (vals.length < 7) break;
          const endX = cmd === 'a' ? x + vals[5] : vals[5];
          const endY = cmd === 'a' ? y + vals[6] : vals[6];
          addPoint(endX, endY);
          x = endX;
          y = endY;
        }
        break;
      }
      case 'Z':
      case 'z': {
        closed = true;
        x = startX;
        y = startY;
        addPoint(x, y);
        break;
      }
      default:
        break;
    }
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
    area: Math.max(0, maxX - minX) * Math.max(0, maxY - minY),
    closed,
  };
}

function parsePointsBounds(pointsText) {
  if (!pointsText) return null;
  const nums = pointsText.trim().split(/[\s,]+/).map(Number).filter(Number.isFinite);
  if (nums.length < 4) return null;
  const points = [];
  for (let i = 0; i < nums.length - 1; i += 2) {
    points.push([nums[i], nums[i + 1]]);
  }
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
    area: (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys)),
    closed: true,
  };
}

function parseShapeBounds(tagName, attrs) {
  switch (tagName) {
    case 'circle': {
      const cx = Number(attrs.cx);
      const cy = Number(attrs.cy);
      const r = Number(attrs.r);
      if (![cx, cy, r].every(Number.isFinite)) return null;
      return {
        minX: cx - r,
        minY: cy - r,
        maxX: cx + r,
        maxY: cy + r,
        width: r * 2,
        height: r * 2,
        area: Math.PI * r * r,
        closed: true,
      };
    }
    case 'ellipse': {
      const cx = Number(attrs.cx);
      const cy = Number(attrs.cy);
      const rx = Number(attrs.rx);
      const ry = Number(attrs.ry);
      if (![cx, cy, rx, ry].every(Number.isFinite)) return null;
      return {
        minX: cx - rx,
        minY: cy - ry,
        maxX: cx + rx,
        maxY: cy + ry,
        width: rx * 2,
        height: ry * 2,
        area: Math.PI * rx * ry,
        closed: true,
      };
    }
    case 'rect': {
      const x = Number(attrs.x || 0);
      const y = Number(attrs.y || 0);
      const width = Number(attrs.width);
      const height = Number(attrs.height);
      if (![x, y, width, height].every(Number.isFinite)) return null;
      return {
        minX: x,
        minY: y,
        maxX: x + width,
        maxY: y + height,
        width,
        height,
        area: width * height,
        closed: true,
      };
    }
    case 'polygon':
      return parsePointsBounds(attrs.points);
    case 'path':
      return parsePathBounds(attrs.d || '');
    default:
      return null;
  }
}

function normalizeTransform(value) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function normalizePathData(value) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function shapeKey(tagName, attrs) {
  const transform = normalizeTransform(attrs.transform);
  if (tagName === 'path') {
    return `path|${normalizePathData(attrs.d)}|${transform}`;
  }
  if (tagName === 'circle') {
    return `circle|${attrs.cx || ''}|${attrs.cy || ''}|${attrs.r || ''}|${transform}`;
  }
  if (tagName === 'ellipse') {
    return `ellipse|${attrs.cx || ''}|${attrs.cy || ''}|${attrs.rx || ''}|${attrs.ry || ''}|${transform}`;
  }
  if (tagName === 'rect') {
    return `rect|${attrs.x || ''}|${attrs.y || ''}|${attrs.width || ''}|${attrs.height || ''}|${attrs.rx || ''}|${attrs.ry || ''}|${transform}`;
  }
  if (tagName === 'polygon') {
    return `polygon|${(attrs.points || '').replace(/\s+/g, ' ').trim()}|${transform}`;
  }
  return `${tagName}|${transform}`;
}

function getIndentation(source, index) {
  const lineStart = source.lastIndexOf('\n', index - 1);
  const slice = source.slice(lineStart + 1, index);
  return slice.match(/^\s*/)?.[0] || '';
}

function extractShapes(svgText, svgBounds) {
  const shapes = [];
  const tagRe = /<(path|circle|ellipse|rect|polygon)\b[\s\S]*?\/>/gi;
  let match;
  let order = 0;

  while ((match = tagRe.exec(svgText))) {
    const [tagText, tagName] = match;
    const attrs = parseAttributes(tagText);
    const style = parseStyle(attrs.style || '');
    const bounds = parseShapeBounds(tagName.toLowerCase(), attrs);
    const key = shapeKey(tagName.toLowerCase(), attrs);

    shapes.push({
      order: order += 1,
      tagName: tagName.toLowerCase(),
      tagText,
      attrs,
      style,
      bounds,
      key,
      start: match.index,
      end: match.index + tagText.length,
      indentation: getIndentation(svgText, match.index),
      explicitFillTarget: isExplicitFillTarget(attrs, style),
      generatedFill: attrs['data-auto-fill'] === 'true',
      generatedStroke: attrs['data-generated-stroke'] === 'true',
      strokeNone: isStrokeNone(attrs, style),
      fillNone: isFillNone(attrs, style),
      substantial: isSubstantial(bounds, svgBounds),
      mediumFeature: isMediumFeature(bounds, svgBounds),
    });
  }

  return shapes;
}

function isSubstantial(bounds, svgBounds) {
  if (!bounds) return false;
  const widthRatio = bounds.width / svgBounds.maxSide;
  const heightRatio = bounds.height / svgBounds.maxSide;
  const areaRatio = bounds.area / svgBounds.area;
  return Math.max(widthRatio, heightRatio) >= 0.03 || areaRatio >= 0.0012;
}

function isMediumFeature(bounds, svgBounds) {
  if (!bounds) return false;
  const widthRatio = bounds.width / svgBounds.maxSide;
  const heightRatio = bounds.height / svgBounds.maxSide;
  const areaRatio = bounds.area / svgBounds.area;
  return Math.max(widthRatio, heightRatio) >= 0.018 || areaRatio >= 0.0004;
}

function isLikelyOpenGap(shape, svgBounds) {
  if (!shape.bounds || shape.strokeNone) return false;
  const widthRatio = shape.bounds.width / svgBounds.maxSide;
  const heightRatio = shape.bounds.height / svgBounds.maxSide;
  const areaRatio = shape.bounds.area / svgBounds.area;
  return (
    Math.max(widthRatio, heightRatio) >= 0.035 &&
    (Math.min(widthRatio, heightRatio) >= 0.008 || areaRatio >= 0.00025)
  );
}

function buildAutoFillTag(shape) {
  const attrs = { ...shape.attrs };
  delete attrs.id;
  delete attrs.class;
  delete attrs.fill;
  delete attrs.stroke;
  delete attrs['stroke-width'];
  delete attrs['data-generated-stroke'];
  delete attrs['data-auto-fill'];

  attrs['data-auto-fill'] = 'true';
  attrs.fill = 'inherit';
  attrs.stroke = 'none';

  if (attrs.style) {
    const style = parseStyle(attrs.style);
    delete style.fill;
    delete style.stroke;
    delete style['stroke-width'];
    const nextStyle = Object.entries(style).map(([k, v]) => `${k}:${v}`).join(';');
    if (nextStyle) attrs.style = nextStyle;
    else delete attrs.style;
  }

  const attrText = Object.entries(attrs)
    .map(([key, value]) => `${key}="${escapeAttr(value)}"`)
    .join(' ');

  return `<${shape.tagName} ${attrText}/>`;
}

function buildStrokeCopyTag(shape) {
  const attrs = { ...shape.attrs };
  delete attrs.id;
  delete attrs.class;
  delete attrs['data-auto-fill'];
  delete attrs['data-generated-stroke'];

  attrs['data-generated-stroke'] = 'true';
  attrs.fill = 'none';

  if (attrs.style) {
    const style = parseStyle(attrs.style);
    delete style.fill;
    const nextStyle = Object.entries(style).map(([k, v]) => `${k}:${v}`).join(';');
    if (nextStyle) attrs.style = nextStyle;
    else delete attrs.style;
  }

  const attrText = Object.entries(attrs)
    .map(([key, value]) => `${key}="${escapeAttr(value)}"`)
    .join(' ');

  return `<${shape.tagName} ${attrText}/>`;
}

function applyOperations(source, operations) {
  const sorted = [...operations].sort((a, b) => b.index - a.index);
  let output = source;
  for (const op of sorted) {
    output = output.slice(0, op.index) + op.insert + output.slice(op.index);
  }
  return output;
}

function analyzeAndRepair(svgText, filePath) {
  const svgBounds = parseSvgBounds(svgText);
  const shapes = extractShapes(svgText, svgBounds);
  const fillKeys = new Set(
    shapes
      .filter((shape) => shape.explicitFillTarget)
      .map((shape) => shape.key)
  );
  const strokeKeys = new Set(
    shapes
      .filter((shape) => !shape.explicitFillTarget && !shape.strokeNone)
      .map((shape) => shape.key)
  );

  const hasExplicitTargets = shapes.some((shape) => shape.explicitFillTarget);
  const operations = [];
  const report = {
    file: path.relative(ROOT, filePath),
    autoFillTargets: shapes.filter((shape) => shape.explicitFillTarget).length,
    insertedFillTargets: 0,
    insertedStrokeCopies: 0,
    ambiguousClosedShapes: 0,
    likelyOpenGapShapes: 0,
    manualGeometryRequired: false,
    repaired: false,
  };

  for (const shape of shapes) {
    if (!shape.explicitFillTarget || !shape.bounds || !shape.mediumFeature) continue;
    if (strokeKeys.has(shape.key) || shape.generatedStroke) continue;

    operations.push({
      index: shape.end,
      insert: `\n${shape.indentation}${buildStrokeCopyTag(shape)}`,
    });
    strokeKeys.add(shape.key);
    report.insertedStrokeCopies += 1;
  }

  for (const shape of shapes) {
    if (shape.explicitFillTarget || !shape.bounds) continue;

    const isClosed = !!shape.bounds.closed;
    if (!isClosed && isLikelyOpenGap(shape, svgBounds)) {
      report.likelyOpenGapShapes += 1;
      continue;
    }

    if (!isClosed) continue;

    const safeToAutoFill = hasExplicitTargets
      ? ['circle', 'ellipse', 'rect', 'polygon'].includes(shape.tagName) && shape.mediumFeature
      : shape.substantial;
    if (!safeToAutoFill) continue;
    if (fillKeys.has(shape.key)) continue;

    operations.push({
      index: shape.start,
      insert: `${shape.indentation}${buildAutoFillTag(shape)}\n`,
    });
    fillKeys.add(shape.key);
    report.insertedFillTargets += 1;
  }

  report.ambiguousClosedShapes = shapes.filter(
    (shape) =>
      !shape.explicitFillTarget &&
      !shape.strokeNone &&
      shape.bounds &&
      shape.bounds.closed &&
      !shape.substantial &&
      !shape.mediumFeature
  ).length;

  report.repaired = report.insertedFillTargets > 0 || report.insertedStrokeCopies > 0;
  report.manualGeometryRequired =
    !report.repaired &&
    report.likelyOpenGapShapes > 0 &&
    report.autoFillTargets === 0;

  return {
    report,
    nextSvg: operations.length ? applyOperations(svgText, operations) : svgText,
  };
}

async function maybeWriteReport(reportPath, data) {
  if (!reportPath) return;
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(data, null, 2));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const allFiles = await walkSvgFiles(args.dir);
  const files = args.match
    ? allFiles.filter((file) => file.toLowerCase().includes(args.match))
    : allFiles;

  const reports = [];
  let written = 0;

  for (const filePath of files) {
    const svgText = await fs.readFile(filePath, 'utf8');
    const { report, nextSvg } = analyzeAndRepair(svgText, filePath);
    reports.push(report);

    if (args.write && report.repaired && nextSvg !== svgText) {
      await fs.writeFile(filePath, nextSvg, 'utf8');
      written += 1;
    }
  }

  const summary = {
    scannedFiles: files.length,
    repairedFiles: reports.filter((report) => report.repaired).length,
    writtenFiles: written,
    fillTargetsInserted: reports.reduce((sum, report) => sum + report.insertedFillTargets, 0),
    strokeCopiesInserted: reports.reduce((sum, report) => sum + report.insertedStrokeCopies, 0),
    likelyOpenGapShapes: reports.reduce((sum, report) => sum + report.likelyOpenGapShapes, 0),
    ambiguousClosedShapes: reports.reduce((sum, report) => sum + report.ambiguousClosedShapes, 0),
  };

  const payload = {
    generatedAt: new Date().toISOString(),
    mode: args.write ? 'write' : 'dry-run',
    dir: path.relative(ROOT, args.dir),
    match: args.match,
    summary,
    files: reports.filter(
      (report) =>
        report.repaired ||
        report.likelyOpenGapShapes > 0 ||
        report.ambiguousClosedShapes > 0
    ),
  };

  if (args.report) {
    await maybeWriteReport(args.report, payload);
  }

  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
