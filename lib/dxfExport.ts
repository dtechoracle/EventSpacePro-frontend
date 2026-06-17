import { AssetInstance } from "@/store/sceneStore";

type UnitSystem = "metric-mm" | "metric-m" | "imperial-ft";

type DxfPoint = {
  x: number;
  y: number;
};

type DxfLikeItem = AssetInstance & Record<string, any>;

const SVG_NS = "http://www.w3.org/2000/svg";

const toCadPoint = (point: DxfPoint): DxfPoint => ({
  x: point.x,
  y: -point.y,
});

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

const rotatePoint = (point: DxfPoint, rotationDeg: number): DxfPoint => {
  const radians = toRadians(rotationDeg || 0);
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  };
};

const transformLocalPoint = (item: DxfLikeItem, point: DxfPoint): DxfPoint => {
  const rotated = rotatePoint(point, item.rotation || 0);
  return {
    x: (item.x || 0) + rotated.x,
    y: (item.y || 0) + rotated.y,
  };
};

const pair = (code: number | string, value: string | number) => `${code}\n${value}\n`;

const lineEntity = (layer: string, start: DxfPoint, end: DxfPoint) => {
  const a = toCadPoint(start);
  const b = toCadPoint(end);
  return (
    pair(0, "LINE") +
    pair(8, layer) +
    pair(10, a.x) +
    pair(20, a.y) +
    pair(30, 0) +
    pair(11, b.x) +
    pair(21, b.y) +
    pair(31, 0)
  );
};

const polylineEntity = (layer: string, points: DxfPoint[], closed = false) => {
  if (points.length < 2) return "";

  let entity =
    pair(0, "LWPOLYLINE") +
    pair(8, layer) +
    pair(90, points.length) +
    pair(70, closed ? 1 : 0);

  points.forEach((point) => {
    const cadPoint = toCadPoint(point);
    entity += pair(10, cadPoint.x) + pair(20, cadPoint.y);
  });

  return entity;
};

const textEntity = (layer: string, point: DxfPoint, text: string, height: number, rotation = 0) => {
  if (!text.trim()) return "";
  const cadPoint = toCadPoint(point);
  return (
    pair(0, "TEXT") +
    pair(8, layer) +
    pair(10, cadPoint.x) +
    pair(20, cadPoint.y) +
    pair(30, 0) +
    pair(40, height) +
    pair(1, text) +
    pair(50, -rotation)
  );
};

const ensureClosed = (points: DxfPoint[]) => {
  if (points.length < 2) return points;
  const first = points[0];
  const last = points[points.length - 1];
  if (Math.abs(first.x - last.x) < 0.001 && Math.abs(first.y - last.y) < 0.001) {
    return points;
  }
  return [...points, first];
};

const sampleEllipse = (item: DxfLikeItem, segments = 48): DxfPoint[] => {
  const rx = (item.width || 0) / 2;
  const ry = (item.height || 0) / 2;
  const points: DxfPoint[] = [];

  for (let i = 0; i < segments; i++) {
    const t = (Math.PI * 2 * i) / segments;
    points.push(
      transformLocalPoint(item, {
        x: Math.cos(t) * rx,
        y: Math.sin(t) * ry,
      })
    );
  }

  return points;
};

const sampleRect = (item: DxfLikeItem): DxfPoint[] => {
  const halfW = (item.width || 0) / 2;
  const halfH = (item.height || 0) / 2;
  return [
    transformLocalPoint(item, { x: -halfW, y: -halfH }),
    transformLocalPoint(item, { x: halfW, y: -halfH }),
    transformLocalPoint(item, { x: halfW, y: halfH }),
    transformLocalPoint(item, { x: -halfW, y: halfH }),
  ];
};

const sampleRegularPolygon = (item: DxfLikeItem, sides: number): DxfPoint[] => {
  const radius = Math.min(item.width || 0, item.height || 0) / 2;
  const points: DxfPoint[] = [];

  for (let i = 0; i < sides; i++) {
    const angle = ((Math.PI * 2) / sides) * i - Math.PI / 2;
    points.push(
      transformLocalPoint(item, {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
      })
    );
  }

  return points;
};

const sampleSvgPath = (svgPath: string, item: DxfLikeItem): DxfPoint[] => {
  if (typeof document === "undefined" || !svgPath.trim()) return [];

  try {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", svgPath);
    const totalLength = path.getTotalLength();
    const segmentCount = Math.max(24, Math.ceil(totalLength / 80));
    const points: DxfPoint[] = [];

    for (let i = 0; i <= segmentCount; i++) {
      const pt = path.getPointAtLength((totalLength * i) / segmentCount);
      points.push(transformLocalPoint(item, { x: pt.x, y: pt.y }));
    }

    return points;
  } catch {
    return [];
  }
};

