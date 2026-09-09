import DxfParser from 'dxf-parser';

export interface DxfEntity {
  type: string;
  layer?: string;
  vertices?: { x: number; y: number; z: number }[];
  start?: { x: number; y: number; z: number };
  end?: { x: number; y: number; z: number };
  center?: { x: number; y: number; z: number };
  radius?: number;
  startAngle?: number;
  endAngle?: number;
  text?: string;
  height?: number;
  insertionPoint?: { x: number; y: number; z: number };
  majorAxisEndPoint?: { x: number; y: number; z: number };
  ratioOfEllipseAxis?: number;
  polyline?: { vertices: { x: number; y: number; z: number }[]; isClosed?: boolean };
  points?: { x: number; y: number; z: number }[];
  controlPoints?: { x: number; y: number; z: number }[];
  position?: { x: number; y: number; z: number };
  bulge?: number;
}

export interface DxfData {
  entities: DxfEntity[];
  header?: Record<string, unknown>;
  tables?: Record<string, unknown>;
}

export function parseDxf(text: string): DxfData {
  const parser = new DxfParser();
  const result = parser.parseSync(text);
  return {
    entities: (result?.entities || []) as DxfEntity[],
    header: result?.header,
    tables: result?.tables,
  };
}

export function computeDxfBounds(entities: DxfEntity[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const update = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };

  for (const e of entities) {
    if (e.vertices) {
      for (const v of e.vertices) update(v.x, v.y);
    }
    if (e.start) update(e.start.x, e.start.y);
    if (e.end) update(e.end.x, e.end.y);
    if (e.center) {
      update(e.center.x, e.center.y);
      if (e.radius) {
        update(e.center.x - e.radius, e.center.y - e.radius);
        update(e.center.x + e.radius, e.center.y + e.radius);
      }
    }
    if (e.insertionPoint) update(e.insertionPoint.x, e.insertionPoint.y);
    if (e.position) update(e.position.x, e.position.y);
    if (e.controlPoints) {
      for (const v of e.controlPoints) update(v.x, v.y);
    }
    if (e.polyline?.vertices) {
      for (const v of e.polyline.vertices) update(v.x, v.y);
    }
    if (e.points) {
      for (const p of e.points) update(p.x, p.y);
    }
  }

  if (minX === Infinity) {
    minX = 0; minY = 0; maxX = 100; maxY = 100;
  }

  return { minX, minY, maxX, maxY };
}
