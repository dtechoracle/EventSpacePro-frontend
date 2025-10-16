import React from 'react';
import { AssetInstance } from '@/store/sceneStore';
import { buildWallGeometry, calculateWallBoundingBox } from '@/lib/wallGeometry';
import { useSceneStore } from '@/store/sceneStore';

type WallRenderingProps = {
  asset: AssetInstance;
  leftPx: number;
  topPx: number;
  totalRotation: number;
};

export default function WallRendering({ asset, leftPx, topPx, totalRotation }: WallRenderingProps) {
  // Early return if asset is undefined (prevents SSR errors)
  if (!asset) {
    return null;
  }

  const showDebugOutlines = useSceneStore((s) => s.showDebugOutlines);

  return (
    <div
      style={{
        position: "absolute",
        left: leftPx,
        top: topPx,
        transform: `translate(-50%, -50%) rotate(${totalRotation}deg)`,
        cursor: "move",
      }}
    >
      {(() => {
        const boundingBox = calculateWallBoundingBox(asset);
        const width = Math.max(boundingBox.width, 100); // Minimum 100mm
        const height = Math.max(boundingBox.height, 100); // Minimum 100mm
        
        return (
          <svg
            width={width}
            height={height}
            viewBox={`${-width/2} ${-height/2} ${width} ${height}`}
            style={{ overflow: "visible" }}
          >
            {/* Render legacy segments only when we DON'T have node-edge data */}
            {(!asset.wallNodes && asset.wallSegments && asset.wallSegments.length > 0) && (() => {
              const wallThickness = (asset.wallThickness ?? 1) * asset.scale;
              const wallGap = (asset.wallGap ?? 8); // Wall gap in mm units (will be scaled)
              
              // Wall segments are already in relative coordinates
              const relativeSegments = asset.wallSegments;
              
              // Build wall geometry with mitered corners
              const geometry = buildWallGeometry(relativeSegments, wallGap);
              
              if (geometry.outerPoints.length === 0 || geometry.innerPoints.length === 0) {
                return null;
              }
              
              // Apply scale to geometry points
              const outerPointsScaled = geometry.outerPoints.map(point => ({
                x: point.x * asset.scale,
                y: point.y * asset.scale
              }));
              
              const innerPointsScaled = geometry.innerPoints.map(point => ({
                x: point.x * asset.scale,
                y: point.y * asset.scale
              }));
              
              // Build two independent polylines (outer and inner) to avoid a closing connector line
              const outerPath = `${outerPointsScaled.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')} Z`;
              const innerPath = `${innerPointsScaled.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')} Z`;

              // Render two independent closed strokes (no fill) to avoid any bridging line
              // Blend the first/last corner by stroking a compound path
              const compound = `${outerPath} ${innerPath}`;
              return (
                <>
                  <path
                    d={compound}
                    fill="none"
                    stroke={asset.lineColor ?? "#000000"}
                    strokeWidth={wallThickness}
                    strokeLinejoin="round"
                    strokeLinecap="square"
                  />
                  {showDebugOutlines && (
                    <path d={compound} fill="none" stroke="#FF00FF" strokeWidth={1} strokeDasharray="4,4" />
                  )}
                </>
              );
            })()}

            {/* Node-edge rendering path (takes precedence if present) */}
            {asset.wallNodes && asset.wallEdges && asset.wallEdges.length > 0 && (() => {
              const wallThickness = (asset.wallThickness ?? 1) * asset.scale;
              const wallGap = (asset.wallGap ?? 8);
              // Convert edges into segments (absolute -> relative to asset center)
              const segments = asset.wallEdges.map(edge => {
                const a = asset.wallNodes![edge.a];
                const b = asset.wallNodes![edge.b];
                return {
                  start: { x: a.x - asset.x, y: a.y - asset.y },
                  end: { x: b.x - asset.x, y: b.y - asset.y }
                };
              });
              const geometry = buildWallGeometry(segments, wallGap);
              if (geometry.outerPoints.length === 0 || geometry.innerPoints.length === 0) return null;
              const outerPointsScaled = geometry.outerPoints.map(p => ({ x: p.x * asset.scale, y: p.y * asset.scale }));
              const innerPointsScaled = geometry.innerPoints.map(p => ({ x: p.x * asset.scale, y: p.y * asset.scale }));
              // Build compound stroke for seamless join
              const outerPath = `${outerPointsScaled.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')} Z`;
              const innerPath = `${innerPointsScaled.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')} Z`;
              const compound = `${outerPath} ${innerPath}`;
              return (
                <path
                  d={compound}
                  fill="none"
                  stroke={asset.lineColor ?? "#000000"}
                  strokeWidth={wallThickness}
                  strokeLinejoin="round"
                  strokeLinecap="square"
                />
              );
            })()}
          </svg>
        );
      })()}
    </div>
  );
}
