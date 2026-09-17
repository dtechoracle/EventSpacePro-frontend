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

  // DEBUG LOG
  React.useEffect(() => {
    if ((asset as any).showDimensions) {
      console.log('WallRendering Debug:', {
        id: asset.id,
        showDimensions: (asset as any).showDimensions,
        nodes: asset.wallNodes?.length,
        edges: asset.wallEdges?.length,
        segments: (asset as any).wallSegments?.length
      });
      if ((asset as any).wallSegments) {
        console.log('Wall Segments Data:', JSON.stringify((asset as any).wallSegments));
      }
    }
  }, [asset]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        cursor: "move",
        zIndex: asset.zIndex || 0,
        isolation: "isolate",
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
              style={{ overflow: "visible", pointerEvents: "all" }}
            >
              {/* Render legacy segments only when we DON'T have node-edge data */}
              {!asset.wallNodes &&
                asset.wallSegments &&
                asset.wallSegments.length > 0 &&
                (() => {
                  const mmToPx = 2.000021;
                  const unitScale = mmToPx * asset.scale;
                  const wallThicknessMm = asset.wallThickness ?? 75;
                  const wallGap = wallThicknessMm;

                  // Wall segments are already in relative coordinates
                  const relativeSegments = asset.wallSegments;

                  // Build wall geometry with mitered corners
                  // buildWallGeometry expects wallThickness as the total wall width (distance between lines)
                  // It will divide by 2 internally to calculate the perpendicular offset
                  const geometry = buildWallGeometry(relativeSegments, wallGap, wallThicknessMm);

                  if (
                    geometry.outerPoints.length === 0 ||
                    geometry.innerPoints.length === 0
                  ) {
                    return null;
                  }

                  const outerPointsScaled = geometry.outerPoints.map((point) => ({
                    x: point.x * unitScale,
                    y: point.y * unitScale,
                  }));

                  const innerPointsScaled = geometry.innerPoints.map((point) => ({
                    x: point.x * unitScale,
                    y: point.y * unitScale,
                  }));

                  const toCommands = (pts: typeof outerPointsScaled) =>
                    pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
                  const outerCommands = toCommands(outerPointsScaled);
                  const innerCommands = toCommands([...innerPointsScaled].reverse());
                  const outerPath = `${outerCommands} Z`;
                  const innerPath = `${innerCommands} Z`;
                  const ringPath = `${outerCommands} Z ${innerCommands} Z`;

                  const strokeWidth = Math.max(1.2, asset.scale * 1.2);
                  const bandFill = asset.backgroundColor ?? asset.fillColor ?? "#f8fafc";
                  return (
                    <>
                      <path d={ringPath} fill={bandFill} fillRule="evenodd" />
                      <path
                        d={outerPath}
                        fill="none"
                        stroke={asset.lineColor ?? "#000000"}
                        strokeWidth={strokeWidth}
                        strokeLinejoin="round"
                        strokeLinecap="square"
                      />
                      <path
                        d={innerPath}
                        fill="none"
                        stroke={asset.lineColor ?? "#000000"}
                        strokeWidth={strokeWidth}
                        strokeLinejoin="round"
                        strokeLinecap="square"
                      />
                      {showDebugOutlines && (
                        <>
                          <path d={outerPath} fill="none" stroke="#FF00FF" strokeWidth={1} strokeDasharray="4,4" />
                          <path d={innerPath} fill="none" stroke="#FF00FF" strokeWidth={1} strokeDasharray="4,4" />
                        </>
                      )}
                    </>
                  );
                })()}

              {/* Node-edge rendering path (takes precedence if present) */}
              {asset.wallNodes &&
                asset.wallEdges &&
                asset.wallEdges.length > 0 &&
                (() => {
                  const mmToPx = 2.000021;
                  const unitScale = mmToPx * asset.scale;
                  const wallThicknessMm = asset.wallThickness ?? 75;
                  const wallGap = wallThicknessMm;

                  // Convert edges into segments (absolute -> relative to asset center)
                  const segments = asset.wallEdges.map((edge) => {
                    const a = asset.wallNodes![edge.a];
                    const b = asset.wallNodes![edge.b];
                    return {
                      start: { x: a.x - asset.x, y: a.y - asset.y },
                      end: { x: b.x - asset.x, y: b.y - asset.y },
                    };
                  });

                  // Build wall geometry with mitered corners
                  // buildWallGeometry expects wallThickness as the total wall width (distance between lines)
                  // It will divide by 2 internally to calculate the perpendicular offset
                  const geometry = buildWallGeometry(segments, wallGap, wallThicknessMm);

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
                    x: p.x * unitScale,
                    y: p.y * unitScale,
                  }));
                  const innerPointsScaled = geometry.innerPoints.map((p) => ({
                    x: p.x * unitScale,
                    y: p.y * unitScale,
                  }));
                  const toCommands = (pts: typeof outerPointsScaled) =>
                    pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
                  const outerCommands = toCommands(outerPointsScaled);
                  const innerCommands = toCommands([...innerPointsScaled].reverse());
                  const outerPath = `${outerCommands} Z`;
                  const innerPath = `${innerCommands} Z`;
                  const ringPath = `${outerCommands} Z ${innerCommands} Z`;
                  const strokeWidth = Math.max(1.2, asset.scale * 1.2);
                  const bandFill = asset.backgroundColor ?? asset.fillColor ?? "#f8fafc";
                  return (
                    <>
                      <path d={ringPath} fill={bandFill} fillRule="evenodd" />
                      <path
                        d={outerPath}
                        fill="none"
                        stroke={asset.lineColor ?? "#000000"}
                        strokeWidth={strokeWidth}
                        strokeLinejoin="round"
                        strokeLinecap="square"
                      />
                      <path
                        d={innerPath}
                        fill="none"
                        stroke={asset.lineColor ?? "#000000"}
                        strokeWidth={strokeWidth}
                        strokeLinejoin="round"
                        strokeLinecap="square"
                      />
                    </>
                  );
                })()}
            </svg>

          </>
        );
      })()}
    </div>
  );
}