"use client";

import React, { useMemo } from "react";
import polygonClipping from "polygon-clipping";
import { AssetInstance, useSceneStore } from "@/store/sceneStore";
import { buildWallGeometry, WallSegment } from "@/lib/wallGeometry";

type UnifiedWallRenderingProps = { mmToPx: number };

// Convert a wall asset into a polygon (outer ring only) in mm coordinates
function wallAssetToPolygonMm(asset: AssetInstance, wallThicknessDefault = 1): number[][][] | null {
  const wallThickness = (asset.wallThickness ?? wallThicknessDefault);
  const wallGap = asset.wallGap ?? 8;

  let segments: WallSegment[] = [];
  if (asset.wallNodes && asset.wallEdges) {
    segments = asset.wallEdges.map((edge) => {
      const a = asset.wallNodes![edge.a];
      const b = asset.wallNodes![edge.b];
      return {
        start: { x: a.x - asset.x, y: a.y - asset.y },
        end: { x: b.x - asset.x, y: b.y - asset.y },
      };
    });
  } else if (asset.wallSegments && asset.wallSegments.length) {
    segments = asset.wallSegments;
  }
  if (!segments.length) return null;

  const geom = buildWallGeometry(segments, wallGap, wallThickness);
  if (!geom.outerPoints.length || !geom.innerPoints.length) return null;

  // Build a polygon ring by following outer then reversed inner
  const ring: number[][] = [];
  geom.outerPoints.forEach((p) => ring.push([p.x + asset.x, p.y + asset.y]));
  for (let i = geom.innerPoints.length - 1; i >= 0; i--) {
    const p = geom.innerPoints[i];
    ring.push([p.x + asset.x, p.y + asset.y]);
  }
  return [ring];
}

function normalizeToMultiPolygon(geom: any): number[][][][] {
  // MultiPolygon: Polygon[]; Polygon: Ring[]; Ring: [x,y][]
  if (!Array.isArray(geom)) return [];
  const a = geom[0];
  if (!Array.isArray(a)) return [];
  const b = a[0];
  if (!Array.isArray(b)) {
    // geom is Ring -> wrap to Polygon -> wrap to MultiPolygon
    return [[[geom as any]]];
  }
  if (typeof b[0] === "number") {
    // geom is Polygon
    return [geom as any];
  }
  // Already MultiPolygon
  return geom as any;
}

function polygonToPathD(geom: any, mmToPx: number): string {
  const multi = normalizeToMultiPolygon(geom);
  let d = "";
  for (const polygon of multi) {
    for (const ring of polygon) {
      if (!ring || !ring.length) continue;
      const first = ring[0];
      if (!Array.isArray(first) || first.length < 2) continue;
      const [x0, y0] = first as number[];
      d += `M ${x0 * mmToPx} ${y0 * mmToPx}`;
      for (let i = 1; i < ring.length; i++) {
        const pt = ring[i];
        if (!Array.isArray(pt) || pt.length < 2) continue;
        const [x, y] = pt as number[];
        d += ` L ${x * mmToPx} ${y * mmToPx}`;
      }
      d += " Z";
    }
  }
  return d;
}

