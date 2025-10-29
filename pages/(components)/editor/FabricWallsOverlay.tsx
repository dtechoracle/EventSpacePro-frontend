"use client";

import React, { useEffect, useMemo, useRef } from "react";
import polygonClipping from "polygon-clipping";
import { useSceneStore, AssetInstance } from "@/store/sceneStore";
import { buildWallGeometry, WallSegment } from "@/lib/wallGeometry";

type FabricWallsOverlayProps = { mmToPx: number };

// Detect T-junctions and return blend info
function detectTJunctions(assets: AssetInstance[]): Array<{
  point: { x: number; y: number };
  stemEdge: { a: { x: number; y: number }; b: { x: number; y: number } };
  crossEdge: { a: { x: number; y: number }; b: { x: number; y: number } };
}> {
  const junctions: Array<any> = [];
  const edges: Array<{ a: { x: number; y: number }; b: { x: number; y: number }; assetId: string }> = [];
  
  // Collect all edges from wall assets
  for (const asset of assets) {
    if (asset.type !== 'wall-segments' || !asset.wallNodes || !asset.wallEdges) continue;
    for (const edge of asset.wallEdges) {
      const a = asset.wallNodes[edge.a];
      const b = asset.wallNodes[edge.b];
      edges.push({ a, b, assetId: asset.id });
    }
  }
  
  // Check each edge endpoint against other edges for T-junctions
  for (let i = 0; i < edges.length; i++) {
    const stemEdge = edges[i];
    for (let j = 0; j < edges.length; j++) {
      if (i === j) continue;
      const crossEdge = edges[j];
      
      // Check if stem's endpoint lies on cross edge (not at cross endpoints)
      for (const point of [stemEdge.a, stemEdge.b]) {
        const { x, y } = point;
        const { a: ca, b: cb } = crossEdge;
        
        // Skip if point is endpoint of cross edge
        if (Math.hypot(x - ca.x, y - ca.y) < 0.1 || Math.hypot(x - cb.x, y - cb.y) < 0.1) continue;
        
        // Check if point lies on cross edge
        const dx = cb.x - ca.x;
        const dy = cb.y - ca.y;
        const len = Math.hypot(dx, dy);
        if (len < 0.1) continue;
        
        const t = ((x - ca.x) * dx + (y - ca.y) * dy) / (len * len);
        if (t <= 0 || t >= 1) continue;
        
        const projX = ca.x + t * dx;
        const projY = ca.y + t * dy;
        const dist = Math.hypot(x - projX, y - projY);
        
        if (dist < 0.5) { // T-junction detected
          junctions.push({ point: { x, y }, stemEdge, crossEdge });
        }
      }
    }
  }
  
  return junctions;
}

// Convert a wall asset into a polygon with outer and inner rings in mm coordinates
function wallAssetToPolygonMm(asset: AssetInstance, wallThicknessDefault = 1, allAssets: AssetInstance[] = []): number[][][] | null {
  const wallThickness = asset.wallThickness ?? wallThicknessDefault;
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

  // Helpers to ensure valid polygon rings for boolean ops
  const round = (v: number) => Math.round(v * 1000) / 1000; // mm precision
  const closeRing = (ring: number[][]) => {
    if (ring.length === 0) return ring;
    const [x0, y0] = ring[0];
    const [xn, yn] = ring[ring.length - 1];
    if (Math.hypot(xn - x0, yn - y0) > 1e-6) ring.push([x0, y0]);
    return ring;
  };
  const signedArea = (ring: number[][]) => {
    let a = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      const [x1, y1] = ring[i];
      const [x2, y2] = ring[i + 1];
      a += x1 * y2 - x2 * y1;
    }
    return a / 2;
  };
  const ensureOrientation = (ring: number[][], ccw: boolean) => {
    const area = signedArea(ring);
    const isCCW = area > 0;
    if (ccw !== isCCW) ring.reverse();
    return ring;
  };
  const dedup = (ring: number[][]) => {
    const out: number[][] = [];
    for (const p of ring) {
      const rp: number[] = [round(p[0]), round(p[1])];
      if (out.length === 0 || Math.hypot(out[out.length - 1][0] - rp[0], out[out.length - 1][1] - rp[1]) > 1e-6) {
        out.push(rp);
      }
    }
    return out;
  };

  let outerRing: number[][] = geom.outerPoints.map((p) => [p.x + asset.x, p.y + asset.y]);
  let innerRing: number[][] = geom.innerPoints.map((p) => [p.x + asset.x, p.y + asset.y]);

  outerRing = ensureOrientation(closeRing(dedup(outerRing)), true);  // outer CCW
  innerRing = ensureOrientation(closeRing(dedup(innerRing)), false); // inner CW

  return [outerRing, innerRing];
}

