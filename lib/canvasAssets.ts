/**
 * Reading `Event.canvasAssets`, which is written in two different shapes.
 *
 * The backend collaboration flush persists the room's Yjs document as a keyed
 * collection object:
 *
 *   { yShapes: { [id]: shape }, yAssets: {...}, yWalls: {...}, yCanvas: { config } }
 *
 * The older REST save wrote a flat array of asset instances. Every consumer in
 * this app was written against the array — the editor's fallback is guarded by
 * `Array.isArray(canvasAssets)`, and the dashboard cards are typed
 * `AssetInstance[]` — so once an event had been edited collaboratively, nothing
 * could read its canvas back: the editor opened blank and the thumbnails
 * rendered garbage. Normalise here, once, instead of teaching every caller
 * about both shapes.
 *
 * Collections the flush may omit entirely (Mongo drops empty sub-objects) read
 * as empty rather than throwing.
 */

export const COLLABORATION_COLLECTION_MAPS = [
  "yAssets",
  "yWalls",
  "yShapes",
  "yAnnotations",
  "yArrows",
  "yDimensions",
  "yGroups",
  "yWallSegments",
  "yComments",
  "yCanvas",
] as const;

/** True when `value` is the keyed object the collaboration flush writes. */
export const isCollaborationCanvasShape = (value: any): boolean =>
  !!value &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  COLLABORATION_COLLECTION_MAPS.some((key) => key in value);

const valuesOf = (source: any, key: string): any[] => {
  const value = source?.[key];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value && typeof value === "object") {
    return Object.values(value).filter(Boolean) as any[];
  }
  return [];
};

export type NormalizedCanvasData = {
  shapes: any[];
  assets: any[];
  walls: any[];
  wallSegments: any[];
  textAnnotations: any[];
  dimensions: any[];
  labelArrows: any[];
  groups: any[];
  comments: any[];
  canvas?: any;
};

/**
 * Turn a collaboration `canvasAssets` object into the `canvasData` shape the
 * editor and the project store already know how to load.
 */
export const canvasDataFromCollaborationAssets = (
  canvasAssets: any,
): NormalizedCanvasData => ({
  shapes: valuesOf(canvasAssets, "yShapes"),
  assets: valuesOf(canvasAssets, "yAssets"),
  walls: valuesOf(canvasAssets, "yWalls"),
  wallSegments: valuesOf(canvasAssets, "yWallSegments"),
  textAnnotations: valuesOf(canvasAssets, "yAnnotations"),
  dimensions: valuesOf(canvasAssets, "yDimensions"),
  labelArrows: valuesOf(canvasAssets, "yArrows"),
  groups: valuesOf(canvasAssets, "yGroups"),
  comments: valuesOf(canvasAssets, "yComments"),
  canvas: canvasAssets?.yCanvas?.config || canvasAssets?.yCanvas?.canvas,
});

/**
 * Flatten either shape into the single array the dashboard preview components
 * expect. Order matters only for painting, so walls go down first.
 */
export const flattenCanvasAssets = (canvasAssets: any): any[] => {
  if (Array.isArray(canvasAssets)) return canvasAssets.filter(Boolean);
  if (!isCollaborationCanvasShape(canvasAssets)) return [];

  const data = canvasDataFromCollaborationAssets(canvasAssets);
  return [
    ...data.walls,
    ...data.wallSegments,
    ...data.shapes,
    ...data.assets,
    ...data.textAnnotations,
    ...data.dimensions,
    ...data.labelArrows,
  ];
};

/** True when a normalized document actually has something to draw. */
export const hasCanvasContent = (data: NormalizedCanvasData): boolean =>
  data.shapes.length > 0 ||
  data.assets.length > 0 ||
  data.walls.length > 0 ||
  data.wallSegments.length > 0 ||
  data.textAnnotations.length > 0 ||
  data.dimensions.length > 0 ||
  data.labelArrows.length > 0;

/**
 * Event objects handed to the dashboard preview components, whose props are
 * typed `AssetInstance[]`. Applied where events are fetched for cards, so a
 * collaboration-shaped `canvasAssets` does not reach a `.map()` that expects an
 * array — which is what turned the thumbnails into garbage.
 */
export const withPreviewableCanvasAssets = <T extends { canvasAssets?: any }>(
  event: T,
): T => {
  if (!event || Array.isArray(event.canvasAssets)) return event;
  if (!isCollaborationCanvasShape(event.canvasAssets)) return event;
  return { ...event, canvasAssets: flattenCanvasAssets(event.canvasAssets) };
};
