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
        if (currentPath && arg) {
          const p = transformPathPoint(arg[0], arg[1]);
          moveTo(currentPath, p.x, p.y);
        }
        break;
      case OPS.lineTo:
        if (currentPath && arg) {
          const p = transformPathPoint(arg[0], arg[1]);
          lineTo(currentPath, p.x, p.y);
        }
        break;
      case OPS.curveTo:
        if (currentPath && arg) {
          const p1 = transformPathPoint(arg[0], arg[1]);
          const p2 = transformPathPoint(arg[2], arg[3]);
          const p3 = transformPathPoint(arg[4], arg[5]);
          curveTo(currentPath, p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
        }
        break;
      case OPS.curveTo2:
        if (currentPath && arg) {
          const p1 = { x: currentPath.currentX, y: currentPath.currentY };
          const p2 = transformPathPoint(arg[0], arg[1]);
          const p3 = transformPathPoint(arg[2], arg[3]);
          curveTo(currentPath, p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
        }
        break;
      case OPS.curveTo3:
        if (currentPath && arg) {
          const p1 = transformPathPoint(arg[0], arg[1]);
          const p3 = transformPathPoint(arg[2], arg[3]);
          curveTo(currentPath, p1.x, p1.y, p3.x, p3.y, p3.x, p3.y);
        }
        break;
      case OPS.rectangle:
        if (currentPath && arg) {
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
          const drawOps = arg[0]; // array of OPS.moveTo, OPS.lineTo, etc.
          const pathArgs = arg[1]; // flat array of coordinates
          let argIdx = 0;
          for (const drawOp of drawOps) {
            switch (drawOp) {
              case 0: { // DrawOPS.moveTo
                const p = transformPathPoint(pathArgs[argIdx], pathArgs[argIdx + 1]);
                if (currentPath) moveTo(currentPath, p.x, p.y);
                argIdx += 2;
                break;
              }
              case 1: { // DrawOPS.lineTo
                const p = transformPathPoint(pathArgs[argIdx], pathArgs[argIdx + 1]);
                if (currentPath) lineTo(currentPath, p.x, p.y);
                argIdx += 2;
                break;
              }
              case 2: { // DrawOPS.curveTo
                const p1 = transformPathPoint(pathArgs[argIdx], pathArgs[argIdx + 1]);
                const p2 = transformPathPoint(pathArgs[argIdx + 2], pathArgs[argIdx + 3]);
                const p3 = transformPathPoint(pathArgs[argIdx + 4], pathArgs[argIdx + 5]);
                if (currentPath) curveTo(currentPath, p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
                argIdx += 6;
                break;
              }
              case 3: // DrawOPS.closePath
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

  return elements;
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
      shapes.push({
        id: `pdf-shape-${now}-${Math.random().toString(36).slice(2, 8)}`,
        name: `PDF Shape`,
        type: el.shapeType === 'rectangle' ? 'rectangle' : el.shapeType === 'ellipse' ? 'ellipse' : 'path',
        x: el.x + offsetX,
        y: el.y + offsetY,
        width: el.width,
        height: el.height,
        rotation: el.rotation,
        svgPath: el.svgPath,
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
