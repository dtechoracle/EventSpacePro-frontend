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

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={canvasPxW}
      height={canvasPxH}
      style={{ zIndex: 5 }}
    >
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

      {/* === WALL DRAWING MODE === */}
      {wallDrawingMode && (
        <>
          {/* Completed walls */}
          {currentWallSegments.length > 0 && (() => {
            const wallThickness = 1;
            const wallGap = 8;

            const segmentsInMM = currentWallSegments.map((segment) => ({
              start: { x: segment.start.x, y: segment.start.y },
              end: { x: segment.end.x, y: segment.end.y }
            }));

            const wallAssets = assets.filter(
              (asset) => asset.wallSegments && asset.wallSegments.length > 0
            );

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

            const geometry = buildWallGeometry(mergedSegments, wallGap);
            if (!geometry.outerPoints.length || !geometry.innerPoints.length) return null;

            const outerPath = geometry.outerPoints
              .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x * mmToPx} ${p.y * mmToPx}`)
              .join(' ');
            const innerPath = geometry.innerPoints
              .slice()
              .reverse()
              .map((p) => `L ${p.x * mmToPx} ${p.y * mmToPx}`)
              .join(' ');

            return (
              <path
                d={`${outerPath} ${innerPath} Z`}
                fill="none"
                stroke="#000000"
                strokeWidth={wallThickness}
                strokeLinejoin="round"
              />
            );
          })()}

          {/* Current wall segment */}
          {currentWallStart && currentWallTempEnd && (() => {
            const wallGap = 8;
            const tempSegment = { start: currentWallStart, end: currentWallTempEnd };
            const geometry = buildWallGeometry([tempSegment], wallGap);
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

