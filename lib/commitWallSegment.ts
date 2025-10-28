import { useSceneStore } from "@/store/sceneStore";
import {
  segmentIntersection,
  splitSegmentAtPoints,
  pointOnSegment,
  dist,
  Pt,
  Segment,
} from "@/lib/geom";

/**
 * Merges a new wall segment into the scene, automatically detecting intersections,
 * trimming overlaps, and creating unified wall assets.
 *
 * This should be called after a wall drawing action finishes (e.g., onMouseUp).
 */
export function commitWallSegment(newSeg: Segment) {
  const s = useSceneStore.getState();
  const MERGE_THRESHOLD = 0.1; // mm - endpoint snapping threshold

  const wallAssets = s.assets.filter(
    (a) => a.wallSegments && a.wallSegments.length > 0
  );

  const intersectionPoints: Pt[] = [];
  const replacements: Array<{
    assetId: string;
    segIndex: number;
    replacements: Segment[];
  }> = [];

  // === 1. Detect intersections and overlapping segments ===
  for (const asset of wallAssets) {
    const localSegs = asset.wallSegments!;
    for (let i = 0; i < localSegs.length; i++) {
      const seg = {
        start: {
          x: localSegs[i].start.x + asset.x,
          y: localSegs[i].start.y + asset.y,
        },
        end: {
          x: localSegs[i].end.x + asset.x,
          y: localSegs[i].end.y + asset.y,
        },
      };

      const ip = segmentIntersection(newSeg.start, newSeg.end, seg.start, seg.end);

      if (ip) {
        intersectionPoints.push(ip);
        const split = splitSegmentAtPoints(seg, [ip]);
        const localRepl = split.map((sg) => ({
          start: { x: sg.start.x - asset.x, y: sg.start.y - asset.y },
          end: { x: sg.end.x - asset.x, y: sg.end.y - asset.y },
        }));
        replacements.push({ assetId: asset.id, segIndex: i, replacements: localRepl });
      } else {
        // Handle colinear overlaps
        if (
          pointOnSegment(newSeg.start, seg.start, seg.end) ||
          pointOnSegment(newSeg.end, seg.start, seg.end) ||
          pointOnSegment(seg.start, newSeg.start, newSeg.end) ||
          pointOnSegment(seg.end, newSeg.start, newSeg.end)
        ) {
          const pts: Pt[] = [];
          if (pointOnSegment(newSeg.start, seg.start, seg.end)) pts.push(newSeg.start);
          if (pointOnSegment(newSeg.end, seg.start, seg.end)) pts.push(newSeg.end);
          if (pointOnSegment(seg.start, newSeg.start, newSeg.end)) pts.push(seg.start);
          if (pointOnSegment(seg.end, newSeg.start, newSeg.end)) pts.push(seg.end);

          const split = splitSegmentAtPoints(seg, pts);
          const localRepl = split.map((sg) => ({
            start: { x: sg.start.x - asset.x, y: sg.start.y - asset.y },
            end: { x: sg.end.x - asset.x, y: sg.end.y - asset.y },
          }));

          replacements.push({ assetId: asset.id, segIndex: i, replacements: localRepl });
          pts.forEach((p) => intersectionPoints.push(p));
        }
      }
    }
  }

  // === 2. Replace affected existing segments ===
  for (const repl of replacements) {
    const asset = s.assets.find((a) => a.id === repl.assetId);
    if (!asset) continue;

    const segs = [...asset.wallSegments!];
    segs.splice(repl.segIndex, 1, ...repl.replacements);
    s.updateAsset(asset.id, { wallSegments: segs });
  }

  // === 3. Split new wall segment at intersection points ===
  const uniqPts: Pt[] = [];
  for (const p of intersectionPoints) {
    if (
      !uniqPts.some(
        (q) =>
          Math.abs(q.x - p.x) < MERGE_THRESHOLD &&
          Math.abs(q.y - p.y) < MERGE_THRESHOLD
      )
    ) {
      uniqPts.push(p);
    }
  }

  const newSubSegments = splitSegmentAtPoints(newSeg, uniqPts);

  // === 4. Create the new wall asset ===
  const newWallAsset = {
    id: `wall_${Date.now()}`,
    type: "wall",
    x: 0,
    y: 0,
    wallSegments: newSubSegments.map((sg) => ({
      start: sg.start,
      end: sg.end,
    })),
    zIndex: 0,
  };

  s.addAssetObject(newWallAsset);

  // === 5. Snap shared endpoints (merge visually connected walls) ===
  const allWallAssets = s.assets.filter(
    (a) => a.wallSegments && a.wallSegments.length > 0
  );

  for (const asset of allWallAssets) {
    const segs = asset.wallSegments!;
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];
      for (const p of uniqPts) {
        const globalStart = { x: seg.start.x + asset.x, y: seg.start.y + asset.y };
        const globalEnd = { x: seg.end.x + asset.x, y: seg.end.y + asset.y };

        if (dist(globalStart, p) <= MERGE_THRESHOLD) {
          segs[i].start = { x: p.x - asset.x, y: p.y - asset.y };
        }
        if (dist(globalEnd, p) <= MERGE_THRESHOLD) {
          segs[i].end = { x: p.x - asset.x, y: p.y - asset.y };
        }
      }
    }
    s.updateAsset(asset.id, { wallSegments: segs });
  }

  // Optional cleanup step could go here:
  // - Remove zero-length segments
  // - Merge colinear adjacent segments
  // - Deduplicate shared endpoints
}

