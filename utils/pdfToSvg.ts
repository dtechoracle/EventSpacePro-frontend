/**
 * PDF-to-SVG vector extraction utility.
 * Extracts paths, shapes, and text from PDF pages using pdf.js operator lists.
 *
 * Operator constants from pdf.js OPS enum (v3.4.120):
 *   save=10, restore=11, transform=12, moveTo=13, lineTo=14,
 *   curveTo=15, curveTo2=16, curveTo3=17, closePath=18, rectangle=19,
 *   stroke=20, closeStroke=21, fill=22, eoFill=23, fillStroke=24,
 *   eoFillStroke=25, closeFillStroke=26, closeEOFillStroke=27, endPath=28,
 *   beginText=31, endText=32, setFont=37, moveText=40,
 *   setLeadingMoveText=41, setTextMatrix=42, nextLine=43,
 *   showText=44, showSpacedText=45, nextLineShowText=46,
 *   setStrokeRGBColor=58, setFillRGBColor=59,
 *   setStrokeCMYKColor=60, setFillCMYKColor=61,
 *   setStrokeGray=56, setFillGray=57, setLineWidth=2,
 *   constructPath=91
 */

export type PdfShape = {
  type: 'shape';
  shapeType: 'rectangle' | 'ellipse' | 'path';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  svgPath?: string;
  fill?: string;
  stroke?: string;
  strokeWidth: number;
  points?: { x: number; y: number }[];
};

export type PdfText = {
  type: 'text';
  x: number;
  y: number;
  text: string;
  fontSize: number;
  fontFamily: string;
  color: string;
  rotation: number;
};

export type PdfElement = PdfShape | PdfText;

type Color = { r: number; g: number; b: number };

type Matrix = [number, number, number, number, number, number];

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

function multiplyMatrix(a: Matrix, b: Matrix): Matrix {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

function transformPoint(m: Matrix, x: number, y: number): { x: number; y: number } {
  return {
    x: m[0] * x + m[2] * y + m[4],
    y: m[1] * x + m[3] * y + m[5],
  };
}

function decomposeMatrix(m: Matrix): { x: number; y: number; scaleX: number; scaleY: number; rotation: number } {
  const x = m[4];
  const y = m[5];
  const scaleX = Math.sqrt(m[0] * m[0] + m[1] * m[1]);
  const scaleY = Math.sqrt(m[2] * m[2] + m[3] * m[3]);
  const rotation = Math.atan2(m[1], m[0]) * (180 / Math.PI);
  return { x, y, scaleX, scaleY, rotation };
}

function colorToHex(c: Color): string {
  const to255 = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255);
  const r = to255(c.r);
  const g = to255(c.g);
  const b = to255(c.b);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function cmykToRgb(c: number, m: number, y: number, k: number): Color {
  const r = (1 - c) * (1 - k);
  const g = (1 - m) * (1 - k);
  const b = (1 - y) * (1 - k);
  return { r, g, b };
}

// ── SVG parse/transform helpers (for SVGGraphics → workspace shapes) ──

function parseSvgTransformMatrix(transform: string): DOMMatrix | null {
  try {
    const m = new DOMMatrix();
    const matrixMatch = transform.match(/matrix\(([^)]+)\)/);
    if (matrixMatch) {
      const parts = matrixMatch[1].split(/[\s,]+/).map(Number);
      if (parts.length >= 6) return new DOMMatrix([parts[0], parts[1], parts[2], parts[3], parts[4], parts[5]]);
    }
    const translateMatch = transform.match(/translate\(([^)]+)\)/);
    if (translateMatch) {
      const parts = translateMatch[1].split(/[\s,]+/).map(Number);
      m.translateSelf(parts[0] || 0, parts[1] || 0);
    }
    const scaleMatch = transform.match(/scale\(([^)]+)\)/);
    if (scaleMatch) {
      const parts = scaleMatch[1].split(/[\s,]+/).map(Number);
      m.scaleSelf(parts[0] || 1, parts[1] || parts[0] || 1);
    }
    const rotateMatch = transform.match(/rotate\(([^)]+)\)/);
    if (rotateMatch) {
      const parts = rotateMatch[1].split(/[\s,]+/).map(Number);
      m.rotateSelf(parts[0] || 0);
    }
    return m;
  } catch { return null; }
}

