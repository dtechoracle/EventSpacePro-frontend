import { AssetInstance } from "@/store/sceneStore";

// Wall geometry helper types
export type WallSegment = {
  start: { x: number; y: number };
  end: { x: number; y: number };
};

export type WallGeometry = {
  outerPoints: { x: number; y: number }[];
  innerPoints: { x: number; y: number }[];
};

// Helper function to calculate line intersection
export function calculateLineIntersection(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  p4: { x: number; y: number }
): { x: number; y: number } | null {
  const denom = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);

  if (Math.abs(denom) < 1e-10) {
    // Lines are parallel
    return null;
  }

  const t =
    ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / denom;

  return {
    x: p1.x + t * (p2.x - p1.x),
    y: p1.y + t * (p2.y - p1.y),
  };
}

// Helper function to calculate wall geometry with clean rectangular corners
export function buildWallGeometry(
  segments: WallSegment[],
  wallGap: number
): WallGeometry {
  if (segments.length === 0) {
    return { outerPoints: [], innerPoints: [] };
  }

  if (segments.length === 1) {
    // Single segment - with a truncated start cap
    const segment = segments[0];
    const dx = segment.end.x - segment.start.x;
    const dy = segment.end.y - segment.start.y;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length === 0) {
      return { outerPoints: [], innerPoints: [] };
    }

    const angle = Math.atan2(dy, dx);
    const perpX = Math.cos(angle + Math.PI / 2) * (wallGap / 2);
    const perpY = Math.sin(angle + Math.PI / 2) * (wallGap / 2);
    const normX = dx / length;
    const normY = dy / length;
    const capOffset = wallGap / 2; // advance the start to create a beveled cap
    const startAdv = {
      x: segment.start.x + normX * capOffset,
      y: segment.start.y + normY * capOffset,
    };

    return {
      outerPoints: [
        { x: startAdv.x + perpX, y: startAdv.y + perpY },
        { x: segment.end.x + perpX, y: segment.end.y + perpY },
      ],
      innerPoints: [
        { x: startAdv.x - perpX, y: startAdv.y - perpY },
        { x: segment.end.x - perpX, y: segment.end.y - perpY },
      ],
    };
  }

  // For multiple segments, create a continuous outline
  const outerPoints: { x: number; y: number }[] = [];
  const innerPoints: { x: number; y: number }[] = [];

  // Check if this is a closed loop (last segment ends at first segment start)
  const isClosedLoop =
    segments.length > 2 &&
    Math.abs(segments[segments.length - 1].end.x - segments[0].start.x) < 1 &&
    Math.abs(segments[segments.length - 1].end.y - segments[0].start.y) < 1;

  // Process each segment to create continuous outline
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const dx = segment.end.x - segment.start.x;
    const dy = segment.end.y - segment.start.y;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length === 0) continue;

    const angle = Math.atan2(dy, dx);
    const perpX = Math.cos(angle + Math.PI / 2) * (wallGap / 2);
    const perpY = Math.sin(angle + Math.PI / 2) * (wallGap / 2);

    if (i === 0) {
      if (isClosedLoop) {
        // Closed loop: compute the START corner using the LAST segment to avoid a notch at the join
        const prev = segments[segments.length - 1];
        const pdx = prev.end.x - prev.start.x;
        const pdy = prev.end.y - prev.start.y;
        const plen = Math.sqrt(pdx * pdx + pdy * pdy);
        if (plen > 0) {
          const pAngle = Math.atan2(pdy, pdx);
          const pPerpX = Math.cos(pAngle + Math.PI / 2) * (wallGap / 2);
          const pPerpY = Math.sin(pAngle + Math.PI / 2) * (wallGap / 2);
          const cornerPoint = { x: segment.start.x, y: segment.start.y };
          const outerIntersection = calculateLineIntersection(
            { x: cornerPoint.x + pPerpX, y: cornerPoint.y + pPerpY },
            { x: cornerPoint.x + pdx, y: cornerPoint.y + pdy },
            { x: cornerPoint.x + perpX, y: cornerPoint.y + perpY },
            { x: cornerPoint.x + dx, y: cornerPoint.y + dy }
          );
          const innerIntersection = calculateLineIntersection(
            { x: cornerPoint.x - pPerpX, y: cornerPoint.y - pPerpY },
            { x: cornerPoint.x + pdx, y: cornerPoint.y + pdy },
            { x: cornerPoint.x - perpX, y: cornerPoint.y - perpY },
            { x: cornerPoint.x + dx, y: cornerPoint.y + dy }
          );
          outerPoints.push(
            outerIntersection ?? {
              x: cornerPoint.x + perpX,
              y: cornerPoint.y + perpY,
            }
          );
          innerPoints.push(
            innerIntersection ?? {
              x: cornerPoint.x - perpX,
              y: cornerPoint.y - perpY,
            }
          );
        } else {
          // Fallback if previous has zero length
          outerPoints.push({
            x: segment.start.x + perpX,
            y: segment.start.y + perpY,
          });
          innerPoints.push({
            x: segment.start.x - perpX,
            y: segment.start.y - perpY,
          });
        }
      } else {
        // Open path: no top cap — start directly at perpendicular offsets
        outerPoints.push({
          x: segment.start.x + perpX,
          y: segment.start.y + perpY,
        });
        innerPoints.push({
          x: segment.start.x - perpX,
          y: segment.start.y - perpY,
        });
      }
    }

    // For the end of each segment, calculate the corner intersection
    const nextSegment =
      isClosedLoop && i === segments.length - 1
        ? segments[0] // For closed loops, last segment connects to first segment
        : segments[i + 1];

    // If this is a closed loop, we also need to compute the corner between the
    // last and first segments. Previously this branch skipped the last corner,
    // causing the start/end corner to remain un-mitered.
    if (nextSegment && (isClosedLoop || i < segments.length - 1)) {
      // There's a next segment - calculate corner intersection
      const nextDx = nextSegment.end.x - nextSegment.start.x;
      const nextDy = nextSegment.end.y - nextSegment.start.y;
      const nextLength = Math.sqrt(nextDx * nextDx + nextDy * nextDy);

      if (nextLength > 0) {
        const nextAngle = Math.atan2(nextDy, nextDx);
        const nextPerpX = Math.cos(nextAngle + Math.PI / 2) * (wallGap / 2);
        const nextPerpY = Math.sin(nextAngle + Math.PI / 2) * (wallGap / 2);

        // Calculate intersection points for the corner
        const cornerPoint = { x: segment.end.x, y: segment.end.y };

        // Calculate outer corner intersection
        const outerIntersection = calculateLineIntersection(
          { x: cornerPoint.x + perpX, y: cornerPoint.y + perpY },
          { x: cornerPoint.x + dx, y: cornerPoint.y + dy },
          { x: cornerPoint.x + nextPerpX, y: cornerPoint.y + nextPerpY },
          { x: cornerPoint.x + nextDx, y: cornerPoint.y + nextDy }
        );

        // Calculate inner corner intersection
        const innerIntersection = calculateLineIntersection(
          { x: cornerPoint.x - perpX, y: cornerPoint.y - perpY },
          { x: cornerPoint.x + dx, y: cornerPoint.y + dy },
          { x: cornerPoint.x - nextPerpX, y: cornerPoint.y - nextPerpY },
          { x: cornerPoint.x + nextDx, y: cornerPoint.y + nextDy }
        );

        // Use intersection points if they exist, otherwise fall back to perpendicular offsets
        if (outerIntersection) {
          outerPoints.push(outerIntersection);
        } else {
          outerPoints.push({
            x: cornerPoint.x + perpX,
            y: cornerPoint.y + perpY,
          });
        }

        if (innerIntersection) {
          innerPoints.push(innerIntersection);
        } else {
          innerPoints.push({
            x: cornerPoint.x - perpX,
            y: cornerPoint.y - perpY,
          });
        }
      } else {
        // Next segment has zero length, use perpendicular offset
        outerPoints.push({
          x: segment.end.x + perpX,
          y: segment.end.y + perpY,
        });
        innerPoints.push({
          x: segment.end.x - perpX,
          y: segment.end.y - perpY,
        });
      }
    } else {
      // Last segment (non-closed loop) - end with perpendicular offset
      outerPoints.push({
        x: segment.end.x + perpX,
        y: segment.end.y + perpY,
      });
      innerPoints.push({
        x: segment.end.x - perpX,
        y: segment.end.y - perpY,
      });
    }
  }

  return { outerPoints, innerPoints };
}