const parseArcThroughThreePoints = (a: DxfPoint, b: DxfPoint, c: DxfPoint) => {
  const d =
    2 *
    (a.x * (b.y - c.y) +
      b.x * (c.y - a.y) +
      c.x * (a.y - b.y));

  if (Math.abs(d) < 0.0001) return null;

  const ux =
    ((a.x * a.x + a.y * a.y) * (b.y - c.y) +
      (b.x * b.x + b.y * b.y) * (c.y - a.y) +
      (c.x * c.x + c.y * c.y) * (a.y - b.y)) /
    d;
  const uy =
    ((a.x * a.x + a.y * a.y) * (c.x - b.x) +
      (b.x * b.x + b.y * b.y) * (a.x - c.x) +
      (c.x * c.x + c.y * c.y) * (b.x - a.x)) /
    d;

  const center = { x: ux, y: uy };
  const radius = Math.hypot(a.x - ux, a.y - uy);
  return { center, radius };
};

const sampleArc = (item: DxfLikeItem): DxfPoint[] => {
  if (!item.points || item.points.length < 3) return [];

  const start = transformLocalPoint(item, item.points[0]);
  const mid = transformLocalPoint(item, item.points[1]);
  const end = transformLocalPoint(item, item.points[2]);
  const arc = parseArcThroughThreePoints(start, mid, end);
  if (!arc) return [start, mid, end];

  const { center, radius } = arc;
  let startAngle = Math.atan2(start.y - center.y, start.x - center.x);
  let midAngle = Math.atan2(mid.y - center.y, mid.x - center.x);
  let endAngle = Math.atan2(end.y - center.y, end.x - center.x);

  const normalize = (angle: number) => {
    let next = angle;
    while (next < 0) next += Math.PI * 2;
    while (next >= Math.PI * 2) next -= Math.PI * 2;
    return next;
  };

  startAngle = normalize(startAngle);
  midAngle = normalize(midAngle);
  endAngle = normalize(endAngle);

  const ccwContainsMid = (() => {
    let s = startAngle;
    let e = endAngle;
    let m = midAngle;
    if (e < s) e += Math.PI * 2;
    if (m < s) m += Math.PI * 2;
    return m >= s && m <= e;
  })();

  let from = startAngle;
  let to = endAngle;
  if (!ccwContainsMid) {
    if (to > from) from += Math.PI * 2;
    else to += Math.PI * 2;
  } else if (to < from) {
    to += Math.PI * 2;
  }

  const points: DxfPoint[] = [];
  const stepCount = 24;
  for (let i = 0; i <= stepCount; i++) {
    const angle = from + ((to - from) * i) / stepCount;
    points.push({
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
    });
  }

  return points;
};

const assetFootprintPoints = (item: DxfLikeItem) => {
  const scaledWidth = (item.width || 0) * (item.scale || 1);
  const scaledHeight = (item.height || 0) * (item.scale || 1);
  const footprintItem = { ...item, width: scaledWidth, height: scaledHeight };
  return sampleRect(footprintItem);
};

const wallSegmentPolygon = (start: DxfPoint, end: DxfPoint, thickness: number): DxfPoint[] => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 0.001) return [];

  const px = (-dy / length) * (thickness / 2);
  const py = (dx / length) * (thickness / 2);

  return [
    { x: start.x + px, y: start.y + py },
    { x: end.x + px, y: end.y + py },
    { x: end.x - px, y: end.y - py },
    { x: start.x - px, y: start.y - py },
  ];
};

const formatDimensionValue = (mmValue: number, unitSystem: UnitSystem): string => {
  if (unitSystem === "imperial-ft") return `${(mmValue / 304.8).toFixed(2)} ft`;
  if (unitSystem === "metric-m") return `${(mmValue / 1000).toFixed(2)} m`;
  return `${Math.round(mmValue)} mm`;
};

const markerTriangle = (point: DxfPoint, direction: DxfPoint, size: number): DxfPoint[] => {
  const length = Math.hypot(direction.x, direction.y) || 1;
  const ux = direction.x / length;
  const uy = direction.y / length;
  const px = -uy;
  const py = ux;
  const baseX = point.x - ux * size;
  const baseY = point.y - uy * size;
  const side = size * 0.48;

  return [
    point,
    { x: baseX + px * side, y: baseY + py * side },
    { x: baseX - px * side, y: baseY - py * side },
  ];
};

