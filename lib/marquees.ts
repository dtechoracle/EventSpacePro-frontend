export interface MarqueeDef {
  id: string;
  name: string;
  path: string;
  width: number;
  height: number;
}

export type MarqueeGeometry = {
  baySize: number;
  wallThickness: number;
  markerSize: number;
  innerGuideDashArray: string | null;
  markerCenters: { x: number; y: number }[];
};

const RAW_MARQUEES: MarqueeDef[] = [
  { id: "10m-x-10m-marquee", name: "10m X 10m Marquee", path: "/Marquees/10m X 10m Marquee.svg", width: 10000, height: 10000 },
  { id: "10m-x-20m-marquee", name: "10m X 20m Marquee", path: "/Marquees/10m X 20m Marquee.svg", width: 20000, height: 10000 },
  { id: "10m-x-30m-marquee", name: "10m X 30m Marquee", path: "/Marquees/10m X 30m Marquee.svg", width: 30000, height: 10000 },
  { id: "12m-x-12m-marquee", name: "12m X 12m Marquee", path: "/Marquees/12m X 12m Marquee.svg", width: 12000, height: 12000 },
  { id: "12m-x-18m-marquee", name: "12m X 18m Marquee", path: "/Marquees/12m X 18m Marquee.svg", width: 18000, height: 12000 },
  { id: "12m-x-24m-marquee", name: "12m X 24m Marquee", path: "/Marquees/12m X 24m Marquee.svg", width: 24000, height: 12000 },
  { id: "15m-x-15m-marquee", name: "15m X 15m Marquee", path: "/Marquees/15m X 15m Marquee.svg", width: 15000, height: 15000 },
  { id: "15m-x-20m-marquee", name: "15m X 20m Marquee", path: "/Marquees/15m X 20m Marquee.svg", width: 20000, height: 15000 },
  { id: "15m-x-30m-marquee", name: "15m X 30m Marquee", path: "/Marquees/15m X 30m Marquee.svg", width: 30000, height: 15000 },
  { id: "20m-x-20m-marquee", name: "20m X 20m Marquee", path: "/Marquees/20m X 20m Marquee.svg", width: 20000, height: 20000 },
  { id: "20m-x-25m-marquee", name: "20m X 25m Marquee", path: "/Marquees/20m X 25m Marquee.svg", width: 25000, height: 20000 },
  { id: "20m-x-30m-marquee", name: "20m X 30m Marquee", path: "/Marquees/20m X 30m Marquee.svg", width: 30000, height: 20000 },
  { id: "20m-x-40m-marquee", name: "20m X 40m Marquee", path: "/Marquees/20m X 40m Marquee.svg", width: 40000, height: 20000 },
  { id: "20m-x-50m-marquee", name: "20m X 50m Marquee", path: "/Marquees/20m X 50m Marquee.svg", width: 50000, height: 20000 },
  { id: "25m-x-25m-marquee", name: "25m X 25m Marquee", path: "/Marquees/25m X 25m Marquee.svg", width: 25000, height: 25000 },
  { id: "25m-x-30m-marquee", name: "25m X 30m Marquee", path: "/Marquees/25m X 30m Marquee.svg", width: 30000, height: 25000 },
  { id: "25m-x-40m-marquee", name: "25m X 40m Marquee", path: "/Marquees/25m X 40m Marquee.svg", width: 40000, height: 25000 },
  { id: "25m-x-50m-marquee", name: "25m X 50m Marquee", path: "/Marquees/25m X 50m Marquee.svg", width: 50000, height: 25000 },
  { id: "30m-x-100m-marquee", name: "30m X 100m Marquee", path: "/Marquees/30m X 100m Marquee.svg", width: 100000, height: 30000 },
  { id: "30m-x-150m-marquee", name: "30m X 150m Marquee", path: "/Marquees/30m X 150m Marquee.svg", width: 150000, height: 30000 },
  { id: "30m-x-30m-marquee", name: "30m X 30m Marquee", path: "/Marquees/30m X 30m Marquee.svg", width: 30000, height: 30000 },
  { id: "30m-x-50m-marquee", name: "30m X 50m Marquee", path: "/Marquees/30m X 50m Marquee.svg", width: 50000, height: 30000 },
  { id: "3m-x-3m-marquee", name: "3m X 3m Marquee", path: "/Marquees/3m X 3m Marquee.svg", width: 3000, height: 3000 },
  { id: "3m-x-6m-marquee", name: "3m X 6m Marquee", path: "/Marquees/3m X 6m Marquee.svg", width: 6000, height: 3000 },
  { id: "3m-x-9m-marquee", name: "3m X 9m Marquee", path: "/Marquees/3m X 9m Marquee.svg", width: 9000, height: 3000 },
  { id: "5m-x-10m-marquee", name: "5m X 10m Marquee", path: "/Marquees/5m X 10m Marquee.svg", width: 10000, height: 5000 },
  { id: "5m-x-5m-marquee", name: "5m X 5m Marquee", path: "/Marquees/5m X 5m Marquee.svg", width: 5000, height: 5000 },
  { id: "6m-x-12m-marquee", name: "6m X 12m Marquee", path: "/Marquees/6m X 12m Marquee.svg", width: 12000, height: 6000 },
  { id: "6m-x-18m-marquee", name: "6m X 18m Marquee", path: "/Marquees/6m X 18m Marquee.svg", width: 18000, height: 6000 },
  { id: "6m-x-6m-marquee", name: "6m X 6m Marquee", path: "/Marquees/6m X 6m Marquee.svg", width: 6000, height: 6000 },
  { id: "9m-x-18m-marquee", name: "9m X 18m Marquee", path: "/Marquees/9m X 18m Marquee.svg", width: 18000, height: 9000 },
  { id: "9m-x-9m-marquee", name: "9m X 9m Marquee", path: "/Marquees/9m X 9m Marquee.svg", width: 9000, height: 9000 },
];