function normalizeToMultiPolygon(geom: any): number[][][][] {
  if (!Array.isArray(geom)) return [];
  const a = geom[0];
  if (!Array.isArray(a)) return [];
  const b = a[0];
  if (!Array.isArray(b)) return [] as any;
  if (typeof b[0] === "number") return [geom as any];
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

export default function FabricWallsOverlay({ mmToPx }: FabricWallsOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fabricRef = useRef<any>(null);
  const fabricModuleRef = useRef<any>(null);

  const assets = useSceneStore((s) => s.assets);
  const showDebugOutlines = useSceneStore((s) => s.showDebugOutlines);
  const currentWallSegments = useSceneStore((s) => s.currentWallSegments);
  const currentWallStart = useSceneStore((s) => s.currentWallStart);
  const currentWallTempEnd = useSceneStore((s) => s.currentWallTempEnd);

  // Build union contours as SVG path strings with T-junction blending
  const unionContours = useMemo(() => {
    const wallAssets = assets.filter((a) => a && a.type === "wall-segments");
    const junctions = detectTJunctions(wallAssets);
    
    const polygons: any[] = [];
    wallAssets.forEach((a) => {
      const poly = wallAssetToPolygonMm(a, 1, wallAssets);
      if (poly) polygons.push(poly);
    });
    
    if (currentWallSegments && currentWallSegments.length > 0) {
      const tmp = [...currentWallSegments];
      if (currentWallStart && currentWallTempEnd) tmp.push({ start: currentWallStart, end: currentWallTempEnd });
      const tempAsset: AssetInstance = {
        id: "__preview__",
        type: "wall-segments",
        x: 0,
        y: 0,
        scale: 1,
        rotation: 0,
        wallSegments: tmp,
        wallThickness: useSceneStore.getState().getCurrentWallThickness() || 2,
        wallGap: 8,
      } as any;
      const poly = wallAssetToPolygonMm(tempAsset, 1, wallAssets);
      if (poly) polygons.push(poly);
    }
    
    if (!polygons.length) return [] as string[];
    
    // Apply union operation
    let unionGeom: any = polygons[0];
    for (let i = 1; i < polygons.length; i++) {
      unionGeom = polygonClipping.union(unionGeom as any, polygons[i] as any);
    }
    
    // Add blending circles at T-junctions to smooth connections
    if (junctions.length > 0) {
      const blendRadius = 1.5; // mm - adjust for smoothness
      for (const junction of junctions) {
        const { x, y } = junction.point;
        const circleSegments = 16;
        const circle: number[][] = [];
        for (let i = 0; i < circleSegments; i++) {
          const angle = (i / circleSegments) * Math.PI * 2;
          circle.push([
            x + Math.cos(angle) * blendRadius,
            y + Math.sin(angle) * blendRadius
          ]);
        }
        circle.push(circle[0]); // Close the ring
        const circlePoly = [circle];
        unionGeom = polygonClipping.union(unionGeom as any, circlePoly as any);
      }
    }
    
    const multi = Array.isArray(unionGeom) ? unionGeom : [];
    const d: string[] = [];
    for (const polygon of multi as any) d.push(polygonToPathD(polygon, mmToPx));
    return d;
  }, [assets, currentWallSegments, currentWallStart, currentWallTempEnd, mmToPx]);

  // Initialize Fabric once
  useEffect(() => {
    let disposed = false;
    (async () => {
      const mod = await import("fabric");
      if (disposed) return;
      const fabric = (mod as any).fabric ?? mod;
      fabricModuleRef.current = fabric;
      if (!canvasRef.current) return;
      const f = new fabric.StaticCanvas(canvasRef.current, {
        renderOnAddRemove: true,
        selection: false,
      });
      fabricRef.current = f;
      // Size to element's client rect
      const resize = () => {
        if (!canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        f.setWidth(rect.width);
        f.setHeight(rect.height);
        f.requestRenderAll();
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(canvasRef.current);
      (fabricRef.current as any)._ro = ro;

      // Enable hit rects for dragging with snapping
      const buildHitRects = async () => {
        f.getObjects().forEach((obj: any) => { if (obj?.data?.kind === 'wall-hit') f.remove(obj); });
        const state = (await import("@/store/sceneStore")).useSceneStore.getState();
        const assets = state.assets;
        for (const a of assets) {
          if (!a || a.type !== 'wall-segments') continue;
          const nodes = a.wallNodes;
          if (!nodes || !a.wallEdges) continue;
          // simple bbox around nodes
          let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
          for (const n of nodes) { minX=Math.min(minX,n.x); minY=Math.min(minY,n.y); maxX=Math.max(maxX,n.x); maxY=Math.max(maxY,n.y); }
          const rect = new fabric.Rect({
            left: minX * mmToPx,
            top: minY * mmToPx,
            width: (maxX-minX) * mmToPx,
            height: (maxY-minY) * mmToPx,
            fill: 'rgba(0,0,0,0)',
            stroke: 'rgba(0,0,0,0)',
            selectable: true,
            hasControls: false,
            hoverCursor: 'move',
            perPixelTargetFind: false,
            data: { kind: 'wall-hit', assetId: a.id },
          });
          rect.on('moving', () => {
            const center = { x: ((rect.left||0)+ (rect.width||0)/2)/mmToPx, y: ((rect.top||0)+(rect.height||0)/2)/mmToPx };
            const snap = state.getWallSnapDelta(a.id, center);
            rect.left = (rect.left||0) + snap.dx*mmToPx;
            rect.top = (rect.top||0) + snap.dy*mmToPx;
          });
          rect.on('mousedblclick', () => {});
          rect.on('moved', () => {
            const center = { x: ((rect.left||0)+ (rect.width||0)/2)/mmToPx, y: ((rect.top||0)+(rect.height||0)/2)/mmToPx };
            state.finishWallMove(a.id, center);
            // rebuild again after state change
            setTimeout(() => { (fabricRef.current as any)?._buildHits?.(); }, 0);
          });
          f.add(rect);
        }
        f.requestRenderAll();
      };
      (fabricRef.current as any)._buildHits = () => { buildHitRects(); };
    })();
    return () => {
      disposed = true;
      const f = fabricRef.current;
      if (f) {
        const ro = (f as any)._ro as ResizeObserver | undefined;
        if (ro && canvasRef.current) ro.unobserve(canvasRef.current);
        f.dispose();
        fabricRef.current = null;
      }
    };
  }, [mmToPx]);

  // Draw union contours into Fabric
  useEffect(() => {
    const f = fabricRef.current;
    const fabric = fabricModuleRef.current;
    if (!f) return;
    f.clear();
    for (const d of unionContours) {
      const path = new fabric.Path(d, {
        fill: "#000000",
        stroke: "#000000",
        strokeWidth: 1,
        fillRule: "evenodd",
        selectable: false,
        evented: false,
      });
      f.add(path);
    }
    // Default hardcoded cross: stroke-only, pass-through look (no fill)
    {
      const cx = 20; // mm (closer to top-left)
      const cy = 20; // mm (closer to top-left)
      const arm = 160; // half-length in mm
      const band = 8; // wall band in mm
      const strokePx = band * mmToPx;
      const h = new fabric.Line([
        (cx - arm) * mmToPx,
        cy * mmToPx,
        (cx + arm) * mmToPx,
        cy * mmToPx,
      ], {
        stroke: '#ff0000',
        strokeWidth: strokePx,
        fill: undefined,
        selectable: false,
        evented: false,
        strokeLineCap: 'square',
      });
      const v = new fabric.Line([
        cx * mmToPx,
        (cy - arm) * mmToPx,
        cx * mmToPx,
        (cy + arm) * mmToPx,
      ], {
        stroke: '#ff0000',
        strokeWidth: strokePx,
        fill: undefined,
        selectable: false,
        evented: false,
        strokeLineCap: 'square',
      });
      f.add(h);
      f.add(v);
    }
    // Optional debug: draw all edge intersections as magenta dots
    if (showDebugOutlines) {
      const edges: { a:{x:number;y:number}; b:{x:number;y:number} }[] = [];
      for (const a of assets) {
        if (a.type !== 'wall-segments' || !a.wallNodes || !a.wallEdges) continue;
        for (const e of a.wallEdges) {
          const p1 = a.wallNodes[e.a];
          const p2 = a.wallNodes[e.b];
          edges.push({ a: p1, b: p2 });
        }
      }
      const inters: {x:number;y:number}[] = [];
      const intersect = (p1:any,p2:any,p3:any,p4:any) => {
        const denom = (p1.x-p2.x)*(p3.y-p4.y)-(p1.y-p2.y)*(p3.x-p4.x);
        if (Math.abs(denom) < 1e-9) return null;
        const t = ((p1.x-p3.x)*(p3.y-p4.y)-(p1.y-p3.y)*(p3.x-p4.x))/denom;
        const u = ((p1.x-p3.x)*(p1.y-p2.y)-(p1.y-p3.y)*(p1.x-p2.x))/denom;
        if (t<=0||t>=1||u<=0||u>=1) return null;
        return { x: p1.x + t*(p2.x-p1.x), y: p1.y + t*(p2.y-p1.y) };
      };
      for (let i=0;i<edges.length;i++){
        for (let j=i+1;j<edges.length;j++){
          const p = intersect(edges[i].a, edges[i].b, edges[j].a, edges[j].b);
          if (p) inters.push(p);
        }
      }
      inters.forEach(pt => {
        const c = new fabric.Circle({
          left: pt.x * mmToPx - 3,
          top: pt.y * mmToPx - 3,
          radius: 3,
          fill: '#ff00ff',
          stroke: '#ff00ff',
          selectable: false,
          evented: false,
        });
        f.add(c);
      });
      
      // Draw T-junction blend points in cyan
      const wallAssets = assets.filter((a) => a && a.type === "wall-segments");
      const junctions = detectTJunctions(wallAssets);
      junctions.forEach(tj => {
        const c = new fabric.Circle({
          left: tj.point.x * mmToPx - 4,
          top: tj.point.y * mmToPx - 4,
          radius: 4,
          fill: '#00ffff',
          stroke: '#00ffff',
          selectable: false,
          evented: false,
        });
        f.add(c);
      });
      
      // Console summary for debugging
      // eslint-disable-next-line no-console
      console.log('Wall debug: intersections=', inters.length, 'T-junctions=', junctions.length);
    }
    // rebuild hit rects for dragging/snap after redraw
    const build = (f as any)._buildHits as (() => void) | undefined;
    if (build) build(); else f.requestRenderAll();
  }, [unionContours, showDebugOutlines, assets]);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ pointerEvents: "auto", zIndex: 5 }}
      />
      {showDebugOutlines && (
        <div
          className="absolute"
          style={{ top: 8, left: 8, zIndex: 6, background: "rgba(255,255,255,0.9)", border: "1px solid #e5e7eb", borderRadius: 6, padding: 8 }}
        >
          <div style={{ fontSize: 12, color: "#111827", marginBottom: 4 }}>Debug: Pass-through Cross</div>
          <svg width={140} height={140} viewBox="0 0 140 140">
            <line x1="10" y1="70" x2="130" y2="70" stroke="#111" strokeWidth="16" strokeLinecap="square" />
            <line x1="70" y1="10" x2="70" y2="130" stroke="#111" strokeWidth="16" strokeLinecap="square" />
          </svg>
        </div>
      )}
    </>
  );
}