// Helper function to detect if a point is close to any wall segment
export function findNearbyWallSegment(
  point: { x: number; y: number },
  wallAssets: AssetInstance[],
  threshold: number = 5
): { asset: AssetInstance; segmentIndex: number; isStart: boolean } | null {
  for (const asset of wallAssets) {
    if (!asset.wallSegments) continue;

    for (let i = 0; i < asset.wallSegments.length; i++) {
      const segment = asset.wallSegments[i];

      // Check distance to start point
      const distToStart = Math.sqrt(
        Math.pow(point.x - segment.start.x, 2) +
        Math.pow(point.y - segment.start.y, 2)
      );

      if (distToStart <= threshold) {
        return { asset, segmentIndex: i, isStart: true };
      }

      // Check distance to end point
      const distToEnd = Math.sqrt(
        Math.pow(point.x - segment.end.x, 2) +
        Math.pow(point.y - segment.end.y, 2)
      );

      if (distToEnd <= threshold) {
        return { asset, segmentIndex: i, isStart: false };
      }
    }
  }

  return null;
}

// Helper function to find intersections between two wall segments
export function findWallIntersection(
  segment1: { start: { x: number; y: number }; end: { x: number; y: number } },
  segment2: { start: { x: number; y: number }; end: { x: number; y: number } }
): { x: number; y: number } | null {
  return calculateLineIntersection(
    segment1.start,
    segment1.end,
    segment2.start,
    segment2.end
  );
}