const shapeEntities = (item: DxfLikeItem) => {
  const layer = "SHAPES";
  const type = item.type;

  if (type === "rectangle") {
    return polylineEntity(layer, sampleRect(item), true);
  }

  if (type === "circle" || type === "ellipse") {
    return polylineEntity(layer, sampleEllipse(item), true);
  }

  if (type === "polygon") {
    const points =
      item.points && item.points.length >= 3
        ? item.points.map((point: DxfPoint) => transformLocalPoint(item, point))
        : sampleRegularPolygon(item, Math.max(3, item.polygonSides || 4));
    return polylineEntity(layer, points, true);
  }

  if (type === "line") {
    if (item.points && item.points.length >= 2) {
      return polylineEntity(
        layer,
        item.points.map((point: DxfPoint) => transformLocalPoint(item, point)),
        false
      );
    }

    return lineEntity(
      layer,
      transformLocalPoint(item, { x: -(item.width || 0) / 2, y: 0 }),
      transformLocalPoint(item, { x: (item.width || 0) / 2, y: 0 })
    );
  }

  if (type === "arrow") {
    let entities = "";
    let points: DxfPoint[] = [];

    if (item.points && item.points.length >= 2) {
      points = item.points.map((point: DxfPoint) => transformLocalPoint(item, point));
      entities += polylineEntity(layer, points, false);
    } else {
      points = [
        transformLocalPoint(item, { x: -(item.width || 0) / 2, y: 0 }),
        transformLocalPoint(item, { x: (item.width || 0) / 2, y: 0 }),
      ];
      entities += lineEntity(layer, points[0], points[1]);
    }

    if (points.length >= 2) {
      const head = markerTriangle(points[points.length - 1], {
        x: points[points.length - 1].x - points[points.length - 2].x,
        y: points[points.length - 1].y - points[points.length - 2].y,
      }, 120);
      entities += polylineEntity(layer, head, true);
    }

    return entities;
  }

  if (type === "arc") {
    return polylineEntity(layer, sampleArc(item), false);
  }

  if (type === "freehand") {
    const points = (item.points || []).map((point: DxfPoint) => transformLocalPoint(item, point));
    return polylineEntity(layer, points, false);
  }

  if (type === "path") {
    const points = item.svgPath ? sampleSvgPath(item.svgPath, item) : [];
    if (points.length > 1) {
      const closed = /z\s*$/i.test((item.svgPath || "").trim()) || /z/i.test(item.svgPath || "");
      return polylineEntity(layer, closed ? ensureClosed(points).slice(0, -1) : points, closed);
    }
  }

  return "";
};

const wallEntities = (item: DxfLikeItem) => {
  let entities = "";
  const nodes = item.wallNodes || [];
  const edges = item.wallEdges || [];
  const thickness = item.wallThickness || 150;

  edges.forEach((edge: any) => {
    const start = nodes[edge.a];
    const end = nodes[edge.b];
    if (!start || !end) return;

    const polygon = wallSegmentPolygon(start, end, thickness);
    if (polygon.length) entities += polylineEntity("WALLS", polygon, true);
    entities += lineEntity("WALL_CENTERLINES", start, end);
  });

  return entities;
};

const dimensionEntities = (item: DxfLikeItem, unitSystem: UnitSystem) => {
  const start = item.startPoint;
  const end = item.endPoint;
  if (!start || !end) return "";

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 0.001) return "";

  const nx = dx / length;
  const ny = dy / length;
  const px = -ny;
  const py = nx;
  const offset = item.offset ?? 400;
  let sign = Math.sign(offset || 1) || 1;
  if (item.labelPosition === "top-right") sign = -1;
  if (item.labelPosition === "bottom-left") sign = 1;
  const finalOffset = item.labelPosition ? Math.abs(offset) * sign : offset;
  const extensionGap = Math.min(Math.abs(finalOffset) * 0.45, 10);
  const overshoot = 10;
  const p1 = { x: start.x + px * finalOffset, y: start.y + py * finalOffset };
  const p2 = { x: end.x + px * finalOffset, y: end.y + py * finalOffset };
  const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  const arrowSize = 100;
  const textHeight = Math.max(80, (item.fontSize || 11) * 8);
  const text = item.type === "radial" || item.type === "circular"
    ? `R ${Math.round(item.value || length)}`
    : formatDimensionValue(item.value !== undefined ? item.value : length, unitSystem);

  let entities = "";
  entities += lineEntity("DIMENSIONS", { x: start.x + px * extensionGap, y: start.y + py * extensionGap }, { x: p1.x + px * overshoot, y: p1.y + py * overshoot });
  entities += lineEntity("DIMENSIONS", { x: end.x + px * extensionGap, y: end.y + py * extensionGap }, { x: p2.x + px * overshoot, y: p2.y + py * overshoot });
  entities += lineEntity("DIMENSIONS", p1, p2);
  entities += lineEntity("DIMENSIONS", p1, { x: p1.x + nx * arrowSize, y: p1.y + ny * arrowSize });
  entities += lineEntity("DIMENSIONS", p2, { x: p2.x - nx * arrowSize, y: p2.y - ny * arrowSize });
  entities += textEntity("DIMENSIONS", mid, text, textHeight, Math.atan2(dy, dx) * (180 / Math.PI));
  return entities;
};

