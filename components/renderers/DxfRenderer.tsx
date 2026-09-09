import { useRef, useEffect, useState, memo } from 'react';
import { parseDxf, computeDxfBounds, DxfEntity } from '@/utils/dxfParser';

function drawEntity(ctx: CanvasRenderingContext2D, entity: DxfEntity) {
  ctx.strokeStyle = '#272235';
  ctx.lineWidth = 1;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

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
      const pts = entity.controlPoints || entity.points || entity.vertices;
      if (pts && pts.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        if (pts.length === 2) {
          ctx.lineTo(pts[1].x, pts[1].y);
        } else {
          for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].x, pts[i].y);
          }
        }
        ctx.stroke();
      }
      break;
    }

    case 'POINT':
      if (entity.vertices && entity.vertices.length > 0) {
        const p = entity.vertices[0];
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      break;

    case 'TEXT':
    case 'MTEXT': {
      const pos = entity.insertionPoint || entity.position || (entity.vertices && entity.vertices[0]);
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

const DxfRenderer = memo(function DxfRenderer({
  src,
  className = '',
  style = {},
}: {
  src: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch(encodeURI(src))
      .then((r) => r.text())
      .then((dxfText) => {
        if (cancelled) return;

        const parsed = parseDxf(dxfText);
        const bounds = computeDxfBounds(parsed.entities);
        const canvas = canvasRef.current;
        if (!canvas) return;

        const padding = 40;
        const contentW = bounds.maxX - bounds.minX + padding * 2;
        const contentH = bounds.maxY - bounds.minY + padding * 2;

        const MAX_CANVAS = 4096;
        const canvasScale = Math.min(1, MAX_CANVAS / Math.max(contentW, contentH));
        canvas.width = Math.max(1, Math.round(contentW * canvasScale));
        canvas.height = Math.max(1, Math.round(contentH * canvasScale));

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.fillStyle = '#f9fafb';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        ctx.translate((padding - bounds.minX) * canvasScale, (padding - bounds.minY) * canvasScale);
        ctx.scale(canvasScale, -canvasScale);
        ctx.translate(0, -(bounds.minY + bounds.maxY));

        ctx.strokeStyle = '#272235';
        ctx.lineWidth = 80;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        for (const entity of parsed.entities) {
          drawEntity(ctx, entity);
        }

        ctx.restore();
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => { cancelled = true; };
  }, [src]);

  if (error) {
    return <div className={`bg-gray-100 rounded ${className}`} style={style} />;
  }

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: '100%', height: '100%', objectFit: 'contain', ...style }}
    />
  );
});

export default DxfRenderer;