// Helper function to create wall geometry with intersection gaps
export function buildWallGeometryWithIntersections(
  segments: WallSegment[],
  wallGap: number
): WallGeometry {
  if (segments.length === 0) {
    return { outerPoints: [], innerPoints: [] };
  }

  if (segments.length === 1) {
    // Single segment - simple parallel lines
    const segment = segments[0];
    const dx = segment.end.x - segment.start.x;
    const dy = segment.end.y - segment.start.y;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length === 0) {
      return { outerPoints: [], innerPoints: [] };
    }

    const angle = Math.atan2(dy, dx);
    const perpX = Math.cos(angle + Math.PI / 2) * (wallGap / 2);
    const perpY = Math.sin(angle + Math.PI / 2) * (wallGap / 2);

    return {
      outerPoints: [
        { x: segment.start.x + perpX, y: segment.start.y + perpY },
        { x: segment.end.x + perpX, y: segment.end.y + perpY },
      ],
      innerPoints: [
        { x: segment.start.x - perpX, y: segment.start.y - perpY },
        { x: segment.end.x - perpX, y: segment.end.y - perpY },
      ],
    };
  }

  // For multiple segments, create a continuous outline
  const outerPoints: { x: number; y: number }[] = [];
  const innerPoints: { x: number; y: number }[] = [];

  // Check if this is a closed loop (last segment ends at first segment start)
  const isClosedLoop =
    segments.length > 2 &&
    Math.abs(segments[segments.length - 1].end.x - segments[0].start.x) < 1 &&
    Math.abs(segments[segments.length - 1].end.y - segments[0].start.y) < 1;

  // Process each segment to create continuous outline
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const dx = segment.end.x - segment.start.x;
    const dy = segment.end.y - segment.start.y;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length === 0) continue;

    const angle = Math.atan2(dy, dx);
    const perpX = Math.cos(angle + Math.PI / 2) * (wallGap / 2);
    const perpY = Math.sin(angle + Math.PI / 2) * (wallGap / 2);

    if (i === 0) {
      // First segment - start with perpendicular offset
      outerPoints.push({
        x: segment.start.x + perpX,
        y: segment.start.y + perpY,
      });
      innerPoints.push({
        x: segment.start.x - perpX,
        y: segment.start.y - perpY,
      });
    }

    // For the end of each segment, calculate the corner intersection
    const nextSegment =
      isClosedLoop && i === segments.length - 1
        ? segments[0] // For closed loops, last segment connects to first segment
        : segments[i + 1];

    if (nextSegment && i < segments.length - 1) {
      // There's a next segment - calculate corner intersection
      const nextDx = nextSegment.end.x - nextSegment.start.x;
      const nextDy = nextSegment.end.y - nextSegment.start.y;
      const nextLength = Math.sqrt(nextDx * nextDx + nextDy * nextDy);

      if (nextLength > 0) {
        const nextAngle = Math.atan2(nextDy, nextDx);
        const nextPerpX = Math.cos(nextAngle + Math.PI / 2) * (wallGap / 2);
        const nextPerpY = Math.sin(nextAngle + Math.PI / 2) * (wallGap / 2);

        // Calculate intersection points for the corner
        const cornerPoint = { x: segment.end.x, y: segment.end.y };

        // Calculate outer corner intersection
        const outerIntersection = calculateLineIntersection(
          { x: cornerPoint.x + perpX, y: cornerPoint.y + perpY },
          { x: cornerPoint.x + dx, y: cornerPoint.y + dy },
          { x: cornerPoint.x + nextPerpX, y: cornerPoint.y + nextPerpY },
          { x: cornerPoint.x + nextDx, y: cornerPoint.y + nextDy }
        );

        // Calculate inner corner intersection
        const innerIntersection = calculateLineIntersection(
          { x: cornerPoint.x - perpX, y: cornerPoint.y - perpY },
          { x: cornerPoint.x + dx, y: cornerPoint.y + dy },
          { x: cornerPoint.x - nextPerpX, y: cornerPoint.y - nextPerpY },
          { x: cornerPoint.x + nextDx, y: cornerPoint.y + nextDy }
        );

        // Use intersection points if they exist, otherwise fall back to perpendicular offsets
        if (outerIntersection) {
          outerPoints.push(outerIntersection);
        } else {
          outerPoints.push({
            x: cornerPoint.x + perpX,
            y: cornerPoint.y + perpY,
          });
        }

        if (innerIntersection) {
          innerPoints.push(innerIntersection);
        } else {
          innerPoints.push({
            x: cornerPoint.x - perpX,
            y: cornerPoint.y - perpY,
          });
        }
      } else {
        // Next segment has zero length, use perpendicular offset
        outerPoints.push({
          x: segment.end.x + perpX,
          y: segment.end.y + perpY,
        });
        innerPoints.push({
          x: segment.end.x - perpX,
          y: segment.end.y - perpY,
        });
      }
    } else {
      // Last segment (non-closed loop) - end with perpendicular offset
      outerPoints.push({
        x: segment.end.x + perpX,
        y: segment.end.y + perpY,
      });
      innerPoints.push({
        x: segment.end.x - perpX,
        y: segment.end.y - perpY,
      });
    }
  }

  return { outerPoints, innerPoints };
}

