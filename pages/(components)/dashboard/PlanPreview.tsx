"use client";

import React, { useMemo } from "react";
import { AssetInstance } from "@/store/sceneStore";
import { ASSET_LIBRARY } from "@/lib/assets";
import { InlineSvg } from "@/components/tools/InlineSvg";

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

  // Calculate bounding box of all assets to determine view scale and offset
  const { minX, minY, contentWidth, contentHeight } = useMemo(() => {
    if (!assets || !Array.isArray(assets) || assets.length === 0) {
      return { minX: 0, minY: 0, contentWidth: 1000, contentHeight: 1000 };
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let hasValidBounds = false;

    assets.forEach(asset => {
      if (!asset) return;

      if (asset.type === 'wall-segments') {
        const checkNode = (x: number, y: number) => {
          if (isFinite(x) && isFinite(y)) {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
            hasValidBounds = true;
          }
        };

        if (asset.wallNodes && Array.isArray(asset.wallNodes) && asset.wallNodes.length > 0) {
          asset.wallNodes.forEach(node => checkNode(node.x, node.y));
        }
        if (asset.wallSegments && Array.isArray(asset.wallSegments)) {
          asset.wallSegments.forEach(seg => {
            if (seg.start) checkNode(seg.start.x + (asset.x || 0), seg.start.y + (asset.y || 0));
            if (seg.end) checkNode(seg.end.x + (asset.x || 0), seg.end.y + (asset.y || 0));
          });
        }
      } else if (asset.type === 'freehand') {
        const freehandAsset = asset as any;
        if (freehandAsset.points && Array.isArray(freehandAsset.points)) {
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

    if (!hasValidBounds) {
      return { minX: 0, minY: 0, contentWidth: 1000, contentHeight: 1000 };
    }

    const w = maxX - minX;
    const h = maxY - minY;

    // Add padding
    const padding = Math.max(100, Math.min(w * 0.1, h * 0.1));
    return {
      minX: minX - padding,
      minY: minY - padding,
      contentWidth: w + padding * 2,
      contentHeight: h + padding * 2
    };
  }, [assets]);

  // Calculate scale to fit
  const scale = Math.min(width / contentWidth, height / contentHeight) || 1;
  const offsetX = (width - contentWidth * scale) / 2;
  const offsetY = (height - contentHeight * scale) / 2;

  const renderAsset = (asset: AssetInstance) => {
    if (!asset) return null;

    // Library Asset (SVG)
    const def = ASSET_LIBRARY.find(a => a.id === asset.type);
    if (def?.path) {
      const w = (asset.width || 24) * (asset.scale || 1);
      const h = (asset.height || 24) * (asset.scale || 1);

      return (
        <div
          key={asset.id}
          style={{
            position: 'absolute',
            left: asset.x,
            top: asset.y,
            width: w,
            height: h,
            transform: `translate(-50%, -50%) rotate(${asset.rotation || 0}deg)`,
            zIndex: asset.zIndex || 0,
          }}
        >
          {/* Background */}
          {asset.backgroundColor && asset.backgroundColor !== "transparent" && (
            <div style={{ position: 'absolute', inset: 0, backgroundColor: asset.backgroundColor, zIndex: -1 }} />
          )}
          <InlineSvg
            src={def.path}
            fill={asset.fillColor}
            stroke={asset.strokeColor}
            strokeWidth={asset.strokeWidth}
          />
        </div>
      );
    }

    // Shapes
    const w = (asset.width || 50) * (asset.scale || 1);
    const h = (asset.height || 50) * (asset.scale || 1);

    // Common styles
    const style: React.CSSProperties = {
      position: 'absolute',
      left: asset.x,
      top: asset.y,
      width: w,
      height: h,
      transform: `translate(-50%, -50%) rotate(${asset.rotation || 0}deg)`,
      zIndex: asset.zIndex || 0,
    };

    if (asset.type === 'circle' || asset.type === 'ellipse' || asset.type === 'round-table') {
      return (
        <div key={asset.id} style={{
          ...style,
          borderRadius: '50%',
          backgroundColor: asset.backgroundColor || asset.fillColor || '#e5e7eb',
          border: `${Math.max(1, (asset.strokeWidth || 1) * (asset.scale || 1))}px solid ${asset.strokeColor || '#000000'}`
        }} />
      );
    }

    if (asset.type === 'rect' || asset.type === 'square' || !asset.type) {
      return (
        <div key={asset.id} style={{
          ...style,
          backgroundColor: asset.backgroundColor || asset.fillColor || '#e5e7eb',
          border: `${Math.max(1, (asset.strokeWidth || 1) * (asset.scale || 1))}px solid ${asset.strokeColor || '#000000'}`
        }} />
      );
    }

    // Line
    if (asset.type === 'line') {
      return (
        <div key={asset.id} style={{
          position: 'absolute',
          left: asset.x,
          top: asset.y,
          width: w,
          height: (asset.strokeWidth || 2) * (asset.scale || 1),
          backgroundColor: asset.strokeColor || '#000000',
          transform: `translate(-50%, -50%) rotate(${asset.rotation || 0}deg)`,
          zIndex: asset.zIndex || 0,
        }} />
      );
    }

    // Walls (simplified rendering for preview)
    if (asset.type === 'wall-segments') {
      return (
        <div key={asset.id} style={{ position: 'absolute', top: 0, left: 0, width: 0, height: 0 }}>
          {asset.wallEdges?.map((edge, i) => {
            const nA = asset.wallNodes?.[edge.a];
            const nB = asset.wallNodes?.[edge.b];
            if (!nA || !nB) return null;

            const dx = nB.x - nA.x;
            const dy = nB.y - nA.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;
            const thickness = (asset.wallThickness || 150) * (asset.scale || 1);

            return (
              <div key={i} style={{
                position: 'absolute',
                left: nA.x,
                top: nA.y,
                width: len,
                height: thickness,
                backgroundColor: '#e5e7eb',
                borderTop: '2px solid black',
                borderBottom: '2px solid black',
                transformOrigin: '0 50%',
                transform: `translateY(-50%) rotate(${angle}deg)`,
                zIndex: (asset.zIndex || 0),
                boxSizing: 'border-box'
              }} />
            );
          })}
        </div>
      );
    }

    return null;
  };

  const renderedAssets = assets
    ? assets.map(renderAsset).filter(Boolean)
    : [];

  if (renderedAssets.length === 0) {
    return (
      <div className={`relative ${className} flex items-center justify-center bg-gray-50 border border-gray-200 rounded`} style={{ width: '100%', height: '100%', minHeight: height }}>
        <div className="text-center text-gray-400">
          <div className="text-xl mb-1">📐</div>
          <div className="text-[10px]">No Content</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-gray-50 ${className}`} style={{ width: '100%', height: '100%', minHeight: height }}>
      <div
        style={{
          position: 'absolute',
          left: offsetX,
          top: offsetY,
          width: contentWidth,
          height: contentHeight,
          transform: `scale(${scale})`,
          transformOrigin: '0 0',
          // Translate world coordinates
          marginLeft: -minX * scale,
          marginTop: -minY * scale,
        }}
      // Apply counter-scale to margin to effectively translate the content
      // Actually, cleaner approach:
      // The container is placed at (offsetX, offsetY)
      // Inside it, we want (minX, minY) to align with (0,0) of this container
      >
        <div style={{ position: 'relative', width: '100%', height: '100%', transform: `translate(${-minX}px, ${-minY}px)` }}>
          {renderedAssets}
        </div>
      </div>
    </div>
  );
}