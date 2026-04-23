export type Bounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type SpatialEntry<T> = {
  id: string;
  item: T;
  bounds: Bounds;
  zIndex?: number;
};

const normalizeBounds = (bounds: Bounds): Bounds => ({
  left: Math.min(bounds.left, bounds.right),
  top: Math.min(bounds.top, bounds.bottom),
  right: Math.max(bounds.left, bounds.right),
  bottom: Math.max(bounds.top, bounds.bottom),
});

const intersects = (a: Bounds, b: Bounds) => (
  a.left <= b.right &&
  a.right >= b.left &&
  a.top <= b.bottom &&
  a.bottom >= b.top
);

const containsPoint = (bounds: Bounds, x: number, y: number) => (
  x >= bounds.left &&
  x <= bounds.right &&
  y >= bounds.top &&
  y <= bounds.bottom
);

export class SpatialIndex<T> {
  private readonly cellSize: number;
  private readonly entries: SpatialEntry<T>[];
  private readonly cells = new Map<string, number[]>();

  constructor(entries: SpatialEntry<T>[], cellSize = 2500) {
    this.cellSize = Math.max(1, cellSize);
    this.entries = entries.map((entry) => ({
      ...entry,
      bounds: normalizeBounds(entry.bounds),
    }));

    this.entries.forEach((entry, index) => {
      const minX = Math.floor(entry.bounds.left / this.cellSize);
      const maxX = Math.floor(entry.bounds.right / this.cellSize);
      const minY = Math.floor(entry.bounds.top / this.cellSize);
      const maxY = Math.floor(entry.bounds.bottom / this.cellSize);

      for (let x = minX; x <= maxX; x += 1) {
        for (let y = minY; y <= maxY; y += 1) {
          const key = `${x}:${y}`;
          const bucket = this.cells.get(key);
          if (bucket) {
            bucket.push(index);
          } else {
            this.cells.set(key, [index]);
          }
        }
      }
    });
  }

  query(bounds: Bounds) {
    const queryBounds = normalizeBounds(bounds);
    const minX = Math.floor(queryBounds.left / this.cellSize);
    const maxX = Math.floor(queryBounds.right / this.cellSize);
    const minY = Math.floor(queryBounds.top / this.cellSize);
    const maxY = Math.floor(queryBounds.bottom / this.cellSize);
    const seen = new Set<number>();
    const result: SpatialEntry<T>[] = [];

    for (let x = minX; x <= maxX; x += 1) {
      for (let y = minY; y <= maxY; y += 1) {
        const bucket = this.cells.get(`${x}:${y}`);
        if (!bucket) continue;

        bucket.forEach((index) => {
          if (seen.has(index)) return;
          seen.add(index);

          const entry = this.entries[index];
          if (entry && intersects(entry.bounds, queryBounds)) {
            result.push(entry);
          }
        });
      }
    }

    return result;
  }

  queryPoint(x: number, y: number, tolerance = 0) {
    return this.query({
      left: x - tolerance,
      top: y - tolerance,
      right: x + tolerance,
      bottom: y + tolerance,
    }).filter((entry) => containsPoint(entry.bounds, x, y));
  }
}

export const getRotatedItemBounds = (item: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  scale?: number;
  rotation?: number;
}): Bounds => {
  const x = item.x ?? 0;
  const y = item.y ?? 0;
  const width = Math.max(0, (item.width ?? 0) * (item.scale ?? 1));
  const height = Math.max(0, (item.height ?? 0) * (item.scale ?? 1));
  const rotation = ((item.rotation ?? 0) * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rotation));
  const sin = Math.abs(Math.sin(rotation));
  const halfW = ((width * cos) + (height * sin)) / 2;
  const halfH = ((width * sin) + (height * cos)) / 2;

  return {
    left: x - halfW,
    top: y - halfH,
    right: x + halfW,
    bottom: y + halfH,
  };
};