// Helper function to merge wall segments when they connect
export function mergeWallSegments(
  currentSegments: {
    start: { x: number; y: number };
    end: { x: number; y: number };
  }[],
  existingAsset: AssetInstance
): { start: { x: number; y: number }; end: { x: number; y: number } }[] {
  if (!existingAsset.wallSegments) return currentSegments;

  // Convert existing asset segments to absolute coordinates
  const existingSegments = existingAsset.wallSegments.map((segment) => ({
    start: {
      x: segment.start.x + existingAsset.x,
      y: segment.start.y + existingAsset.y,
    },
    end: {
      x: segment.end.x + existingAsset.x,
      y: segment.end.y + existingAsset.y,
    },
  }));

  // Combine all segments
  const allSegments = [...existingSegments, ...currentSegments];

  // Remove duplicates and merge connected segments
  const mergedSegments: {
    start: { x: number; y: number };
    end: { x: number; y: number };
  }[] = [];

  for (const segment of allSegments) {
    // Check if this segment connects to any existing merged segment
    let connected = false;

    for (let i = 0; i < mergedSegments.length; i++) {
      const merged = mergedSegments[i];

      // Check if segment connects to merged segment start
      if (
        Math.abs(segment.end.x - merged.start.x) < 1 &&
        Math.abs(segment.end.y - merged.start.y) < 1
      ) {
        mergedSegments[i] = { start: segment.start, end: merged.end };
        connected = true;
        break;
      }

      // Check if segment connects to merged segment end
      if (
        Math.abs(segment.start.x - merged.end.x) < 1 &&
        Math.abs(segment.start.y - merged.end.y) < 1
      ) {
        mergedSegments[i] = { start: merged.start, end: segment.end };
        connected = true;
        break;
      }
    }

    if (!connected) {
      mergedSegments.push(segment);
    }
  }

  return mergedSegments;
}

