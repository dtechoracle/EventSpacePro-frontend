import React from 'react';
import { AssetInstance, useSceneStore } from '@/store/sceneStore';
import {
  buildWallGeometry,
  findNearbyWallSegment,
  mergeWallSegments
} from '@/lib/wallGeometry';

interface DrawingPathProps {
  isDrawing: boolean;
  tempPath: { x: number; y: number }[];
  wallDrawingMode: boolean;
  currentWallSegments: { start: { x: number; y: number }; end: { x: number; y: number } }[];
  currentWallStart: { x: number; y: number } | null;
  currentWallTempEnd: { x: number; y: number } | null;
  assets: AssetInstance[];
  canvasPxW: number;
  canvasPxH: number;
  mmToPx: number;
  lastMousePosition: { x: number; y: number };
  clientToCanvasMM: (clientX: number, clientY: number) => { x: number; y: number };
  isRectangularSelectionMode: boolean;
  rectangularSelectionStart: { x: number; y: number } | null;
  rectangularSelectionEnd: { x: number; y: number } | null;
}

function normalizeAngle(a: number) {
  let angle = ((a + 180) % 360) - 180;
  if (angle < -180) angle += 360;
  return angle;
}

/** Convert geometry (outerPoints + innerPoints) into a single SVG path string (mm coords -> px applied outside) */
function geometryToPathD(geometry: { outerPoints: { x: number; y: number }[]; innerPoints: { x: number; y: number }[] }, mmToPx: number) {
  if (!geometry || !geometry.outerPoints?.length) return '';
  const outer = geometry.outerPoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x * mmToPx} ${p.y * mmToPx}`)
    .join(' ');
  // inner points should be appended in reverse to close correctly
  const inner = (geometry.innerPoints || [])
    .slice()
    .reverse()
    .map((p, i) => `L ${p.x * mmToPx} ${p.y * mmToPx}`)
    .join(' ');
  return `${outer} ${inner} Z`;
}

export default function DrawingPath({
  isDrawing,
  tempPath,
  wallDrawingMode,
  currentWallSegments,
  currentWallStart,
  currentWallTempEnd,
  assets,
  canvasPxW,
  canvasPxH,
  mmToPx,
  isRectangularSelectionMode,
  rectangularSelectionStart,
  rectangularSelectionEnd
}: DrawingPathProps) {
  const shapeMode = useSceneStore((s) => s.shapeMode);
  const shapeStart = useSceneStore((s) => s.shapeStart);
  const shapeTempEnd = useSceneStore((s) => s.shapeTempEnd);

  if (!isDrawing && !wallDrawingMode && !shapeMode && !isRectangularSelectionMode) return null;

  /**
   * Build a list of "wall geometries" (outer + inner) for:
   *  - each asset that has wallSegments
   *  - the completed currentWallSegments (joined/merged if necessary)
   *  - the currently previewed temp segment (if present)
   *
   * We'll render these polygons into the mask (black = transparent area).
   */
  const wallGap = 8; // thickness gap used for geometry generation (mm)
  const wallGeometries: Array<{ outerPoints: { x: number; y: number }[]; innerPoints: { x: number; y: number }[] }> = [];

  // 1) asset walls (each asset may already contain full polygons or segments)
  const wallAssets = assets.filter((asset) => asset.wallSegments && asset.wallSegments.length > 0);
  for (const asset of wallAssets) {
    try {
      // assume asset.wallSegments is in the same segment format your buildWallGeometry expects
      const geom = buildWallGeometry(asset.wallSegments, wallGap);
      if (geom && geom.outerPoints?.length && geom.innerPoints?.length) {
        wallGeometries.push(geom);
      }
    } catch (err) {
      // swallow errors per-asset so mask generation does not break the UI
      // console.warn('Failed building geometry for asset', err);
    }
  }

  // 2) completed current wall segments (the in-progress multi-segment wall)
  if (currentWallSegments && currentWallSegments.length > 0) {
    const segmentsInMM = currentWallSegments.map((segment) => ({
      start: { x: segment.start.x, y: segment.start.y },
      end: { x: segment.end.x, y: segment.end.y }
    }));

    let mergedSegments = segmentsInMM;
    let connectedAsset: AssetInstance | null = null;

    if (segmentsInMM.length > 0) {
      const firstPoint = segmentsInMM[0].start;
      const lastPoint = segmentsInMM[segmentsInMM.length - 1].end;
      const firstConnection = findNearbyWallSegment(firstPoint, wallAssets);
      const lastConnection = findNearbyWallSegment(lastPoint, wallAssets);
      if (firstConnection) connectedAsset = firstConnection.asset;
      else if (lastConnection) connectedAsset = lastConnection.asset;
      if (connectedAsset) mergedSegments = mergeWallSegments(segmentsInMM, connectedAsset);
    }

    try {
      const geom = buildWallGeometry(mergedSegments, wallGap);
      if (geom && geom.outerPoints?.length && geom.innerPoints?.length) {
        wallGeometries.push(geom);
      }
    } catch (err) {
      // console.warn('Failed building geometry for current wall segments', err);
    }
  }

  // 3) current temp segment (the segment you're currently dragging / previewing)
  if (currentWallStart && currentWallTempEnd) {
    try {
      const tempSegment = { start: currentWallStart, end: currentWallTempEnd };
      const geom = buildWallGeometry([tempSegment], wallGap);
      if (geom && geom.outerPoints?.length && geom.innerPoints?.length) {
        wallGeometries.push(geom);
      }
    } catch (err) {
      // console.warn('Failed building geometry for temp segment', err);
    }
  }

  // convert all geometries to path d strings (so they can be rendered in mask and stroked)
  const wallPathDs = wallGeometries.map((g) => geometryToPathD(g, mmToPx)).filter(Boolean);

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={canvasPxW}
      height={canvasPxH}
      style={{ zIndex: 5 }}
    >
      <defs>
        {/* mask: white = visible, black = transparent (void) */}
        <mask id="wallVoidMask">
          <rect width="100%" height="100%" fill="white" />
          {wallPathDs.map((d, i) => (
            <path key={`mask-wall-${i}`} d={d} fill="black" stroke="none" />
          ))}
        </mask>
      </defs>

      {/* ===============================
          Everything that should be hidden by walls goes inside this group
          (the mask will remove any pixels that fall inside wall polygons)
          =============================== */}
      <g mask="url(#wallVoidMask)">
        {/* === SHAPE DRAWING PREVIEW === */}
        {shapeMode && shapeStart && shapeTempEnd && (() => {
          const x1 = shapeStart.x * mmToPx;
          const y1 = shapeStart.y * mmToPx;
          const x2 = shapeTempEnd.x * mmToPx;
          const y2 = shapeTempEnd.y * mmToPx;
          const left = Math.min(x1, x2);
          const top = Math.min(y1, y2);
          const w = Math.abs(x2 - x1);
          const h = Math.abs(y2 - y1);

          if (shapeMode === 'rectangle')
            return (
              <rect
                x={left}
                y={top}
                width={w}
                height={h}
                fill="none"
                stroke="#111827"
                strokeWidth={1.5}
                strokeDasharray="6,4"
              />
            );
          if (shapeMode === 'ellipse')
            return (
              <ellipse
                cx={left + w / 2}
                cy={top + h / 2}
                rx={w / 2}
                ry={h / 2}
                fill="none"
                stroke="#111827"
                strokeWidth={1.5}
                strokeDasharray="6,4"
              />
            );
          if (shapeMode === 'line')
            return (
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#111827"
                strokeWidth={2}
                strokeDasharray="6,4"
              />
            );
          return null;
        })()}

        {/* === PEN DRAWING === */}
        {isDrawing && tempPath.length > 0 && !wallDrawingMode && (
          tempPath.length === 1 ? (
            <circle
              cx={tempPath[0].x * mmToPx}
              cy={tempPath[0].y * mmToPx}
              r="2"
              fill="#000000"
            />
          ) : (
            <path
              d={`M ${tempPath[0].x * mmToPx} ${tempPath[0].y * mmToPx} ${tempPath
                .slice(1)
                .map((p) => `L ${p.x * mmToPx} ${p.y * mmToPx}`)
                .join(' ')}`}
              stroke="#000000"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )
        )}

        {/* === RECTANGULAR SELECTION (if any) === */}
        {isRectangularSelectionMode && rectangularSelectionStart && rectangularSelectionEnd && (() => {
          const x1 = rectangularSelectionStart.x * mmToPx;
          const y1 = rectangularSelectionStart.y * mmToPx;
          const x2 = rectangularSelectionEnd.x * mmToPx;
          const y2 = rectangularSelectionEnd.y * mmToPx;
          const left = Math.min(x1, x2);
          const top = Math.min(y1, y2);
          const w = Math.abs(x2 - x1);
          const h = Math.abs(y2 - y1);
          return (
            <rect
              x={left}
              y={top}
              width={w}
              height={h}
              fill="none"
              stroke="#2563EB"
              strokeWidth={1.5}
              strokeDasharray="4,4"
            />
          );
        })()}

        {/* You can also render other scene layers here: assets, background grid, selection highlights, etc.
            Because they are inside the mask group, anything inside wall polygons will be hidden (void).
         */}
      </g>

      {/* ===============================
          Wall outlines / edges (drawn on top so we still see wall edges)
          These do NOT participate in the mask (so their strokes still show).
          =============================== */}
      {wallPathDs.map((d, i) => (
        <path
          key={`wall-outline-${i}`}
          d={d}
          fill="none"
          stroke="#000000"
          strokeWidth={2}
          strokeLinejoin="round"
        />
      ))}

      {/* === WALL DRAWING MODE (existing logic for current segment guides & preview) === */}
      {wallDrawingMode && (
        <>
          {/* Current wall segment preview + guides */}
          {currentWallStart && currentWallTempEnd && (() => {
            const wallGapLocal = 8;
            const tempSegment = { start: currentWallStart, end: currentWallTempEnd };
            const geometry = buildWallGeometry([tempSegment], wallGapLocal);
            if (!geometry.outerPoints.length) return null;

            const startPx = { x: currentWallStart.x * mmToPx, y: currentWallStart.y * mmToPx };
            const endPx = { x: currentWallTempEnd.x * mmToPx, y: currentWallTempEnd.y * mmToPx };

            const dx = currentWallTempEnd.x - currentWallStart.x;
            const dy = currentWallTempEnd.y - currentWallStart.y;
            const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
            const TOL = 3;

            const guideLines: React.JSX.Element[] = [];
            const guideTexts: React.JSX.Element[] = [];

            // --- Base guides (for first segment as well)
            const verticalDelta = Math.abs(normalizeAngle(angleDeg - 90));
            const horizontalDelta = Math.abs(normalizeAngle(angleDeg));
            const isVertical = verticalDelta < TOL;
            const isHorizontal = horizontalDelta < TOL;

            const axisColor = isVertical || isHorizontal ? '#22C55E' : '#EF4444';
            const axisLabel = isVertical
              ? 'Vertical'
              : isHorizontal
              ? 'Horizontal'
              : 'Axis guide';

            if (isVertical || (!isVertical && !isHorizontal)) {
              guideLines.push(
                <line
                  key="axis-v"
                  x1={endPx.x}
                  y1={0}
                  x2={endPx.x}
                  y2={canvasPxH}
                  stroke={axisColor}
                  strokeWidth={1.5}
                  opacity={0.9}
                  strokeDasharray="5,5"
                />
              );
            }
            if (isHorizontal || (!isVertical && !isHorizontal)) {
              guideLines.push(
                <line
                  key="axis-h"
                  x1={0}
                  y1={endPx.y}
                  x2={canvasPxW}
                  y2={endPx.y}
                  stroke={axisColor}
                  strokeWidth={1.5}
                  opacity={0.9}
                  strokeDasharray="5,5"
                />
              );
            }

            guideTexts.push(
              <text
                key="axis-text"
                x={endPx.x + 8}
                y={endPx.y - 8}
                fill={axisColor}
                fontSize={12}
                fontWeight="600"
              >
                {axisLabel}
              </text>
            );

            // Keep perpendicular + parallel for later segments
            if (currentWallSegments.length > 0) {
              const firstSeg = currentWallSegments[0];
              const fx = firstSeg.end.x - firstSeg.start.x;
              const fy = firstSeg.end.y - firstSeg.start.y;
              const firstAngle = (Math.atan2(fy, fx) * 180) / Math.PI;

              const angleToFirst = normalizeAngle(angleDeg - firstAngle);
              const angleToPerp = normalizeAngle(angleDeg - (firstAngle + 90));

              const isParallel = Math.abs(angleToFirst) < TOL;
              const isPerpendicular = Math.abs(angleToPerp) < TOL;
              const showPerp = Math.abs(angleToFirst) > 30 && Math.abs(angleToFirst - 180) > 30;

              if (showPerp) {
                const color = isPerpendicular ? '#22C55E' : '#EF4444';
                const startX = firstSeg.start.x * mmToPx;
                const startY = firstSeg.start.y * mmToPx;
                const isFirstHorizontal = Math.abs(firstAngle % 180) < TOL;
                if (isFirstHorizontal) {
                  guideLines.push(
                    <line key="perp-v" x1={startX} y1={0} x2={startX} y2={canvasPxH}
                      stroke={color} strokeWidth={1.5} opacity={0.9} strokeDasharray="5,5" />
                  );
                } else {
                  guideLines.push(
                    <line key="perp-h" x1={0} y1={startY} x2={canvasPxW} y2={startY}
                      stroke={color} strokeWidth={1.5} opacity={0.9} strokeDasharray="5,5" />
                  );
                }
              }
            }

            const fullPath = (() => {
              const outer = geometry.outerPoints
                .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x * mmToPx} ${p.y * mmToPx}`)
                .join(' ');
              const inner = geometry.innerPoints
                .slice()
                .reverse()
                .map((p) => `L ${p.x * mmToPx} ${p.y * mmToPx}`)
                .join(' ');
              return `${outer} ${inner} Z`;
            })();

            return (
              <>
                <path
                  d={fullPath}
                  fill="none"
                  stroke="#000"
                  strokeWidth="2"
                  strokeDasharray="6,4"
                  opacity="0.8"
                />
                {guideLines}
                {guideTexts}
              </>
            );
          })()}

          {currentWallStart && (
            <circle
              cx={currentWallStart.x * mmToPx}
              cy={currentWallStart.y * mmToPx}
              r="3"
              fill="#000"
              stroke="white"
              strokeWidth="1"
            />
          )}
        </>
      )}
    </svg>
  );
}

