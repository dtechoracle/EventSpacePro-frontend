"use client";

import React, { useMemo } from "react";
import { AssetInstance } from "@/store/sceneStore";

interface PlanPreviewProps {
  assets: AssetInstance[];
  width?: number;
  height?: number;
  className?: string;
}

export default function PlanPreview({
  assets,
  width = 300,
  height = 200,
  className = ""
}: PlanPreviewProps) {
  const MM_TO_PX = 2;

  // Debug: Log assets received
  React.useEffect(() => {
    if (assets && assets.length > 0) {
      console.log('PlanPreview: Rendering', assets.length, 'assets', assets);
      assets.forEach((asset, idx) => {
        console.log(`Asset ${idx}:`, {
          id: asset.id,
          type: asset.type,
          x: asset.x,
          y: asset.y,
          width: asset.width,
          height: asset.height,
          hasWallNodes: !!asset.wallNodes,
          hasWallSegments: !!asset.wallSegments,
          wallNodesCount: asset.wallNodes?.length || 0,
          wallSegmentsCount: asset.wallSegments?.length || 0
        });
      });
    } else {
      console.log('PlanPreview: No assets provided');
    }
  }, [assets]);

  // Calculate bounding box of all assets to determine viewBox
  const bounds = useMemo(() => {
    if (!assets || !Array.isArray(assets) || assets.length === 0) {
      return { minX: 0, minY: 0, maxX: width, maxY: height, centerX: width / 2, centerY: height / 2 };
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let hasValidBounds = false;

    assets.forEach(asset => {
      if (!asset) return;

      if (asset.type === 'wall-segments') {
        // Handle wall nodes
        if (asset.wallNodes && Array.isArray(asset.wallNodes) && asset.wallNodes.length > 0) {
          asset.wallNodes.forEach(node => {
            if (node && isFinite(node.x) && isFinite(node.y)) {
              minX = Math.min(minX, node.x);
              minY = Math.min(minY, node.y);
              maxX = Math.max(maxX, node.x);
              maxY = Math.max(maxY, node.y);
              hasValidBounds = true;
            }
          });
        }
        // Handle legacy wall segments
        if (asset.wallSegments && Array.isArray(asset.wallSegments) && asset.wallSegments.length > 0) {
          asset.wallSegments.forEach(seg => {
            if (seg && seg.start && seg.end) {
              const startX = (seg.start.x || 0) + (asset.x || 0);
              const startY = (seg.start.y || 0) + (asset.y || 0);
              const endX = (seg.end.x || 0) + (asset.x || 0);
              const endY = (seg.end.y || 0) + (asset.y || 0);
              if (isFinite(startX) && isFinite(startY)) {
                minX = Math.min(minX, startX, endX);
                minY = Math.min(minY, startY, endY);
                maxX = Math.max(maxX, startX, endX);
                maxY = Math.max(maxY, startY, endY);
                hasValidBounds = true;
              }
            }
          });
        }
      } else if (asset.type === 'freehand') {
        // Handle freehand drawings
        const freehandAsset = asset as any;
        if (freehandAsset.points && Array.isArray(freehandAsset.points) && freehandAsset.points.length > 0) {
          freehandAsset.points.forEach((p: any) => {
            const px = p.x + asset.x;
            const py = p.y + asset.y;
            if (isFinite(px) && isFinite(py)) {
              minX = Math.min(minX, px);
              minY = Math.min(minY, py);
              maxX = Math.max(maxX, px);
              maxY = Math.max(maxY, py);
              hasValidBounds = true;
            }
          });
        }
      } else {
        // Handle regular assets
        if (isFinite(asset.x) && isFinite(asset.y)) {
          const w = (asset.width || 50) * (asset.scale || 1);
          const h = (asset.height || 50) * (asset.scale || 1);
          minX = Math.min(minX, asset.x - w / 2);
          minY = Math.min(minY, asset.y - h / 2);
          maxX = Math.max(maxX, asset.x + w / 2);
          maxY = Math.max(maxY, asset.y + h / 2);
          hasValidBounds = true;
        }
      }
    });

    if (!hasValidBounds || !isFinite(minX)) {
      // Default to a reasonable viewBox if no valid bounds
      return { minX: 0, minY: 0, maxX: 10000, maxY: 10000, centerX: 5000, centerY: 5000 };
    }

    // Ensure we have valid dimensions
    const boundsWidth = maxX - minX;
    const boundsHeight = maxY - minY;

    if (boundsWidth <= 0 || boundsHeight <= 0) {
      // If bounds are invalid, add padding around center
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const defaultSize = 1000;
      return {
        minX: centerX - defaultSize,
        minY: centerY - defaultSize,
        maxX: centerX + defaultSize,
        maxY: centerY + defaultSize,
        centerX,
        centerY
      };
    }

    const padding = Math.max(100, Math.min(boundsWidth * 0.1, boundsHeight * 0.1, 500)); // Dynamic padding
    return {
      minX: minX - padding,
      minY: minY - padding,
      maxX: maxX + padding,
      maxY: maxY + padding,
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2
    };
  }, [assets, width, height]);

  const viewBoxWidth = bounds.maxX - bounds.minX || width;
  const viewBoxHeight = bounds.maxY - bounds.minY || height;
  const viewBox = `${bounds.minX} ${bounds.minY} ${viewBoxWidth} ${viewBoxHeight}`;

  // Render asset preview
  const renderAsset = (asset: AssetInstance): React.ReactNode[] | null => {
    if (!asset) return null;

    if (asset.type === 'wall-segments') {
      if (asset.wallNodes && asset.wallEdges && asset.wallEdges.length > 0) {
        // Render wall edges
        return asset.wallEdges.map((edge, idx) => {
          const a = asset.wallNodes![edge.a];
          const b = asset.wallNodes![edge.b];
          if (!a || !b) return null;

          // Calculate wall vector
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len === 0) return null;

          // Calculate normal vector for thickness
          const thickness = Math.max(1, (asset.wallThickness || 150) * (asset.scale || 1));
          const nx = (-dy / len) * (thickness / 2);
          const ny = (dx / len) * (thickness / 2);

          // Calculate corner points
          const p1x = a.x + nx;
          const p1y = a.y + ny;
          const p2x = b.x + nx;
          const p2y = b.y + ny;
          const p3x = b.x - nx;
          const p3y = b.y - ny;
          const p4x = a.x - nx;
          const p4y = a.y - ny;

          return (
            <g key={`wall-${asset.id}-${idx}`}>
              {/* Wall Fill - Lighter for double-line look */}
              <path
                d={`M ${p1x} ${p1y} L ${p2x} ${p2y} L ${p3x} ${p3y} L ${p4x} ${p4y} Z`}
                fill="#e5e7eb"
                stroke="none"
              />
              {/* Wall Outlines - Explicit double lines */}
              <line
                x1={p1x} y1={p1y}
                x2={p2x} y2={p2y}
                stroke={asset.lineColor || "#000000"}
                strokeWidth={2}
                strokeLinecap="square"
              />
              <line
                x1={p3x} y1={p3y}
                x2={p4x} y2={p4y}
                stroke={asset.lineColor || "#000000"}
                strokeWidth={2}
                strokeLinecap="square"
              />
            </g>
          );
        }).filter(Boolean) as React.ReactNode[];
      } else if (asset.wallSegments && Array.isArray(asset.wallSegments) && asset.wallSegments.length > 0) {
        // Render legacy wall segments (relative to asset position)
        return asset.wallSegments
          .filter(seg => seg && seg.start && seg.end)
          .map((seg, idx) => {
            const startX = (seg.start.x || 0) + (asset.x || 0);
            const startY = (seg.start.y || 0) + (asset.y || 0);
            const endX = (seg.end.x || 0) + (asset.x || 0);
            const endY = (seg.end.y || 0) + (asset.y || 0);

            if (!isFinite(startX) || !isFinite(startY) || !isFinite(endX) || !isFinite(endY)) {
              return null;
            }

            return (
              <line
                key={`wall-seg-${asset.id}-${idx}`}
                x1={startX}
                y1={startY}
                x2={endX}
                y2={endY}
                stroke={asset.lineColor || "#000000"}
                strokeWidth={Math.max(1, (asset.wallThickness || 2) * (asset.scale || 1))}
                strokeLinecap="round"
              />
            );
          })
          .filter(Boolean) as React.ReactNode[];
      }
      return null;
    }

    // Handle freehand drawings
    if (asset.type === 'freehand') {
      const freehandAsset = asset as any;
      if (freehandAsset.points && Array.isArray(freehandAsset.points) && freehandAsset.points.length > 1) {
        const pathData = `M ${freehandAsset.points[0].x + asset.x} ${freehandAsset.points[0].y + asset.y} ` +
          freehandAsset.points.slice(1).map((p: any) => `L ${p.x + asset.x} ${p.y + asset.y}`).join(' ');

        return [
          <path
            key={asset.id}
            d={pathData}
            fill="none"
            stroke={asset.strokeColor || freehandAsset.stroke || "#000000"}
            strokeWidth={Math.max(1, (asset.strokeWidth || 2) * (asset.scale || 1))}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ];
      }
    }

    // Render shapes and other assets
    const w = (asset.width || 50) * (asset.scale || 1);
    const h = (asset.height || 50) * (asset.scale || 1);

    // Skip if dimensions are invalid
    if (w <= 0 || h <= 0 || !isFinite(asset.x) || !isFinite(asset.y)) {
      return null;
    }

    const x = asset.x - w / 2;
    const y = asset.y - h / 2;

    if (asset.type === 'circle' || asset.type === 'round-table' || asset.type === 'ellipse') {
      return [
        <ellipse
          key={asset.id}
          cx={asset.x}
          cy={asset.y}
          rx={Math.max(1, w / 2)}
          ry={Math.max(1, h / 2)}
          fill={asset.backgroundColor || asset.fillColor || "#e5e7eb"}
          stroke={asset.strokeColor || "#000000"}
          strokeWidth={Math.max(0.5, (asset.strokeWidth || 1) * (asset.scale || 1))}
          transform={asset.rotation ? `rotate(${asset.rotation} ${asset.x} ${asset.y})` : undefined}
        />
      ];
    } else {
      // Render rectangles, tables, and other rectangular assets
      return [
        <rect
          key={asset.id}
          x={x}
          y={y}
          width={w}
          height={h}
          fill={asset.backgroundColor || asset.fillColor || "#e5e7eb"}
          stroke={asset.strokeColor || "#000000"}
          strokeWidth={Math.max(0.5, (asset.strokeWidth || 1) * (asset.scale || 1))}
          transform={asset.rotation ? `rotate(${asset.rotation} ${asset.x} ${asset.y})` : undefined}
        />
      ];
    }
  };

  const renderedAssets = assets
    ? assets.map(renderAsset)
      .filter(Boolean)
      .flat() as React.ReactNode[]
    : [];

  // If no valid assets, show placeholder
  if (renderedAssets.length === 0) {
    const hasAssetsButNoRender = assets && Array.isArray(assets) && assets.length > 0;
    return (
      <div className={`relative ${className} flex items-center justify-center`} style={{ width: '100%', height: '100%', minHeight: height, background: '#f9fafb' }}>
        <div className="text-center text-gray-400">
          <div className="text-2xl mb-2">📐</div>
          <div className="text-xs">
            {hasAssetsButNoRender
              ? `${assets.length} asset(s) found but couldn't render`
              : 'No preview available'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} style={{ width: '100%', height: '100%', minHeight: height }}>
      <svg
        width="100%"
        height="100%"
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 w-full h-full"
        style={{ background: '#f9fafb' }}
      >
        {/* Debug: Show bounds if needed */}
        {process.env.NODE_ENV === 'development' && (
          <rect
            x={bounds.minX}
            y={bounds.minY}
            width={bounds.maxX - bounds.minX}
            height={bounds.maxY - bounds.minY}
            fill="none"
            stroke="red"
            strokeWidth="1"
            strokeDasharray="2,2"
            opacity="0.3"
          />
        )}
        {renderedAssets}
      </svg>
    </div>
  );
}