export default function UnifiedWallRendering({ mmToPx }: UnifiedWallRenderingProps) {
  const assets = useSceneStore((s) => s.assets);
  const currentWallSegments = useSceneStore((s) => s.currentWallSegments);
  const currentWallStart = useSceneStore((s) => s.currentWallStart);
  const currentWallTempEnd = useSceneStore((s) => s.currentWallTempEnd);
  const isDraggingAsset = useSceneStore((s) => (s as any).isDraggingAsset);

  // Compute centerline segments for existing walls and the live preview
  const centerlineSegments = useMemo(() => {
    const segs: { a:{x:number;y:number}; b:{x:number;y:number}; t:number }[] = [];
    for (const a of assets) {
      if (a.type !== 'wall-segments') continue;
      if (a.wallNodes && a.wallEdges) {
        for (const e of a.wallEdges) {
          const p1 = a.wallNodes![e.a];
          const p2 = a.wallNodes![e.b];
          segs.push({ a:{ x:p1.x, y:p1.y }, b:{ x:p2.x, y:p2.y }, t: a.wallThickness ?? 2 });
        }
      } else if (a.wallSegments) {
        for (const s of a.wallSegments) {
          segs.push({ a:{ x:s.start.x + a.x, y:s.start.y + a.y }, b:{ x:s.end.x + a.x, y:s.end.y + a.y }, t: a.wallThickness ?? 2 });
        }
      }
    }
    // Include in-progress temp segment
    if (currentWallStart && currentWallTempEnd) {
      segs.push({ a:{ x: currentWallStart.x, y: currentWallStart.y }, b:{ x: currentWallTempEnd.x, y: currentWallTempEnd.y }, t: useSceneStore.getState().getCurrentWallThickness() });
    }
    return segs;
  }, [assets, currentWallStart, currentWallTempEnd]);

  // Detect intersections and render dots only (no extra wall overlay)
  const intersections = useMemo(() => {
    const pts: {x:number;y:number; dir1:{x:number;y:number}; dir2:{x:number;y:number}; t1:number; t2:number }[] = [];
    const lineX = (p1:any,p2:any,p3:any,p4:any) => {
      const denom = (p1.x-p2.x)*(p3.y-p4.y)-(p1.y-p2.y)*(p3.x-p4.x);
      if (Math.abs(denom) < 1e-9) return null;
      const t = ((p1.x-p3.x)*(p3.y-p4.y)-(p1.y-p3.y)*(p3.x-p4.x))/denom;
      const u = ((p1.x-p3.x)*(p1.y-p2.y)-(p1.y-p3.y)*(p1.x-p2.x))/denom;
      // Only count true crossings strictly inside both segments (exclude endpoints/snap points)
      const eps = 1e-4;
      if (t<=eps||t>=1-eps||u<=eps||u>=1-eps) return null;
      return { x: p1.x + t*(p2.x-p1.x), y: p1.y + t*(p2.y-p1.y), t, u } as any;
    };
    for (let i=0;i<centerlineSegments.length;i++){
      for (let j=i+1;j<centerlineSegments.length;j++){
        const res:any = lineX(centerlineSegments[i].a, centerlineSegments[i].b, centerlineSegments[j].a, centerlineSegments[j].b);
        if (res) {
          const p = { x: res.x, y: res.y };
          const v1 = { x: centerlineSegments[i].b.x - centerlineSegments[i].a.x, y: centerlineSegments[i].b.y - centerlineSegments[i].a.y };
          const l1 = Math.hypot(v1.x, v1.y) || 1; const dir1 = { x: v1.x/l1, y: v1.y/l1 };
          const v2 = { x: centerlineSegments[j].b.x - centerlineSegments[j].a.x, y: centerlineSegments[j].b.y - centerlineSegments[j].a.y };
          const l2 = Math.hypot(v2.x, v2.y) || 1; const dir2 = { x: v2.x/l2, y: v2.y/l2 };
          pts.push({ x: p.x, y: p.y, dir1, dir2, t1: centerlineSegments[i].t ?? 2, t2: centerlineSegments[j].t ?? 2 });
        }
      }
    }
    // Deduplicate close points
    const dedup: any[] = [];
    const tol = 0.3;
    for (const p of pts) {
      if (!dedup.some((q:any) => Math.hypot(q.x-p.x, q.y-p.y) <= tol)) dedup.push(p);
    }
    return dedup;
  }, [centerlineSegments]);

  // Estimate a stroke/patch size from current wall thickness selection
  const visualThicknessPx = useSceneStore.getState().getCurrentWallThickness() || 2;


  if (isDraggingAsset) {
    // Skip heavy overlay work while dragging to keep walls responsive
    return null;
  }

  return (
    <svg className="absolute inset-0 pointer-events-none" style={{ zIndex: 5, overflow: "visible" }}>
      {/* No filled overlay; per-asset walls render strokes. We only render dots and (optionally) tiny cleanup plugs. */}
      {intersections.map((p:any, idx:number) => {
        // Draw two tiny background-colored strokes along each segment direction to visually clip strokes (no fill)
        const halfA = (p.t2 * mmToPx) / 2 + 1; // use opposite thickness to clip through
        const halfB = (p.t1 * mmToPx) / 2 + 1;
        const ax1 = (p.x - p.dir1.x * halfA) * mmToPx;
        const ay1 = (p.y - p.dir1.y * halfA) * mmToPx;
        const ax2 = (p.x + p.dir1.x * halfA) * mmToPx;
        const ay2 = (p.y + p.dir1.y * halfA) * mmToPx;
        const bx1 = (p.x - p.dir2.x * halfB) * mmToPx;
        const by1 = (p.y - p.dir2.y * halfB) * mmToPx;
        const bx2 = (p.x + p.dir2.x * halfB) * mmToPx;
        const by2 = (p.y + p.dir2.y * halfB) * mmToPx;
        return (
          <g key={`mask-${idx}`}>
            <line x1={ax1} y1={ay1} x2={ax2} y2={ay2} stroke="#ffffff" strokeWidth={p.t2 * mmToPx} strokeLinecap="butt" />
            <line x1={bx1} y1={by1} x2={bx2} y2={by2} stroke="#ffffff" strokeWidth={p.t1 * mmToPx} strokeLinecap="butt" />
            <circle cx={p.x * mmToPx} cy={p.y * mmToPx} r={3} fill="#000000" />
          </g>
        );
      })}
      {/* Compute and draw overlap clipping to create smooth pathway at crossings */}
      {(() => {
        // Build thick wall polygons (existing + preview) for overlap subtraction
        const polys: any[] = [];
        let maxThicknessPx = visualThicknessPx;
        assets.filter(a=>a && a.type==='wall-segments').forEach(a=>{
          const poly = wallAssetToPolygonMm(a);
          if (poly) polys.push(poly);
          if (a.wallThickness) maxThicknessPx = Math.max(maxThicknessPx, a.wallThickness);
        });
        if (currentWallSegments && currentWallSegments.length>0) {
          const tmp = [...currentWallSegments];
          if (currentWallStart && currentWallTempEnd) tmp.push({ start: currentWallStart, end: currentWallTempEnd });
          const tempAsset: AssetInstance = {
            id: '__preview__', type:'wall-segments', x:0, y:0, scale:1, rotation:0,
            wallSegments: tmp,
            wallThickness: useSceneStore.getState().getCurrentWallThickness(),
            wallGap: 8,
          } as any;
          const poly = wallAssetToPolygonMm(tempAsset);
          if (poly) polys.push(poly);
          maxThicknessPx = Math.max(maxThicknessPx, useSceneStore.getState().getCurrentWallThickness());
        }
        // Pairwise intersections -> draw as background-colored patches to hide the thick overlap box
        const patches: string[] = [];
        for (let i=0;i<polys.length;i++){
          for (let j=i+1;j<polys.length;j++){
            try {
              const inter = polygonClipping.intersection(polys[i] as any, polys[j] as any);
              if (inter && Array.isArray(inter) && inter.length>0) {
                patches.push(polygonToPathD(inter, mmToPx));
              }
            } catch {}
          }
        }
        return patches.map((d, k)=>(
          <g key={`patch-${k}`}>
            <path d={d} fill="#ffffff" stroke="#ffffff" strokeWidth={maxThicknessPx + 2} />
          </g>
        ));
      })()}
      {/* Additional safety: small white plug exactly at crossing center to hide any remaining cross pixels */}
      {intersections.map((p, idx) => (
        <circle key={`plug-${idx}`} cx={p.x * mmToPx} cy={p.y * mmToPx} r={visualThicknessPx * 0.6} fill="#ffffff" />
      ))}
    </svg>
  );
}


