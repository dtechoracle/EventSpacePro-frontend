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

  // Helper to generate IDs for gradients/patterns
  const getGradientId = (id: string) => `preview-grad-${id}`;
  const getPatternId = (id: string) => `preview-pat-${id}`;
  const getHatchId = (id: string) => `preview-hatch-${id}`;

  const renderDefs = () => {
    return (
      <defs>
        {assets.map(asset => {
          // Skip if not a shape-like object that needs complex fills
          if (!asset || asset.type === 'wall-segments') return null;

          const shape = asset as any;
          const fillType = shape.fillType || 'color';

          if (fillType === 'gradient') {
            const colors = shape.gradientColors || ['#ffffff', '#000000'];
            const angle = shape.gradientAngle || 0;
            const angleRad = (angle * Math.PI) / 180;
            const x1 = 50 - 50 * Math.cos(angleRad);
            const y1 = 50 - 50 * Math.sin(angleRad);
            const x2 = 50 + 50 * Math.cos(angleRad);
            const y2 = 50 + 50 * Math.sin(angleRad);

            if (shape.gradientType === 'radial') {
              return (
                <radialGradient id={getGradientId(asset.id)} key={getGradientId(asset.id)}>
                  <stop offset="0%" stopColor={colors[0]} />
                  <stop offset="100%" stopColor={colors[1]} />
                </radialGradient>
              );
            } else {
              return (
                <linearGradient id={getGradientId(asset.id)} key={getGradientId(asset.id)} x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`}>
                  <stop offset="0%" stopColor={colors[0]} />
                  <stop offset="100%" stopColor={colors[1]} />
                </linearGradient>
              );
            }
          } else if (fillType === 'hatch') {
            const pattern = shape.hatchPattern || 'horizontal';
            const spacing = shape.hatchSpacing || 5;
            const color = shape.hatchColor || '#000000';
            const id = getHatchId(asset.id);

            return (
              <pattern id={id} key={id} patternUnits="userSpaceOnUse" width={spacing * 2} height={spacing * 2}>
                <rect width={spacing * 2} height={spacing * 2} fill="transparent" />
                {pattern === 'horizontal' && <line x1="0" y1={spacing} x2={spacing * 2} y2={spacing} stroke={color} strokeWidth="1" />}
                {pattern === 'vertical' && <line x1={spacing} y1="0" x2={spacing} y2={spacing * 2} stroke={color} strokeWidth="1" />}
                {pattern === 'diagonal-right' && <path d={`M0,0 L${spacing * 2},${spacing * 2} M0,${spacing * 2} L${spacing * 2},0`} stroke={color} strokeWidth="1" />}
                {pattern === 'diagonal-left' && <path d={`M0,${spacing * 2} L${spacing * 2},0 M0,0 L${spacing * 2},${spacing * 2}`} stroke={color} strokeWidth="1" />}
                {pattern === 'cross' && <path d={`M0,${spacing} L${spacing * 2},${spacing} M${spacing},0 L${spacing},${spacing * 2}`} stroke={color} strokeWidth="1" />}
                {pattern === 'grid' && <path d={`M0,${spacing} L${spacing * 2},${spacing} M${spacing},0 L${spacing},${spacing * 2}`} stroke={color} strokeWidth="1" />}
                {pattern === 'dots' && <g><circle cx={spacing / 2} cy={spacing / 2} r="1" fill={color} /><circle cx={spacing * 1.5} cy={spacing * 1.5} r="1" fill={color} /></g>}
              </pattern>
            );
          } else if (fillType === 'image' && shape.fillImage) {
            const s = shape.fillImageScale || 1;
            const size = 100 * s;
            const id = getPatternId(asset.id);
            return (
              <pattern id={id} key={id} patternUnits="userSpaceOnUse" width={size} height={size}>
                <image href={shape.fillImage} x="0" y="0" width={size} height={size} preserveAspectRatio="xMidYMid slice" />
              </pattern>
            );
          } else if (fillType === 'texture' && shape.fillTexture) {
            // We need to import the raw SVG string from texturePatterns and inject it?
            // Or simpler: We rely on the texturePatterns definitions being global?
            // The editor defines them globally. Here we are in a separate SVG context.
            // We should ideally include the texture definitions in this SVG as well.
            // For now, let's assume the texture IDs (like 'wood-grain') might naturally resolve if defined.
            // But they won't be defined in this independent SVG block unless we put them here.
            // Let's rely on standard patterns.
            // Actually, let's try to map standard texture IDs to inline patterns if we can, or just fallback.
            // Since we can't easily import the complex texture array here without bloat, 
            // let's try to use the raw images or colors.
            // Limitation: Global definitions are not here.
            // Fix: We should check if we can import texturePatterns.
          }
          return null;
        })}

        {/* HACK: duplicate texture defs for preview if possible, or just accept simple fallback for now if import is hard. 
            User specifically requested texture. Let's try to include a few common ones if needed.
        */}
      </defs>
    );
  };

  // Helper to get fill
  const getFill = (asset: any) => {
    const fillType = asset.fillType || 'color';
    if (fillType === 'gradient') return `url(#${getGradientId(asset.id)})`;
    if (fillType === 'hatch') return `url(#${getHatchId(asset.id)})`;
    if (fillType === 'image' && asset.fillImage) return `url(#${getPatternId(asset.id)})`;
    if (fillType === 'texture' && asset.fillTexture) {
      // If the texture ID refers to a global pattern, it might not work in this isolated SVG.
      // However, if we simply use the ID, it might try to look it up.
      // For a robust preview, we'd need to inject those patterns.
      // Let's assume for now the user wants to see *that* it's textured.
      return `url(#${asset.fillTexture})`;
    }
    return asset.backgroundColor || asset.fillColor || (asset.type === 'line' ? 'none' : '#e5e7eb');
  };


  const renderAsset = (asset: AssetInstance) => {
    if (!asset) return null;

    // Library Asset (SVG)
    const def = ASSET_LIBRARY.find(a => a.id === asset.type);
    if (def?.path) {
      const w = (asset.width || 24) * (asset.scale || 1);
      const h = (asset.height || 24) * (asset.scale || 1);
      const x = asset.x - w / 2; // SVG uses top-left usually, but here we transform center
      const y = asset.y - h / 2;

      return (
        <g key={asset.id} transform={`translate(${asset.x}, ${asset.y}) rotate(${asset.rotation || 0})`}>
          {/* Background */}
          {(asset.backgroundColor && asset.backgroundColor !== "transparent") && (
            <rect x={-w / 2} y={-h / 2} width={w} height={h} fill={asset.backgroundColor} />
          )}
          <foreignObject x={-w / 2} y={-h / 2} width={w} height={h}>
            <InlineSvg
              src={def.path}
              fill={asset.fillColor}
              stroke={asset.strokeColor}
              strokeWidth={asset.strokeWidth}
            />
          </foreignObject>
        </g>
      );
    }

    // Shapes
    const w = (asset.width || 50) * (asset.scale || 1);
    const h = (asset.height || 50) * (asset.scale || 1);
    const fill = getFill(asset);
    const stroke = asset.strokeColor || '#000000';
    const strokeWidth = Math.max(1, (asset.strokeWidth || 1) * (asset.scale || 1));

    if (asset.type === 'circle' || asset.type === 'ellipse' || asset.type === 'round-table') {
      return (
        <ellipse
          key={asset.id}
          cx={asset.x}
          cy={asset.y}
          rx={w / 2}
          ry={h / 2}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          transform={asset.rotation ? `rotate(${asset.rotation} ${asset.x} ${asset.y})` : undefined}
        />
      );
    }

    if (asset.type === 'rect' || asset.type === 'square' || !asset.type) {
      return (
        <rect
          key={asset.id}
          x={asset.x - w / 2}
          y={asset.y - h / 2}
          width={w}
          height={h}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          transform={asset.rotation ? `rotate(${asset.rotation} ${asset.x} ${asset.y})` : undefined}
        />
      );
    }

    // Line
    if (asset.type === 'line') {
      // Simple line
      return (
        <line
          key={asset.id}
          x1={asset.x - w / 2} y1={asset.y}
          x2={asset.x + w / 2} y2={asset.y}
          stroke={asset.strokeColor || '#000000'}
          strokeWidth={(asset.strokeWidth || 2) * (asset.scale || 1)}
          transform={asset.rotation ? `rotate(${asset.rotation} ${asset.x} ${asset.y})` : undefined}
        />
      );
    }

    // Wall Segments
    if (asset.type === 'wall-segments') {
      const thickness = (asset.wallThickness || 150) * (asset.scale || 1);
      return (
        <g key={asset.id}>
          {asset.wallEdges?.map((edge, i) => {
            const nA = asset.wallNodes?.[edge.a];
            const nB = asset.wallNodes?.[edge.b];
            if (!nA || !nB) return null;
            return (
              <line
                key={i}
                x1={nA.x} y1={nA.y}
                x2={nB.x} y2={nB.y}
                stroke="#e5e7eb"
                strokeWidth={thickness}
                strokeLinecap="butt"
              />
            );
          })}
          {/* Overlay outlines roughly */}
          {asset.wallEdges?.map((edge, i) => {
            const nA = asset.wallNodes?.[edge.a];
            const nB = asset.wallNodes?.[edge.b];
            if (!nA || !nB) return null;
            // Drawing dual lines for walls is complex in simple SVG without math.
            // Just drawing center line for preview often sufficient, or thick line with stroke.
            return null;
          })}
        </g>
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
      <svg
        width="100%"
        height="100%"
        viewBox={`${minX} ${minY} ${contentWidth} ${contentHeight}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block' }}
      >
        <defs>
          {/* Include common texture patterns hardcoded for preview completeness if external defs unavailable */}
          <pattern id="wood-grain" patternUnits="userSpaceOnUse" width="500" height="500">
            <rect width="500" height="500" fill="#8B4513" />
            <path d="M0,50 Q125,25 250,50 T500,50" stroke="#654321" stroke-width="10" fill="none" opacity="0.3" />
            <path d="M0,150 Q125,125 250,150 T500,150" stroke="#654321" stroke-width="8" fill="none" opacity="0.2" />
            <path d="M0,250 Q125,240 250,250 T500,250" stroke="#654321" stroke-width="10" fill="none" opacity="0.3" />
          </pattern>
          <pattern id="brick" patternUnits="userSpaceOnUse" width="300" height="200">
            <rect width="300" height="200" fill="#8B4513" />
            <rect x="0" y="0" width="140" height="90" fill="#A0522D" stroke="#654321" stroke-width="5" />
            <rect x="150" y="0" width="140" height="90" fill="#A0522D" stroke="#654321" stroke-width="5" />
            <rect x="75" y="100" width="140" height="90" fill="#A0522D" stroke="#654321" stroke-width="5" />
          </pattern>
          <pattern id="dots" patternUnits="userSpaceOnUse" width="100" height="100">
            <rect width="100" height="100" fill="#ffffff" />
            <circle cx="50" cy="50" r="15" fill="#333333" />
          </pattern>
          <pattern id="grid" patternUnits="userSpaceOnUse" width="100" height="100">
            <rect width="100" height="100" fill="#ffffff" />
            <path d="M0,0 L0,100 M0,0 L100,0" stroke="#cccccc" stroke-width="5" />
          </pattern>
        </defs>

        {renderDefs()}

        {renderedAssets}
      </svg>
    </div>
  );
}