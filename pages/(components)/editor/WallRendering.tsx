import React from "react";
import { AssetInstance } from "@/store/sceneStore";
import {
  buildWallGeometry,
  calculateWallBoundingBox,
} from "@/lib/wallGeometry";
import { useSceneStore } from "@/store/sceneStore";

type WallRenderingProps = {
  asset: AssetInstance;
  leftPx: number;
  topPx: number;
  totalRotation: number;
};

export default function WallRendering({
  asset,
  leftPx,
  topPx,
  totalRotation,
}: WallRenderingProps) {
  const showDebugOutlines = useSceneStore((s) => s.showDebugOutlines);

  // Early return if asset is undefined (prevents SSR errors)
  if (!asset) {
    return null;
  }

  return (
    <div
      style={{
        position: "absolute",
        left: leftPx,
        top: topPx,
        transform: `translate(-50%, -50%) rotate(${totalRotation}deg)`,
        cursor: "move",
        zIndex: asset.zIndex || -100, // Ensure walls render behind other assets
        isolation: "isolate", // Create a new stacking context to prevent rendering issues
      }}
    >
      {(() => {
        // Use stored dimensions if available, otherwise calculate from geometry
        let width, height;
        if (asset.width && asset.height) {
          // Use stored dimensions (same approach as shapes)
          const mmToPx = 2.000021;
          width = Math.max(asset.width * mmToPx, 40);
          height = Math.max(asset.height * mmToPx, 40);
        } else {
          // Fallback to geometry calculation
          const boundingBox = calculateWallBoundingBox(asset);
          const mmToPx = 2.000021;
          width = Math.max(boundingBox.width * mmToPx, 40);
          height = Math.max(boundingBox.height * mmToPx, 40);
        }

        return (
          <>
            {/* DEBUG: Wall rendering info */}
            {(asset as any).debugInfo && (
              <div
                style={{
                  position: "absolute",
                  top: "-30px",
                  left: "0px",
                  backgroundColor: "rgba(255, 0, 0, 0.8)",
                  color: "white",
                  padding: "2px 4px",
                  borderRadius: "3px",
                  fontSize: "10px",
                  fontWeight: "bold",
                  whiteSpace: "nowrap",
                  zIndex: 1000,
                  pointerEvents: "none",
                }}
              >
                WALL DEBUG:
                <br />
                Nodes: {(asset as any).debugInfo.originalNodes?.length || 0}
                <br />
                Center: {(asset as any).debugInfo.center?.x?.toFixed(1) || 0}, {(asset as any).debugInfo.center?.y?.toFixed(1) || 0}
                <br />
                Stored: {(asset as any).debugInfo.storedDimensions?.width?.toFixed(1) || 'N/A'}×{(asset as any).debugInfo.storedDimensions?.height?.toFixed(1) || 'N/A'}mm
                <br />
                SVG: {width.toFixed(1)}×{height.toFixed(1)}px
                <br />
                Method: {asset.width && asset.height ? 'Stored' : 'Calculated'}
                <br />
                Segments: {asset.wallEdges?.length || 0}
                <br />
                Total Length: {(() => {
                  if (asset.wallNodes && asset.wallEdges) {
                    const segments = asset.wallEdges.map((edge) => {
                      const a = asset.wallNodes![edge.a];
                      const b = asset.wallNodes![edge.b];
                      return {
                        start: { x: a.x - asset.x, y: a.y - asset.y },
                        end: { x: b.x - asset.x, y: b.y - asset.y },
                      };
                    });
                    const lengths = segments.map(seg => {
                      const dx = seg.end.x - seg.start.x;
                      const dy = seg.end.y - seg.start.y;
                      return Math.sqrt(dx * dx + dy * dy);
                    });
                    return lengths.reduce((sum, len) => sum + len, 0).toFixed(1) + 'mm';
                  }
                  return 'N/A';
                })()}
              </div>
            )}
            <svg
              width={width}
              height={height}
              viewBox={`${-width / 2} ${-height / 2} ${width} ${height}`}
              style={{ overflow: "visible" }}
            >
            {/* Render legacy segments only when we DON'T have node-edge data */}
            {!asset.wallNodes &&
              asset.wallSegments &&
              asset.wallSegments.length > 0 &&
              (() => {
                const wallThickness = (asset.wallThickness ?? 1) * asset.scale;
                const wallGap = asset.wallGap ?? 8; // Wall gap in mm units (will be scaled)

                // Wall segments are already in relative coordinates
                const relativeSegments = asset.wallSegments;

                // Build wall geometry with mitered corners
                const geometry = buildWallGeometry(relativeSegments, wallGap);

                if (
                  geometry.outerPoints.length === 0 ||
                  geometry.innerPoints.length === 0
                ) {
                  return null;
                }

                // Apply scale to geometry points
                const outerPointsScaled = geometry.outerPoints.map((point) => ({
                  x: point.x * asset.scale,
                  y: point.y * asset.scale,
                }));

                const innerPointsScaled = geometry.innerPoints.map((point) => ({
                  x: point.x * asset.scale,
                  y: point.y * asset.scale,
                }));

                // Build two independent polylines (outer and inner) to avoid a closing connector line
                const outerPath = `${outerPointsScaled
                  .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
                  .join(" ")} Z`;
                const innerPath = `${innerPointsScaled
                  .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
                  .join(" ")} Z`;

                // Render two independent closed strokes (no fill) to avoid any bridging line
                // Blend the first/last corner by stroking a compound path
                const compound = `${outerPath} ${innerPath}`;
                // Return to stroke-only double-line representation (no fill)
                return (
                  <>
                    <path
                      d={compound}
                      fill='none'
                      stroke={asset.lineColor ?? "#000000"}
                      strokeWidth={wallThickness}
                      strokeLinejoin='round'
                      strokeLinecap='square'
                    />
                    {showDebugOutlines && (
                      <path d={compound} fill='none' stroke='#FF00FF' strokeWidth={1} strokeDasharray='4,4' />
                    )}
                  </>
                );
              })()}

            {/* Node-edge rendering path (takes precedence if present) */}
            {asset.wallNodes &&
              asset.wallEdges &&
              asset.wallEdges.length > 0 &&
              (() => {
                const wallThickness = (asset.wallThickness ?? 1) * asset.scale;
                const wallGap = asset.wallGap ?? 8;
                // Convert edges into segments (absolute -> relative to asset center)
                const segments = asset.wallEdges.map((edge) => {
                  const a = asset.wallNodes![edge.a];
                  const b = asset.wallNodes![edge.b];
                  return {
                    start: { x: a.x - asset.x, y: a.y - asset.y },
                    end: { x: b.x - asset.x, y: b.y - asset.y },
                  };
                });
                
                // DEBUG: Calculate segment lengths for visual debugging
                const segmentLengths = segments.map(seg => {
                  const dx = seg.end.x - seg.start.x;
                  const dy = seg.end.y - seg.start.y;
                  return Math.sqrt(dx * dx + dy * dy);
                });
                const totalLength = segmentLengths.reduce((sum, len) => sum + len, 0);
                const geometry = buildWallGeometry(segments, wallGap);
                
                // DEBUG: Show geometry points
                const debugText = `Geometry: ${geometry.outerPoints.length} outer, ${geometry.innerPoints.length} inner points`;
                
                if (
                  geometry.outerPoints.length === 0 ||
                  geometry.innerPoints.length === 0
                )
                  return (
                    <text x="0" y="0" fill="red" fontSize="12">
                      {debugText} - No geometry!
                    </text>
                  );
                const outerPointsScaled = geometry.outerPoints.map((p) => ({
                  x: p.x * asset.scale,
                  y: p.y * asset.scale,
                }));
                const innerPointsScaled = geometry.innerPoints.map((p) => ({
                  x: p.x * asset.scale,
                  y: p.y * asset.scale,
                }));
                // Build compound stroke for seamless join
                const outerPath = `${outerPointsScaled
                  .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
                  .join(" ")} Z`;
                const innerPath = `${innerPointsScaled
                  .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
                  .join(" ")} Z`;
                const compound = `${outerPath} ${innerPath}`;
                return (
                  <path
                    d={compound}
                    fill='none'
                    stroke={asset.lineColor ?? "#000000"}
                    strokeWidth={wallThickness}
                    strokeLinejoin='round'
                    strokeLinecap='square'
                  />
                );
              })()}
          </svg>
          </>
        );
      })()}
    </div>
  );
}