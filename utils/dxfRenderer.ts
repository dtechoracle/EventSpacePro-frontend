import { parseDxf, computeDxfBounds } from '@/utils/dxfParser';

const dxfDataUrlCache: Record<string, string> = {};

export function renderDxfToDataUrl(dxfText: string): string {
  const parsed = parseDxf(dxfText);
  const bounds = computeDxfBounds(parsed.entities);

  const padding = 40;
  const contentW = bounds.maxX - bounds.minX + padding * 2;
  const contentH = bounds.maxY - bounds.minY + padding * 2;

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(contentW));
  canvas.height = Math.max(1, Math.round(contentH));

  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#f9fafb';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = '#272235';
  ctx.lineWidth = 1;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.save();
  ctx.translate(padding - bounds.minX, padding - bounds.minY);
  ctx.scale(1, -1);
  ctx.translate(0, -(bounds.minY + bounds.maxY));

  for (const entity of parsed.entities) {
    drawEntity(ctx, entity);
  }

  ctx.restore();

  return canvas.toDataURL('image/png');
}

function drawEntity(ctx: CanvasRenderingContext2D, entity: any) {
  switch (entity.type) {
    case 'LINE':
      if (entity.vertices && entity.vertices.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(entity.vertices[0].x, entity.vertices[0].y);
        ctx.lineTo(entity.vertices[1].x, entity.vertices[1].y);
        ctx.stroke();
      }
      break;

    case 'POLYLINE':
    case 'LWPOLYLINE': {
      const verts = entity.polyline?.vertices || entity.vertices;
      if (verts && verts.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(verts[0].x, verts[0].y);
        for (let i = 1; i < verts.length; i++) {
          ctx.lineTo(verts[i].x, verts[i].y);
        }
        if (entity.polyline?.isClosed) ctx.closePath();
        ctx.stroke();
      }
      break;
    }

    case 'CIRCLE':
      if (entity.center && entity.radius) {
        ctx.beginPath();
        ctx.arc(entity.center.x, entity.center.y, entity.radius, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;

    case 'ARC':
      if (entity.center && entity.radius && entity.startAngle !== undefined && entity.endAngle !== undefined) {
        const startRad = (entity.startAngle * Math.PI) / 180;
        const endRad = (entity.endAngle * Math.PI) / 180;
        ctx.beginPath();
        ctx.arc(entity.center.x, entity.center.y, entity.radius, startRad, endRad);
        ctx.stroke();
      }
      break;

    case 'ELLIPSE':
      if (entity.center && entity.majorAxisEndPoint) {
        const rx = Math.sqrt(
          entity.majorAxisEndPoint.x ** 2 + entity.majorAxisEndPoint.y ** 2
        );
        const ry = rx * (entity.ratioOfEllipseAxis || 1);
        const rotation = Math.atan2(
          entity.majorAxisEndPoint.y,
          entity.majorAxisEndPoint.x
        );
        ctx.save();
        ctx.translate(entity.center.x, entity.center.y);
        ctx.rotate(rotation);
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.restore();
        ctx.stroke();
      }
      break;

    case 'SPLINE': {
      const pts = entity.points || entity.vertices;
      if (pts && pts.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.stroke();
      }
      break;
    }

    case 'TEXT':
    case 'MTEXT': {
      const pos = entity.insertionPoint || (entity.vertices && entity.vertices[0]);
      if (pos && entity.text) {
        const fontSize = entity.height || 100;
        ctx.font = `${fontSize}px Arial`;
        ctx.fillStyle = '#272235';
        ctx.fillText(entity.text, pos.x, pos.y);
      }
      break;
    }

    case 'INSERT': {
      if (entity.insertionPoint) {
        ctx.fillStyle = '#272235';
        ctx.fillRect(
          entity.insertionPoint.x - 50,
          entity.insertionPoint.y - 50,
          100,
          100
        );
      }
      break;
    }
  }
}

export async function getDxfDataUrl(path: string): Promise<string> {
  if (dxfDataUrlCache[path]) return dxfDataUrlCache[path];

  const res = await fetch(path);
  const text = await res.text();
  const dataUrl = renderDxfToDataUrl(text);
  dxfDataUrlCache[path] = dataUrl;
  return dataUrl;
}