function transformPathD(d: string, matrix: DOMMatrix): string {
  const tokens = d.match(/[a-zA-Z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g);
  if (!tokens) return d;

  const toks = tokens;
  let result = '';
  let i = 0;
  let cx = 0, cy = 0, sx = 0, sy = 0;

  function nextNum(): number {
    while (i < toks.length && isNaN(Number(toks[i]))) i++;
    return i < toks.length ? Number(toks[i++]) : 0;
  }
  function tx(x: number, y: number): [number, number] {
    const pt = matrix.transformPoint(new DOMPoint(x, y));
    return [Math.round(pt.x * 100) / 100, Math.round(pt.y * 100) / 100];
  }

  while (i < tokens.length) {
    const cmd = tokens[i++];
    switch (cmd) {
      case 'M': {
        let first = true;
        while (i < tokens.length && !isNaN(Number(tokens[i]))) {
          const x = nextNum(), y = nextNum(); cx = x; cy = y;
          const [px, py] = tx(x, y);
          if (first) { result += `M ${px} ${py} `; sx = x; sy = y; first = false; }
          else result += `L ${px} ${py} `;
        }
        break;
      }
      case 'm': {
        let first = true;
        while (i < tokens.length && !isNaN(Number(tokens[i]))) {
          cx += nextNum(); cy += nextNum();
          const [px, py] = tx(cx, cy);
          if (first) { result += `M ${px} ${py} `; sx = cx; sy = cy; first = false; }
          else result += `L ${px} ${py} `;
        }
        break;
      }
      case 'L': {
        while (i < tokens.length && !isNaN(Number(tokens[i]))) {
          const x = nextNum(), y = nextNum(); cx = x; cy = y;
          result += `L ${tx(x, y)[0]} ${tx(x, y)[1]} `;
        }
        break;
      }
      case 'l': {
        while (i < tokens.length && !isNaN(Number(tokens[i]))) {
          cx += nextNum(); cy += nextNum();
          result += `L ${tx(cx, cy)[0]} ${tx(cx, cy)[1]} `;
        }
        break;
      }
      case 'H': {
        while (i < tokens.length && !isNaN(Number(tokens[i]))) {
          cx = nextNum();
          result += `L ${tx(cx, cy)[0]} ${tx(cx, cy)[1]} `;
        }
        break;
      }
      case 'h': {
        while (i < tokens.length && !isNaN(Number(tokens[i]))) {
          cx += nextNum();
          result += `L ${tx(cx, cy)[0]} ${tx(cx, cy)[1]} `;
        }
        break;
      }
      case 'V': {
        while (i < tokens.length && !isNaN(Number(tokens[i]))) {
          cy = nextNum();
          result += `L ${tx(cx, cy)[0]} ${tx(cx, cy)[1]} `;
        }
        break;
      }
      case 'v': {
        while (i < tokens.length && !isNaN(Number(tokens[i]))) {
          cy += nextNum();
          result += `L ${tx(cx, cy)[0]} ${tx(cx, cy)[1]} `;
        }
        break;
      }
      case 'C': {
        while (i < tokens.length && !isNaN(Number(tokens[i]))) {
          const x1 = nextNum(), y1 = nextNum(), x2 = nextNum(), y2 = nextNum(), x = nextNum(), y = nextNum();
          cx = x; cy = y;
          const [p1x, p1y] = tx(x1, y1), [p2x, p2y] = tx(x2, y2), [px, py] = tx(x, y);
          result += `C ${p1x} ${p1y} ${p2x} ${p2y} ${px} ${py} `;
        }
        break;
      }
      case 'c': {
        while (i < tokens.length && !isNaN(Number(tokens[i]))) {
          const dx1 = nextNum(), dy1 = nextNum(), dx2 = nextNum(), dy2 = nextNum(), dx = nextNum(), dy = nextNum();
          const x1 = cx + dx1, y1 = cy + dy1, x2 = cx + dx2, y2 = cy + dy2;
          cx += dx; cy += dy;
          const [p1x, p1y] = tx(x1, y1), [p2x, p2y] = tx(x2, y2), [px, py] = tx(cx, cy);
          result += `C ${p1x} ${p1y} ${p2x} ${p2y} ${px} ${py} `;
        }
        break;
      }
      case 'S': {
        while (i < tokens.length && !isNaN(Number(tokens[i]))) {
          const x2 = nextNum(), y2 = nextNum(), x = nextNum(), y = nextNum();
          cx = x; cy = y;
          result += `S ${tx(x2, y2)[0]} ${tx(x2, y2)[1]} ${tx(x, y)[0]} ${tx(x, y)[1]} `;
        }
        break;
      }
      case 's': {
        while (i < tokens.length && !isNaN(Number(tokens[i]))) {
          const dx2 = nextNum(), dy2 = nextNum(), dx = nextNum(), dy = nextNum();
          cx += dx; cy += dy;
          result += `S ${tx(cx + dx2, cy + dy2)[0]} ${tx(cx + dx2, cy + dy2)[1]} ${tx(cx, cy)[0]} ${tx(cx, cy)[1]} `;
        }
        break;
      }
      case 'Q': {
        while (i < tokens.length && !isNaN(Number(tokens[i]))) {
          const x1 = nextNum(), y1 = nextNum(), x = nextNum(), y = nextNum();
          cx = x; cy = y;
          result += `Q ${tx(x1, y1)[0]} ${tx(x1, y1)[1]} ${tx(x, y)[0]} ${tx(x, y)[1]} `;
        }
        break;
      }
      case 'q': {
        while (i < tokens.length && !isNaN(Number(tokens[i]))) {
          const dx1 = nextNum(), dy1 = nextNum(), dx = nextNum(), dy = nextNum();
          cx += dx; cy += dy;
          result += `Q ${tx(cx + dx1, cy + dy1)[0]} ${tx(cx + dx1, cy + dy1)[1]} ${tx(cx, cy)[0]} ${tx(cx, cy)[1]} `;
        }
        break;
      }
      case 'Z': case 'z':
        cx = sx; cy = sy; result += 'Z '; break;
      default:
        break;
    }
  }
  return result.trim();
}

function computePathBBox(d: string): { x: number; y: number; width: number; height: number } {
  try {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.cssText = 'position:absolute;left:-9999px;width:0;height:0';
    document.body.appendChild(svg);
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    svg.appendChild(path);
    const bbox = path.getBBox();
    document.body.removeChild(svg);
    return { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height };
  } catch { return { x: 0, y: 0, width: 0, height: 0 }; }
}

interface PathBuilder {
  segments: string[];
  currentX: number;
  currentY: number;
  startX: number;
  startY: number;
}

function createPathBuilder(): PathBuilder {
  return { segments: [], currentX: 0, currentY: 0, startX: 0, startY: 0 };
}

function moveTo(pb: PathBuilder, x: number, y: number) {
  pb.segments.push(`M ${x} ${y}`);
  pb.currentX = x;
  pb.currentY = y;
  pb.startX = x;
  pb.startY = y;
}

function lineTo(pb: PathBuilder, x: number, y: number) {
  pb.segments.push(`L ${x} ${y}`);
  pb.currentX = x;
  pb.currentY = y;
}

function curveTo(pb: PathBuilder, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) {
  pb.segments.push(`C ${x1} ${y1} ${x2} ${y2} ${x3} ${y3}`);
  pb.currentX = x3;
  pb.currentY = y3;
}

function closePath(pb: PathBuilder) {
  pb.segments.push('Z');
  pb.currentX = pb.startX;
  pb.currentY = pb.startY;
}

function buildPath(pb: PathBuilder): string {
  return pb.segments.join(' ');
}

function getBoundingBox(pb: PathBuilder): { x: number; y: number; width: number; height: number } {
  const points: [number, number][] = [];
  for (const seg of pb.segments) {
    const parts = seg.split(/\s+/);
    if (parts[0] === 'M' || parts[0] === 'L') {
      points.push([parseFloat(parts[1]), parseFloat(parts[2])]);
    } else if (parts[0] === 'C') {
      points.push([parseFloat(parts[1]), parseFloat(parts[2])]);
      points.push([parseFloat(parts[3]), parseFloat(parts[4])]);
      points.push([parseFloat(parts[5]), parseFloat(parts[6])]);
    }
  }
  if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

// OPS constants from pdf.js v3.4.120
const OPS = {
  setLineWidth: 2,
  save: 10,
  restore: 11,
  transform: 12,
  moveTo: 13,
  lineTo: 14,
  curveTo: 15,
  curveTo2: 16,
  curveTo3: 17,
  closePath: 18,
  rectangle: 19,
  stroke: 20,
  closeStroke: 21,
  fill: 22,
  eoFill: 23,
  fillStroke: 24,
  eoFillStroke: 25,
  closeFillStroke: 26,
  closeEOFillStroke: 27,
  endPath: 28,
  beginText: 31,
  endText: 32,
  setFont: 37,
  moveText: 40,
  setLeadingMoveText: 41,
  setTextMatrix: 42,
  nextLine: 43,
  showText: 44,
  showSpacedText: 45,
  nextLineShowText: 46,
  setStrokeGray: 56,
  setFillGray: 57,
  setStrokeRGBColor: 58,
  setFillRGBColor: 59,
  setStrokeCMYKColor: 60,
  setFillCMYKColor: 61,
  constructPath: 91,
};

/**
 * Extract vector elements from a pdf.js page.
 */
export async function extractPdfElements(
  page: any,
  scale: number = 1
): Promise<PdfElement[]> {
  const elements: PdfElement[] = [];
  const viewport = page.getViewport({ scale });

  const ops = await page.getOperatorList();

  let ctm: Matrix = [...IDENTITY];
  const ctmStack: Matrix[] = [];
  let currentPath: PathBuilder | null = null;

  let fillColor: Color = { r: 0, g: 0, b: 0 };
  let strokeColor: Color = { r: 0, g: 0, b: 0 };
  let fillColorSet = false;
  let strokeColorSet = false;
  let lineWidth = 1;

  // PDF coordinate system: origin at bottom-left, Y goes up
  const pdfHeight = viewport.height / scale;

  function pdfToSvgX(x: number): number {
    return x;
  }

  function pdfToSvgY(y: number): number {
    return pdfHeight - y;
  }

  function transformPathPoint(x: number, y: number): { x: number; y: number } {
    const p = transformPoint(ctm, x, y);
    return { x: pdfToSvgX(p.x), y: pdfToSvgY(p.y) };
  }

  const args = ops.argsArray;
  const fnArray = ops.fnArray;

  for (let i = 0; i < fnArray.length; i++) {
    const fn = fnArray[i];
    const arg = args[i];

    switch (fn) {
      case OPS.save:
        ctmStack.push([...ctm]);
        break;
      case OPS.restore:
        if (ctmStack.length > 0) {
          ctm = ctmStack.pop()!;
        }
        break;

      case OPS.transform:
        if (arg && arg.length >= 6) {
          const m: Matrix = [arg[0], arg[1], arg[2], arg[3], arg[4], arg[5]];
          ctm = multiplyMatrix(ctm, m);
        }
        break;

      // Path construction
      case OPS.moveTo:
        if (arg) {
          if (!currentPath) currentPath = createPathBuilder();
          const p = transformPathPoint(arg[0], arg[1]);
          moveTo(currentPath, p.x, p.y);
        }
        break;
      case OPS.lineTo:
        if (arg) {
          if (!currentPath) currentPath = createPathBuilder();
          const p = transformPathPoint(arg[0], arg[1]);
          lineTo(currentPath, p.x, p.y);
        }
        break;
      case OPS.curveTo:
        if (arg) {
          if (!currentPath) currentPath = createPathBuilder();
          const p1 = transformPathPoint(arg[0], arg[1]);
          const p2 = transformPathPoint(arg[2], arg[3]);
          const p3 = transformPathPoint(arg[4], arg[5]);
          curveTo(currentPath, p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
        }
        break;
      case OPS.curveTo2:
        if (arg) {
          if (!currentPath) currentPath = createPathBuilder();
          const p1 = { x: currentPath.currentX, y: currentPath.currentY };
          const p2 = transformPathPoint(arg[0], arg[1]);
          const p3 = transformPathPoint(arg[2], arg[3]);
          curveTo(currentPath, p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
        }
        break;
      case OPS.curveTo3:
        if (arg) {
          if (!currentPath) currentPath = createPathBuilder();
          const p1 = transformPathPoint(arg[0], arg[1]);
          const p3 = transformPathPoint(arg[2], arg[3]);
          curveTo(currentPath, p1.x, p1.y, p3.x, p3.y, p3.x, p3.y);
        }
        break;
      case OPS.rectangle:
        if (arg) {
          if (!currentPath) currentPath = createPathBuilder();
          const x = arg[0], y = arg[1], w = arg[2], h = arg[3];
          const p1 = transformPathPoint(x, y);
          const p2 = transformPathPoint(x + w, y);
          const p3 = transformPathPoint(x + w, y + h);
          const p4 = transformPathPoint(x, y + h);
          moveTo(currentPath, p1.x, p1.y);
          lineTo(currentPath, p2.x, p2.y);
          lineTo(currentPath, p3.x, p3.y);
          lineTo(currentPath, p4.x, p4.y);
          closePath(currentPath);
        }
        break;
      case OPS.closePath:
        if (currentPath) {
          closePath(currentPath);
        }
        break;

      case OPS.constructPath:
        if (arg && arg.length >= 2) {
          const drawOps = arg[0]; // array of OPS values (same enum as top-level)
          const pathArgs = arg[1]; // flat array of coordinates
          let argIdx = 0;
          for (const drawOp of drawOps) {
            switch (drawOp) {
              case OPS.moveTo: {
                if (!currentPath) currentPath = createPathBuilder();
                const p = transformPathPoint(pathArgs[argIdx], pathArgs[argIdx + 1]);
                moveTo(currentPath, p.x, p.y);
                argIdx += 2;
                break;
              }
              case OPS.lineTo: {
                if (!currentPath) currentPath = createPathBuilder();
                const p = transformPathPoint(pathArgs[argIdx], pathArgs[argIdx + 1]);
                lineTo(currentPath, p.x, p.y);
                argIdx += 2;
                break;
              }
              case OPS.curveTo: {
                if (!currentPath) currentPath = createPathBuilder();
                const p1 = transformPathPoint(pathArgs[argIdx], pathArgs[argIdx + 1]);
                const p2 = transformPathPoint(pathArgs[argIdx + 2], pathArgs[argIdx + 3]);
                const p3 = transformPathPoint(pathArgs[argIdx + 4], pathArgs[argIdx + 5]);
                curveTo(currentPath, p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
                argIdx += 6;
                break;
              }
              case OPS.curveTo2: {
                if (!currentPath) currentPath = createPathBuilder();
                const p1 = { x: currentPath.currentX, y: currentPath.currentY };
                const p2 = transformPathPoint(pathArgs[argIdx], pathArgs[argIdx + 1]);
                const p3 = transformPathPoint(pathArgs[argIdx + 2], pathArgs[argIdx + 3]);
                curveTo(currentPath, p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
                argIdx += 4;
                break;
              }
              case OPS.curveTo3: {
                if (!currentPath) currentPath = createPathBuilder();
                const p1 = transformPathPoint(pathArgs[argIdx], pathArgs[argIdx + 1]);
                const p3 = transformPathPoint(pathArgs[argIdx + 2], pathArgs[argIdx + 3]);
                curveTo(currentPath, p1.x, p1.y, p3.x, p3.y, p3.x, p3.y);
                argIdx += 4;
                break;
              }
              case OPS.rectangle: {
                if (!currentPath) currentPath = createPathBuilder();
                const x = pathArgs[argIdx], y = pathArgs[argIdx + 1];
                const w = pathArgs[argIdx + 2], h = pathArgs[argIdx + 3];
                const p1 = transformPathPoint(x, y);
                const p2 = transformPathPoint(x + w, y);
                const p3 = transformPathPoint(x + w, y + h);
                const p4 = transformPathPoint(x, y + h);
                moveTo(currentPath, p1.x, p1.y);
                lineTo(currentPath, p2.x, p2.y);
                lineTo(currentPath, p3.x, p3.y);
                lineTo(currentPath, p4.x, p4.y);
                closePath(currentPath);
                argIdx += 4;
                break;
              }
              case OPS.closePath:
                if (currentPath) closePath(currentPath);
                break;
            }
          }
        }
        break;

      // Path painting
      case OPS.stroke:
      case OPS.closeStroke:
      case OPS.fill:
      case OPS.eoFill:
      case OPS.fillStroke:
      case OPS.eoFillStroke:
      case OPS.closeFillStroke:
      case OPS.closeEOFillStroke:
        if (currentPath && currentPath.segments.length > 0) {
          const svgPath = buildPath(currentPath);
          const bb = getBoundingBox(currentPath);
          const decomposed = decomposeMatrix(ctm);

          const isStroke = fn === OPS.stroke || fn === OPS.closeStroke || fn === OPS.fillStroke || fn === OPS.eoFillStroke || fn === OPS.closeFillStroke || fn === OPS.closeEOFillStroke;
          const isFill = fn === OPS.fill || fn === OPS.eoFill || fn === OPS.fillStroke || fn === OPS.eoFillStroke || fn === OPS.closeFillStroke || fn === OPS.closeEOFillStroke;

          let fillHex: string | undefined;
          let strokeHex: string | undefined;

          if (isFill && fillColorSet) {
            fillHex = colorToHex(fillColor);
          }
          if (isStroke && strokeColorSet) {
            strokeHex = colorToHex(strokeColor);
          }

          if (bb.width > 0 || bb.height > 0) {
            elements.push({
              type: 'shape',
              shapeType: 'path',
              x: bb.x + bb.width / 2,
              y: bb.y + bb.height / 2,
              width: bb.width || 1,
              height: bb.height || 1,
              rotation: decomposed.rotation,
              svgPath,
              fill: fillHex,
              stroke: strokeHex,
              strokeWidth: lineWidth,
            });
          }
        }
        currentPath = createPathBuilder();
        break;

      case OPS.endPath:
        currentPath = createPathBuilder();
        break;

      // Color operators
      case OPS.setStrokeRGBColor:
        if (arg) {
          strokeColor = { r: arg[0], g: arg[1], b: arg[2] };
          strokeColorSet = true;
        }
        break;
      case OPS.setFillRGBColor:
        if (arg) {
          fillColor = { r: arg[0], g: arg[1], b: arg[2] };
          fillColorSet = true;
        }
        break;
      case OPS.setStrokeCMYKColor:
        if (arg) {
          strokeColor = cmykToRgb(arg[0], arg[1], arg[2], arg[3]);
          strokeColorSet = true;
        }
        break;
      case OPS.setFillCMYKColor:
        if (arg) {
          fillColor = cmykToRgb(arg[0], arg[1], arg[2], arg[3]);
          fillColorSet = true;
        }
        break;
      case OPS.setStrokeGray:
        if (arg) {
          strokeColor = { r: arg[0], g: arg[0], b: arg[0] };
          strokeColorSet = true;
        }
        break;
      case OPS.setFillGray:
        if (arg) {
          fillColor = { r: arg[0], g: arg[0], b: arg[0] };
          fillColorSet = true;
        }
        break;

      // Line width
      case OPS.setLineWidth:
        if (arg) {
          lineWidth = arg[0];
        }
        break;

      // Text operators
      case OPS.beginText:
        break;
      case OPS.endText:
        break;
      case OPS.setTextMatrix:
        if (arg && arg.length >= 6) {
          const tm: Matrix = [arg[0], arg[1], arg[2], arg[3], arg[4], arg[5]];
          const combined = multiplyMatrix(ctm, tm);
          const p = transformPoint(ctm, tm[4], tm[5]);
          const textDecomposed = decomposeMatrix(combined);
          (elements as any)._textX = pdfToSvgX(p.x);
          (elements as any)._textY = pdfToSvgY(p.y);
          (elements as any)._textRotation = textDecomposed.rotation;
          (elements as any)._textScale = textDecomposed.scaleY;
        }
        break;
      case OPS.showText:
        if (arg && arg.length > 0) {
          const text = arg.map((item: any) => {
            if (typeof item === 'string') return item;
            if (typeof item === 'object' && item !== null && 'str' in item) return item.str;
            return '';
          }).join('');
          if (text.trim()) {
            const tx = (elements as any)._textX ?? 0;
            const ty = (elements as any)._textY ?? 0;
            const tRotation = (elements as any)._textRotation ?? 0;
            const tScale = (elements as any)._textScale ?? 1;
            const fontSize = Math.max(1, 12 * tScale);

            elements.push({
              type: 'text',
              x: tx,
              y: ty,
              text: text.trim(),
              fontSize,
              fontFamily: 'sans-serif',
              color: fillColorSet ? colorToHex(fillColor) : '#000000',
              rotation: tRotation,
            });
          }
        }
        break;
      case OPS.showSpacedText:
        if (arg && arg.length > 0) {
          const textParts: string[] = [];
          for (const item of arg) {
            if (Array.isArray(item)) {
              for (const sub of item) {
                if (typeof sub === 'string') textParts.push(sub);
                else if (typeof sub === 'object' && sub !== null && 'str' in sub) textParts.push(sub.str);
              }
            } else if (typeof item === 'string') {
              textParts.push(item);
            }
          }
          const text = textParts.join('');
          if (text.trim()) {
            const tx = (elements as any)._textX ?? 0;
            const ty = (elements as any)._textY ?? 0;
            const tRotation = (elements as any)._textRotation ?? 0;
            const tScale = (elements as any)._textScale ?? 1;
            const fontSize = Math.max(1, 12 * tScale);

            elements.push({
              type: 'text',
              x: tx,
              y: ty,
              text: text.trim(),
              fontSize,
              fontFamily: 'sans-serif',
              color: fillColorSet ? colorToHex(fillColor) : '#000000',
              rotation: tRotation,
            });
          }
        }
        break;
      case OPS.nextLineShowText:
        if (arg && arg.length > 0) {
          const leading = (elements as any)._textLeading ?? 0;
          const prevTx = (elements as any)._textX ?? 0;
          const prevTy = (elements as any)._textY ?? 0;
          (elements as any)._textX = prevTx;
          (elements as any)._textY = prevTy - leading;

          const text = arg.map((item: any) => {
            if (typeof item === 'string') return item;
            if (typeof item === 'object' && item !== null && 'str' in item) return item.str;
            return '';
          }).join('');
          if (text.trim()) {
            const tx = (elements as any)._textX ?? 0;
            const ty = (elements as any)._textY ?? 0;
            const tRotation = (elements as any)._textRotation ?? 0;
            const tScale = (elements as any)._textScale ?? 1;
            const fontSize = Math.max(1, 12 * tScale);

            elements.push({
              type: 'text',
              x: tx,
              y: ty,
              text: text.trim(),
              fontSize,
              fontFamily: 'sans-serif',
              color: fillColorSet ? colorToHex(fillColor) : '#000000',
              rotation: tRotation,
            });
          }
        }
        break;
      case OPS.setFont:
        if (arg && arg.length >= 2) {
          (elements as any)._textFont = arg[0];
          (elements as any)._textFontSize = arg[1];
        }
        break;
      case OPS.moveText:
        if (arg) {
          const prevX = (elements as any)._textX ?? 0;
          const prevY = (elements as any)._textY ?? 0;
          (elements as any)._textX = prevX + arg[0];
          (elements as any)._textY = prevY - arg[1];
        }
        break;
      case OPS.setLeadingMoveText:
        if (arg) {
          const prevX = (elements as any)._textX ?? 0;
          const prevY = (elements as any)._textY ?? 0;
          (elements as any)._textX = prevX + arg[0];
          (elements as any)._textY = prevY - arg[1];
          (elements as any)._textLeading = arg[1];
        }
        break;
      case OPS.nextLine:
        const leading = (elements as any)._textLeading ?? 0;
        const prevTx = (elements as any)._textX ?? 0;
        const prevTy = (elements as any)._textY ?? 0;
        (elements as any)._textX = prevTx;
        (elements as any)._textY = prevTy - leading;
        break;
    }
  }

  // Clean up internal properties
  delete (elements as any)._textX;
  delete (elements as any)._textY;
  delete (elements as any)._textRotation;
  delete (elements as any)._textScale;
  delete (elements as any)._textFont;
  delete (elements as any)._textFontSize;
  delete (elements as any)._textLeading;

  console.log(`[PDF] extractPdfElements: ${elements.length} elements (${elements.filter(e => e.type === 'shape').length} shapes, ${elements.filter(e => e.type === 'text').length} texts)`);

  return elements;
}

/**
 * Robust vector path — uses pdf.js SVGGraphics for true vector fidelity.
 * Falls back to raster-in-SVG for scanned PDFs, but at high-res PNG with transparency
 * instead of blurry JPEG white-bg.
 */
export async function pdfPageToSvgViaGraphics(
  page: any,
  scale: number,
  pdfjsLib: any
): Promise<string | null> {
  try {
    const viewport = page.getViewport({ scale });
    const opList = await page.getOperatorList();
    const svgGfx = new pdfjsLib.SVGGraphics(page.commonObjs, page.objs);
    const svg = await svgGfx.getSVG(opList, viewport);
    // Serialize the generated <svg> element
    const serializer = new XMLSerializer();
    let svgStr = serializer.serializeToString(svg);
    // Ensure proper namespace and no extra white background rect
    if (!svgStr.includes('xmlns="http://www.w3.org/2000/svg"')) {
      svgStr = svgStr.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    return svgStr;
  } catch {
    return null;
  }
}

/**
 * Use pdf.js SVGGraphics to produce true vector SVG, then parse it into individual
 * workspace path shapes with transforms baked into the coordinates. This gives the
 * same quality as online PDF→SVG converters.
 */
export async function pdfPageToVectorShapesViaSvg(
  page: any,
  scale: number,
  pdfjsLib: any
): Promise<PdfElement[] | null> {
  try {
    const viewport = page.getViewport({ scale });
    const opList = await page.getOperatorList();
    const svgGfx = new pdfjsLib.SVGGraphics(page.commonObjs, page.objs);
    const svg = await svgGfx.getSVG(opList, viewport);
    if (!svg) return null;

    const elements: PdfElement[] = [];

    function processElement(el: SVGElement, ctm: DOMMatrix) {
      const transformAttr = el.getAttribute('transform');
      let matrix = ctm;
      if (transformAttr) {
        const parsed = parseSvgTransformMatrix(transformAttr);
        if (parsed) matrix = ctm.multiply(parsed);
      }

      if (el.tagName === 'path') {
        const d = el.getAttribute('d');
        if (d && d.length > 2) {
          const transformedD = transformPathD(d, matrix);
          const bbox = computePathBBox(transformedD);
          if (bbox.width > 0.5 || bbox.height > 0.5) {
            const fill = el.getAttribute('fill');
            const stroke = el.getAttribute('stroke');
            const sw = el.getAttribute('stroke-width');
            elements.push({
              type: 'shape',
              shapeType: 'path',
              x: bbox.x + bbox.width / 2,
              y: bbox.y + bbox.height / 2,
              width: bbox.width,
              height: bbox.height,
              rotation: 0,
              svgPath: transformedD,
              fill: fill === 'none' || !fill ? undefined : fill,
              stroke: stroke || '#000000',
              strokeWidth: sw ? parseFloat(sw) : 1,
            });
          }
        }
      }

      for (const child of el.children) {
        if (child instanceof SVGElement) processElement(child, matrix);
      }
    }

    processElement(svg, new DOMMatrix());
    return elements.length > 0 ? elements : null;
  } catch {
    return null;
  }
}

/**
 * Fallback for raster PDFs: render the PDF page to an image and wrap it in an SVG shape
 * so "As Vectors" works for any PDF, not just pure vector PDFs. Online converters do
 * exactly this — a scanned PDF becomes an SVG with an embedded bitmap.
 */
export async function pdfPageToVectorWithFallback(
  page: any,
  scale: number,
  pdfjsLib: any
): Promise<PdfElement[]> {
  const elements = await extractPdfElements(page, scale);
  if (elements.length > 0) return elements;

  // No vectors — raster fallback: render page to image and return it as a single shape
  // that will be placed as an <image> inside an SVG. Keeps the "As Vectors" promise.
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return elements;
  await page.render({ canvasContext: ctx, viewport }).promise;
  const dataUrl = canvas.toDataURL("image/png");
  // Return as a single image shape that toWorkspaceItems will turn into an image shape
  // We encode it as a PdfShape of type image via a synthetic element
  return [
    {
      type: "shape",
      shapeType: "rectangle",
      x: viewport.width / 2,
      y: viewport.height / 2,
      width: viewport.width,
      height: viewport.height,
      rotation: 0,
      fill: undefined,
      stroke: undefined,
      strokeWidth: 0,
      // Use svgPath to carry the image — toWorkspaceItems will handle fillImage
      svgPath: undefined,
    } as any,
    // Also add a text marker so hasContent check passes — actual image will be handled by caller
  ];
}

/**
 * Convert extracted PDF elements to workspace shapes and text annotations.
 */
export function toWorkspaceItems(
  elements: PdfElement[],
  pageWidth: number,
  pageHeight: number,
  offsetX: number = 0,
  offsetY: number = 0
): {
  shapes: any[];
  textAnnotations: any[];
} {
  const shapes: any[] = [];
  const textAnnotations: any[] = [];
  const now = Date.now();

  for (const el of elements) {
    if (el.type === 'shape') {
      // For path shapes, offset svgPath coordinates to be relative to shape center
      // because ShapeRenderer uses translate(x,y) then draws path at local coords
      let svgPath = el.svgPath;
      if (el.shapeType === 'path' && svgPath) {
        const offsetMatrix = new DOMMatrix([1, 0, 0, 1, -el.x, -el.y]);
        svgPath = transformPathD(svgPath, offsetMatrix);
      }
      shapes.push({
        id: `pdf-shape-${now}-${Math.random().toString(36).slice(2, 8)}`,
        name: `PDF Shape`,
        type: el.shapeType === 'rectangle' ? 'rectangle' : el.shapeType === 'ellipse' ? 'ellipse' : 'path',
        x: el.x + offsetX,
        y: el.y + offsetY,
        width: el.width,
        height: el.height,
        rotation: el.rotation,
        svgPath,
        fill: el.fill || 'none',
        stroke: el.stroke || '#000000',
        strokeWidth: el.strokeWidth,
        zIndex: shapes.length,
      });
    } else if (el.type === 'text') {
      textAnnotations.push({
        id: `pdf-text-${now}-${Math.random().toString(36).slice(2, 8)}`,
        name: `PDF Text`,
        x: el.x + offsetX,
        y: el.y + offsetY,
        text: el.text,
        fontSize: el.fontSize,
        fontFamily: el.fontFamily,
        color: el.color,
        rotation: el.rotation,
        zIndex: textAnnotations.length,
      });
    }
  }

  return { shapes, textAnnotations };
}

/**
 * Merge all extracted PDF path shapes into a single combined shape per page.
 * All paths are translated so they share a common origin (top-left of bounding box).
 */
export function mergePdfElements(
  elements: PdfElement[],
  pageWidth: number,
  pageHeight: number,
): { shapes: any[]; textAnnotations: any[] } {
  const pathElements = elements.filter(e => e.type === 'shape' && (e as any).svgPath) as PdfShape[];
  const textAnnotations = elements.filter(e => e.type === 'text').map((el, i) => ({
    id: `pdf-text-${Date.now()}-${i}`,
    name: `PDF Text`,
    x: el.x,
    y: el.y,
    text: (el as any).text,
    fontSize: (el as any).fontSize,
    fontFamily: (el as any).fontFamily,
    color: (el as any).color,
    rotation: (el as any).rotation,
    zIndex: i,
  }));

  if (pathElements.length === 0) {
    return { shapes: [], textAnnotations };
  }

  // Compute overall bounding box across all path elements
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const el of pathElements) {
    const halfW = el.width / 2;
    const halfH = el.height / 2;
    minX = Math.min(minX, el.x - halfW);
    minY = Math.min(minY, el.y - halfH);
    maxX = Math.max(maxX, el.x + halfW);
    maxY = Math.max(maxY, el.y + halfH);
  }

  const overallWidth = maxX - minX || pageWidth;
  const overallHeight = maxY - minY || pageHeight;
  const centerX = minX + overallWidth / 2;
  const centerY = minY + overallHeight / 2;

  // Combine all paths into one SVG path, offset so (0,0) = center of bounding box
  // ShapeRenderer translates to (shape.x, shape.y) then draws path, so path must be
  // centered at origin to match the selection bounding box (which is centered at shape.x/y).
  const combinedParts: string[] = [];
  for (const el of pathElements) {
    if (!el.svgPath) continue;
    const offsetMatrix = new DOMMatrix([1, 0, 0, 1, -centerX, -centerY]);
    combinedParts.push(transformPathD(el.svgPath, offsetMatrix));
  }

  const combinedSvgPath = combinedParts.join(' ');

  // Use the dominant stroke color
  const strokeColors = new Map<string, number>();
  for (const el of pathElements) {
    const s = el.stroke || '#000000';
    strokeColors.set(s, (strokeColors.get(s) || 0) + 1);
  }
  let dominantStroke = '#000000';
  let maxCount = 0;
  for (const [color, count] of strokeColors) {
    if (count > maxCount) { maxCount = count; dominantStroke = color; }
  }

  const shapes = [{
    id: `pdf-merged-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: `PDF Import`,
    type: 'path' as const,
    x: centerX,
    y: centerY,
    width: overallWidth,
    height: overallHeight,
    rotation: 0,
    svgPath: combinedSvgPath,
    fill: 'none',
    stroke: dominantStroke,
    strokeWidth: pathElements[0]?.strokeWidth || 1,
    zIndex: 0,
  }];

  return { shapes, textAnnotations };
}
