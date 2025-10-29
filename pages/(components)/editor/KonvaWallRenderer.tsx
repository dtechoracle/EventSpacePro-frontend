"use client";

import React, { useMemo } from "react";
import { Stage, Layer, Path, Rect, Group } from "react-konva";
import { AssetInstance, useSceneStore } from "@/store/sceneStore";
import { buildWallGeometry, detectWallIntersections } from "@/lib/wallGeometry";

type KonvaWallRendererProps = {
  asset: AssetInstance;
  width: number;
  height: number;
  scalePx: number; // mm to px
};

export default function KonvaWallRenderer({ asset, width, height, scalePx }: KonvaWallRendererProps) {
  const wallThickness = (asset.wallThickness ?? 1) * (asset.scale || 1) * scalePx;
  const wallGap = asset.wallGap ?? 8;

  const { compoundPath, maskBars } = useMemo(() => {
    // Build segments relative to center (mm)
    const segments = (asset.wallNodes && asset.wallEdges)
      ? asset.wallEdges.map((e) => {
          const a = asset.wallNodes![e.a];
          const b = asset.wallNodes![e.b];
          return { start: { x: a.x - asset.x, y: a.y - asset.y }, end: { x: b.x - asset.x, y: b.y - asset.y } };
        })
      : (asset.wallSegments || []);

    const geom = buildWallGeometry(segments, wallGap);
    const outer = geom.outerPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x * scalePx} ${p.y * scalePx}`).join(" ");
    const inner = geom.innerPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x * scalePx} ${p.y * scalePx}`).join(" ");
    const compoundPath = `${outer} Z ${inner} Z`;

    // Intersection detection vs other walls
    const allWalls = useSceneStore.getState().assets.filter(a => a.type === "wall-segments" && a.id !== asset.id);
    const intersections: { x: number; y: number }[] = [];
    segments.forEach(seg => { intersections.push(...detectWallIntersections(seg as any, allWalls as any, (asset.wallThickness ?? 1))); });

    const otherCenter: { start:{x:number;y:number}; end:{x:number;y:number} }[] = [];
    allWalls.forEach(w => {
      if (w.wallNodes && w.wallEdges) {
        w.wallEdges.forEach(e => {
          const a = w.wallNodes![e.a]; const b = w.wallNodes![e.b];
          otherCenter.push({ start:{ x: a.x - asset.x, y: a.y - asset.y }, end:{ x: b.x - asset.x, y: b.y - asset.y } });
        });
      } else if (w.wallSegments) {
        otherCenter.push(...w.wallSegments);
      }
    });
    const findAngle = (pt:{x:number;y:number}) => {
      let best = { d: Infinity, ang: 0 };
      otherCenter.forEach(s => {
        const dx = s.end.x - s.start.x, dy = s.end.y - s.start.y;
        const len2 = dx*dx + dy*dy || 1;
        const t = Math.max(0, Math.min(1, ((pt.x - s.start.x)*dx + (pt.y - s.start.y)*dy)/len2));
        const proj = { x: s.start.x + t*dx, y: s.start.y + t*dy };
        const d = Math.hypot(pt.x - proj.x, pt.y - proj.y);
        if (d < best.d) best = { d, ang: Math.atan2(dy, dx) };
      });
      return best.ang;
    };
    const maskBars = intersections.map(p => ({ x: p.x * scalePx, y: p.y * scalePx, angle: findAngle(p) }));

    return { compoundPath, maskBars };
  }, [asset, scalePx, wallGap]);

  if (!compoundPath) return null;

  return (
    <Stage width={width} height={height} listening={false}>
      <Layer>
        <Group x={width/2} y={height/2}>
          {/* Wall stroke */}
          <Path
            data={compoundPath}
            stroke={asset.lineColor || "#000"}
            strokeWidth={wallThickness}
            listening={false}
            fillEnabled={false}
            lineCap="square"
            lineJoin="round"
          />
          {/* Mask bars using destination-out */}
          {maskBars.map((b, i) => (
            <Rect
              key={i}
              x={b.x - width/2 - wallThickness*1.2}
              y={b.y - height/2 - (wallThickness*0.5)/2}
              width={wallThickness*2.4}
              height={wallThickness*0.5}
              cornerRadius={wallThickness*0.15}
              fill="#000"
              listening={false}
              rotation={(b.angle*180/Math.PI)}
              globalCompositeOperation="destination-out"
            />
          ))}
        </Group>
      </Layer>
    </Stage>
  );
}