// Helper function to snap wall endpoints to 90-degree angles
export function snapTo90Degrees(
  startPoint: { x: number; y: number },
  endPoint: { x: number; y: number },
  snapTolerance: number = 1
): { x: number; y: number } {
  // Calculate movement vector
  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.y - startPoint.y;

  // If no movement yet, just return endpoint
  if (dx === 0 && dy === 0) return endPoint;

  // Calculate angle purely for *reference* (visual guidance only)
  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  const normalizedAngle = (angleDeg + 360) % 360;

  // Determine how close we are to perfect 0°, 90°, 180°, 270° lines
  const snapAngles = [0, 90, 180, 270];
  let minDiff = Infinity;
  let closestAngle = normalizedAngle;

  for (const a of snapAngles) {
    const diff = Math.min(
      Math.abs(normalizedAngle - a),
      360 - Math.abs(normalizedAngle - a)
    );
    if (diff < minDiff) {
      minDiff = diff;
      closestAngle = a;
    }
  }

  // 🚫 Do NOT modify coordinates anymore.
  // Just return the exact endpoint — the "freedom" behavior.
  // We'll later use (normalizedAngle, closestAngle, minDiff)
  // to show a visual red guide line *without affecting drawing*.

  return endPoint;
}

// Helper function to calculate bounding box from wall segments
export function calculateWallBoundingBox(asset: AssetInstance): {
  width: number;
  height: number;
} {
  // Prefer node-edge data if present; otherwise fall back to legacy segments
  const wallGap = asset.wallGap ?? 8;

  let geometry: WallGeometry = { outerPoints: [], innerPoints: [] };

  if (
    asset.wallNodes &&
    asset.wallNodes.length > 0 &&
    asset.wallEdges &&
    asset.wallEdges.length > 0
  ) {
    // Build relative segments from node-edge graph
    const segments = asset.wallEdges.map((edge) => {
      const a = asset.wallNodes![edge.a];
      const b = asset.wallNodes![edge.b];
      return {
        start: { x: a.x - asset.x, y: a.y - asset.y },
        end: { x: b.x - asset.x, y: b.y - asset.y },
      };
    });
    geometry = buildWallGeometry(segments, wallGap);
  } else if (asset.wallSegments && asset.wallSegments.length > 0) {
    const relativeSegments = asset.wallSegments;
    geometry = buildWallGeometry(relativeSegments, wallGap);
  } else {
    return { width: 200, height: 200 };
  }

  // Combine all points from both outer and inner geometry
  const allPoints = [...geometry.outerPoints, ...geometry.innerPoints];

  if (allPoints.length === 0) {
    return { width: 200, height: 200 }; // Default fallback
  }

  // Find min/max coordinates
  const minX = Math.min(...allPoints.map((p) => p.x));
  const maxX = Math.max(...allPoints.map((p) => p.x));
  const minY = Math.min(...allPoints.map((p) => p.y));
  const maxY = Math.max(...allPoints.map((p) => p.y));

  return {
    width: Math.max(50, maxX - minX), // Minimum 50mm width
    height: Math.max(50, maxY - minY), // Minimum 50mm height
  };
}