export const MARQUEES: MarqueeDef[] = [...RAW_MARQUEES].sort((a, b) => {
  const aShort = Math.min(a.width, a.height);
  const bShort = Math.min(b.width, b.height);
  const shortSideDelta = aShort - bShort;
  if (shortSideDelta !== 0) return shortSideDelta;

  const aLong = Math.max(a.width, a.height);
  const bLong = Math.max(b.width, b.height);
  const longSideDelta = aLong - bLong;
  if (longSideDelta !== 0) return longSideDelta;

  const areaDelta = a.width * a.height - b.width * b.height;
  if (areaDelta !== 0) return areaDelta;

  const widthDelta = a.width - b.width;
  if (widthDelta !== 0) return widthDelta;

  const heightDelta = a.height - b.height;
  if (heightDelta !== 0) return heightDelta;

  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
});

function createAxisStops(length: number, step: number) {
  const stops: number[] = [];

  for (let current = 0; current < length; current += step) {
    stops.push(current);
  }

  if (stops[stops.length - 1] !== length) {
    stops.push(length);
  }

  return stops;
}

export function getMarqueeBaySize(width: number, height: number) {
  return width % 5000 === 0 && height % 5000 === 0 ? 5000 : 3000;
}

export function getMarqueeWallThickness(width: number, height: number) {
  return getMarqueeBaySize(width, height) === 5000 ? 150 : 75;
}

export function getMarqueeGeometry(
  width: number,
  height: number,
  wallThickness?: number
): MarqueeGeometry {
  const baySize = getMarqueeBaySize(width, height);
  const resolvedWallThickness = wallThickness ?? getMarqueeWallThickness(width, height);
  const markerSize = baySize === 5000 ? 100 : 75;
  const xs = createAxisStops(width, baySize);
  const ys = createAxisStops(height, baySize);
  const seen = new Set<string>();
  const markerCenters: { x: number; y: number }[] = [];

  const addMarker = (x: number, y: number) => {
    const key = `${Math.round(x)}:${Math.round(y)}`;
    if (seen.has(key)) return;
    seen.add(key);
    markerCenters.push({ x, y });
  };

  xs.forEach((x) => {
    addMarker(x, 0);
    addMarker(x, height);
  });

  ys.forEach((y) => {
    addMarker(0, y);
    addMarker(width, y);
  });

  return {
    baySize,
    wallThickness: Math.max(50, Math.min(resolvedWallThickness, Math.min(width, height) / 4)),
    markerSize,
    innerGuideDashArray: baySize === 3000 ? '60 90' : null,
    markerCenters,
  };
}