const labelArrowEntities = (item: DxfLikeItem) => {
  const start = item.startPoint;
  const end = item.endPoint;
  if (!start || !end) return "";

  let entities = lineEntity("ANNOTATIONS", start, end);
  const head = markerTriangle(end, { x: end.x - start.x, y: end.y - start.y }, 120);
  entities += polylineEntity("ANNOTATIONS", head, true);

  const textHeight = Math.max(90, (item.fontSize || 16) * 8);
  const labelPosition = item.textPosition || "bottom";
  const t = labelPosition === "top" ? 0.86 : labelPosition === "middle" ? 0.5 : 0.14;
  const labelPoint = {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
  };

  entities += textEntity(
    "ANNOTATIONS",
    labelPoint,
    item.label || "",
    textHeight,
    Math.atan2(end.y - start.y, end.x - start.x) * (180 / Math.PI)
  );

  return entities;
};

const textAnnotationEntities = (item: DxfLikeItem) => {
  const textHeight = Math.max(90, (item.fontSize || 16) * 8);
  return textEntity("ANNOTATIONS", { x: item.x || 0, y: item.y || 0 }, item.text || "", textHeight, item.rotation || 0);
};

const assetEntities = (item: DxfLikeItem) => {
  let entities = polylineEntity("ASSETS", assetFootprintPoints(item), true);

  const label = item.showTableName ? item.tableName || item.name || item.type : "";
  if (label) {
    entities += textEntity("ASSETS", { x: item.x || 0, y: item.y || 0 }, label, 120, item.rotation || 0);
  }

  return entities;
};

const itemToEntities = (item: DxfLikeItem, unitSystem: UnitSystem) => {
  if (item.type === "wall-segments" && item.wallNodes && item.wallEdges) return wallEntities(item);
  if (item.type === "dimension") return dimensionEntities(item, unitSystem);
  if (item.type === "label-arrow") return labelArrowEntities(item);
  if (item.type === "text-annotation") return textAnnotationEntities(item);

  const shapeTypes = new Set([
    "rectangle",
    "circle",
    "ellipse",
    "line",
    "arrow",
    "freehand",
    "polygon",
    "arc",
    "path",
  ]);

  if (shapeTypes.has(item.type)) return shapeEntities(item);
  return assetEntities(item);
};

const layerTable = (layers: string[]) => {
  let section = pair(0, "SECTION") + pair(2, "TABLES");
  section += pair(0, "TABLE") + pair(2, "LAYER") + pair(70, layers.length);

  layers.forEach((layer) => {
    section +=
      pair(0, "LAYER") +
      pair(2, layer) +
      pair(70, 0) +
      pair(62, 7) +
      pair(6, "CONTINUOUS");
  });

  section += pair(0, "ENDTAB");
  section += pair(0, "ENDSEC");
  return section;
};

const sanitizeFilename = (value: string) =>
  (value || "layout")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

export const buildDxf = (items: DxfLikeItem[], unitSystem: UnitSystem) => {
  const layers = ["ASSETS", "SHAPES", "WALLS", "WALL_CENTERLINES", "ANNOTATIONS", "DIMENSIONS"];

  let entities = "";
  items.forEach((item) => {
    entities += itemToEntities(item, unitSystem);
  });

  return (
    pair(0, "SECTION") +
    pair(2, "HEADER") +
    pair(9, "$ACADVER") +
    pair(1, "AC1015") +
    pair(9, "$INSUNITS") +
    pair(70, 4) +
    pair(0, "ENDSEC") +
    layerTable(layers) +
    pair(0, "SECTION") +
    pair(2, "ENTITIES") +
    entities +
    pair(0, "ENDSEC") +
    pair(0, "EOF")
  );
};

export const downloadDxf = (items: DxfLikeItem[], unitSystem: UnitSystem, projectName?: string) => {
  const dxf = buildDxf(items, unitSystem);
  const blob = new Blob([dxf], { type: "application/dxf;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${sanitizeFilename(projectName || "layout") || "layout"}-${Date.now()}.dxf`;
  anchor.click();
  URL.revokeObjectURL(url);
};
