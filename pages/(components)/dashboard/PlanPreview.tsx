"use client";

import React, { useMemo } from "react";
import { AssetInstance } from "@/store/sceneStore";
import { ASSET_LIBRARY } from "@/lib/assets";
import { InlineSvg } from "@/components/tools/InlineSvg";
import { texturePatterns } from "@/utils/texturePatterns";

interface PlanPreviewProps {
  assets?: AssetInstance[];
  walls?: any[];
  shapes?: any[];
  textAnnotations?: any[];
  width?: number;
  height?: number;
  className?: string;
  stretchToContainer?: boolean;
}

export default function PlanPreview({
  assets = [],
  walls = [],
  shapes = [],
  textAnnotations = [],
  width = 300,
  height = 200,
  className = "",
  stretchToContainer = false,
}: PlanPreviewProps) {
  const hasWalls = walls.length > 0;
  // Combine all items for rendering and bounds calculation
  const allItems = useMemo(() => {
    return [
      ...walls,
      ...assets,
      ...shapes,
      ...textAnnotations
    ];
  }, [walls, assets, shapes, textAnnotations]);

  // Use allItems for bounding box calculation
  const { minX, minY, contentWidth, contentHeight } = useMemo(() => {
    if (allItems.length === 0) {
      return { minX: 0, minY: 0, contentWidth: 1000, contentHeight: 1000 };
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let hasValidBounds = false;

    allItems.forEach((item: any) => {
      if (!item) return;

      if (item.type === 'wall-segments' || (item.nodes && item.edges)) {
        const wallThickness =
          item.wallThickness ||
          Math.max(
            0,
            ...(Array.isArray(item.edges) ? item.edges.map((edge: any) => Number(edge.thickness) || 0) : []),
            ...(Array.isArray(item.wallSegments) ? item.wallSegments.map((seg: any) => Number(seg.thickness) || 0) : [])
          ) ||
          150;
        const wallPad = wallThickness / 2;
        const checkNode = (x: number, y: number) => {
          if (isFinite(x) && isFinite(y)) {
            minX = Math.min(minX, x - wallPad);
            minY = Math.min(minY, y - wallPad);
            maxX = Math.max(maxX, x + wallPad);
            maxY = Math.max(maxY, y + wallPad);
            hasValidBounds = true;
          }
        };

        if (item.nodes && Array.isArray(item.nodes)) {
          item.nodes.forEach((node: any) => checkNode(node.x, node.y));
        }
        if (item.wallNodes && Array.isArray(item.wallNodes)) {
          item.wallNodes.forEach((node: any) => checkNode(node.x, node.y));
        }
        // Support wall segments
        if (item.type === 'wall-segments' && item.wallSegments) {
          item.wallSegments.forEach((seg: any) => {
            checkNode(seg.start.x, seg.start.y);
            checkNode(seg.end.x, seg.end.y);
          });
        }
      } else if (item.text !== undefined) {
        // Text specific bounds
        if (isFinite(item.x) && isFinite(item.y)) {
          const fs = item.fontSize || 500;
          const tw = (item.text.length || 1) * fs * 0.6;
          const th = fs * 1.2;
          minX = Math.min(minX, item.x - tw / 2);
          maxX = Math.max(maxX, item.x + tw / 2);
          minY = Math.min(minY, item.y - th / 2);
          maxY = Math.max(maxY, item.y + th / 2);
          hasValidBounds = true;
        }
      } else if (isFinite(item.x) && isFinite(item.y)) {
        // Resolve actual dimensions
        const def = ASSET_LIBRARY.find(a => a.id === item.type);
        const w = (item.width ?? def?.width ?? 600);
        const h = (item.height ?? def?.height ?? 600);
        const scale = item.scale || 1;

        const halfW = (w * scale) / 2;
        const halfH = (h * scale) / 2;

        minX = Math.min(minX, item.x - halfW);
        minY = Math.min(minY, item.y - halfH);
        maxX = Math.max(maxX, item.x + halfW);
        maxY = Math.max(maxY, item.y + halfH);
        hasValidBounds = true;
      }
    });

    if (!hasValidBounds) {
      return { minX: 0, minY: 0, contentWidth: 1000, contentHeight: 1000 };
    }

    const w = maxX - minX;
    const h = maxY - minY;
    const isWallOnlyPreview =
      walls.length > 0 &&
      assets.length === 0 &&
      shapes.length === 0 &&
      textAnnotations.length === 0;

    const maxWallThickness = Math.max(
      0,
      ...walls.flatMap((wall: any) => [
        Number(wall.wallThickness) || 0,
        ...(Array.isArray(wall.edges)
          ? wall.edges.map((edge: any) => Number(edge.thickness) || 0)
          : []),
        ...(Array.isArray(wall.wallSegments)
          ? wall.wallSegments.map((seg: any) => Number(seg.thickness) || 0)
          : []),
      ])
    );

    // Keep room-only previews snug so the wall outline fills the card naturally.
    const padding = isWallOnlyPreview
      ? Math.max(24, maxWallThickness * 0.75)
      : Math.max(80, Math.min(w, h) * 0.04);
    return {
      minX: minX - padding,
      minY: minY - padding,
      contentWidth: w + padding * 2,
      contentHeight: h + padding * 2
    };
  }, [allItems]);

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
        {/* Texture Library */}
        {texturePatterns.map(p => {
          // Find all unique scale/thickness combos used for THIS pattern in THIS preview
          const usages = new Set<string>();
          allItems.forEach((item: any) => {
            if (item && (item.fillType === 'texture' || item.fillType === 'hatch') && item.fillTexture === p.id) {
              usages.add(`${item.fillTextureScale || 4}-${item.fillTextureThickness || 1}`);
            }
          });
          // Also add default 1,1 for safety
          usages.add('1-1');

          return Array.from(usages).map(usageStr => {
            const [s, t] = usageStr.split('-').map(Number);
            const scaledId = `${p.id}-scale-${s}-thick-${t}`;
            if (p.isImage && p.path) {
              const size = p.tileSize || 1024;
              return (
                <pattern key={scaledId} id={scaledId} patternUnits="userSpaceOnUse" width={p.tileSize || 1024} height={p.tileSize || 1024} patternTransform={`scale(${s})`}>
                  <image href={p.path} width={p.tileSize || 1024} height={p.tileSize || 1024} preserveAspectRatio="xMidYMid slice" />
                </pattern>
              );
            } else if (p.svg) {
              // Same logic as TexturePatternDefs.tsx but simplified
              let svgStr = p.svg.replace(/id="[^"]*"/, `id="${scaledId}"`);
              svgStr = svgStr.replace('<pattern', `<pattern patternTransform="scale(${s})"`);
              return <g key={scaledId} dangerouslySetInnerHTML={{ __html: svgStr }} />;
            }
            return null;
          });
        })}

        {/* Dynamic Asset Fills (Gradients, Hatches, Images) */}
        {assets.map(asset => {
          if (!asset) return null;
          const shape = asset as any;
          const fillType = shape.fillType || 'solid';

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
            const s = shape.fillTextureScale || 4;
            const spacing = (shape.hatchSpacing || 25) * s;
            const color = shape.hatchColor || '#000000';
            const id = getHatchId(asset.id);

            return (
              <pattern id={id} key={id} patternUnits="userSpaceOnUse" width={spacing} height={spacing}>
                <rect width={spacing} height={spacing} fill="transparent" />
                {pattern === 'horizontal' && <line x1="0" y1={spacing / 2} x2={spacing} y2={spacing / 2} stroke={color} strokeWidth="1" />}
                {pattern === 'vertical' && <line x1={spacing / 2} y1="0" x2={spacing / 2} y2={spacing} stroke={color} strokeWidth="1" />}
                {pattern === 'diagonal-right' && <path d={`M0,0 L${spacing},${spacing}`} stroke={color} strokeWidth="1" />}
                {pattern === 'diagonal-left' && <path d={`M0,${spacing} L${spacing},0`} stroke={color} strokeWidth="1" />}
                {pattern === 'cross' && <path d={`M0,${spacing / 2} L${spacing},${spacing / 2} M${spacing / 2},0 L${spacing / 2},${spacing}`} stroke={color} strokeWidth="1" />}
                {pattern === 'dots' && <circle cx={spacing / 2} cy={spacing / 2} r={Math.max(0.5, spacing / 10)} fill={color} />}
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
          }
          return null;
        })}
      </defs>
    );
  };

  const getFill = (asset: any) => {
    const fillType = asset.fillType || 'color';
    if (fillType === 'gradient') return `url(#${getGradientId(asset.id)})`;
    if (fillType === 'hatch') return `url(#${getHatchId(asset.id)})`;
    if (fillType === 'image' && asset.fillImage) return `url(#${getPatternId(asset.id)})`;
    if (fillType === 'texture' && asset.fillTexture) {
      const scale = asset.fillTextureScale || 4;
      const thickness = asset.fillTextureThickness || 1;
      return `url(#${asset.fillTexture}-scale-${scale}-thick-${thickness})`;
    }
    const fill = asset.backgroundColor || asset.fillColor || asset.fill;
    if (fill && fill !== 'transparent') return fill;
    if (asset.type === 'line' || asset.nodes || asset.wallNodes || asset.type === 'wall-segments') return 'none';
    return 'transparent';
  };

  const renderText = (asset: any) => {
    if (!isFinite(asset.x) || !isFinite(asset.y)) return null;
    return (
      <text
        key={asset.id}
        x={asset.x}
        y={asset.y}
        fontSize={asset.fontSize || 500}
        fill={asset.color || asset.textColor || '#000000'}
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ fontFamily: asset.fontFamily || 'Arial', fontWeight: asset.fontWeight || 'bold' }}
        transform={asset.rotation && isFinite(asset.rotation) ? `rotate(${asset.rotation} ${asset.x} ${asset.y})` : undefined}
      >
        {asset.text}
      </text>
    );
  };


  const renderAsset = (asset: AssetInstance) => {
    const isWall = (asset as any).nodes || (asset as any).wallNodes || asset.type === 'wall-segments';
    if (!isWall && (!isFinite(asset.x) || !isFinite(asset.y))) return null;

    // Walls should always render through the wall-specific path first.
    const nodes = (asset as any).nodes || (asset as any).wallNodes;
    const edges = (asset as any).edges || (asset as any).wallEdges;

    if (nodes && edges) {
      const stroke = (asset as any).strokeColor || (asset as any).stroke || '#1e293b';
      const thickness = (asset as any).wallThickness || 150;
      const rectLikeXs = Array.from(
        new Set<number>(nodes.map((n: any) => Number(n.x)).filter((v: number) => isFinite(v)))
      );
      const rectLikeYs = Array.from(
        new Set<number>(nodes.map((n: any) => Number(n.y)).filter((v: number) => isFinite(v)))
      );
      const isSimpleEnclosure =
        Boolean((asset as any).isClosed) &&
        Array.isArray(nodes) &&
        Array.isArray(edges) &&
        nodes.length === 4 &&
        edges.length === 4 &&
        rectLikeXs.length === 2 &&
        rectLikeYs.length === 2;

      if (isSimpleEnclosure) {
        const minRectX = Math.min(...rectLikeXs);
        const maxRectX = Math.max(...rectLikeXs);
        const minRectY = Math.min(...rectLikeYs);
        const maxRectY = Math.max(...rectLikeYs);
        return (
          <rect
            key={asset.id}
            x={minRectX}
            y={minRectY}
            width={maxRectX - minRectX}
            height={maxRectY - minRectY}
            fill="none"
            stroke={stroke}
            strokeWidth={3}
            strokeLinejoin="miter"
            vectorEffect="non-scaling-stroke"
          />
        );
      }

      return (
        <g key={asset.id}>
          {edges.map((edge: any, i: number) => {
            const nAId = edge.nodeA !== undefined ? edge.nodeA : edge.a;
            const nBId = edge.nodeB !== undefined ? edge.nodeB : edge.b;

            const nA = typeof nAId === 'string' ? nodes.find((n: any) => n.id === nAId) : nodes[nAId];
            const nB = typeof nBId === 'string' ? nodes.find((n: any) => n.id === nBId) : nodes[nBId];

            if (!nA || !nB) return null;
            return (
              <React.Fragment key={`${asset.id}-edge-${i}`}>
                <line
                  x1={nA.x} y1={nA.y}
                  x2={nB.x} y2={nB.y}
                  stroke={stroke}
                  strokeWidth={3}
                  strokeLinecap="butt"
                  vectorEffect="non-scaling-stroke"
                />
              </React.Fragment>
            );
          })}
        </g>
      );
    }

    // Library Asset (SVG)
    const def = ASSET_LIBRARY.find(a => a.id === asset.type);
    if (def?.path) {
      const previewScaleBoost = hasWalls ? 1.12 : 1;
      const w = (asset.width ?? def.width ?? 500) * (asset.scale || 1) * previewScaleBoost;
      const h = (asset.height ?? def.height ?? 500) * (asset.scale || 1) * previewScaleBoost;
      const rotation = isFinite(asset.rotation || 0) ? asset.rotation : 0;
      const previewStrokeWidth = Math.max(asset.strokeWidth || 0.6, hasWalls ? 1.15 : 0.8);

      return (
        <g key={asset.id} transform={`translate(${asset.x}, ${asset.y}) rotate(${rotation || 0})`}>
          {/* Background */}
          {(asset.backgroundColor && asset.backgroundColor !== "transparent") && (
            <rect x={-w / 2} y={-h / 2} width={w} height={h} fill={asset.backgroundColor} />
          )}
          <foreignObject x={-w / 2} y={-h / 2} width={w} height={h}>
            <InlineSvg
              src={def.path}
              fill={getFill(asset)}
              stroke={asset.strokeColor}
              strokeWidth={previewStrokeWidth}
              category={def.category}
            />
          </foreignObject>
        </g>
      );
    }

    // Shapes
    const defShape = ASSET_LIBRARY.find(a => a.id === asset.type);
    const w = (asset.width ?? defShape?.width ?? 500) * (asset.scale || 1);
    const h = (asset.height ?? defShape?.height ?? 500) * (asset.scale || 1);
    const fill = getFill(asset);
    const stroke = (asset as any).stroke || asset.strokeColor || '#000000';
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

    if (asset.type === 'rect' || asset.type === 'square' || asset.type?.includes('rectangular') || (asset as any).fillType === 'texture') {
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

    // New Wall Engine (Segments)
    if (asset.type === 'wall-segments' && (asset as any).wallSegments) {
      const thickness = (asset as any).wallThickness || 150;
      return (
        <g key={asset.id}>
          {(asset as any).wallSegments.map((seg: any, i: number) => (
            <React.Fragment key={`${asset.id}-seg-${i}`}>
              {/* Hollow wall look for preview - two lines */}
              <line
                x1={seg.start.x} y1={seg.start.y}
                x2={seg.end.x} y2={seg.end.y}
                stroke="#1e293b"
                strokeWidth={thickness}
                strokeLinecap="butt"
              />
              <line
                x1={seg.start.x} y1={seg.start.y}
                x2={seg.end.x} y2={seg.end.y}
                stroke="white"
                strokeWidth={thickness - 30}
                strokeLinecap="butt"
              />
            </React.Fragment>
          ))}
        </g>
      );
    }

    if (asset.type === 'text' || asset.text !== undefined) {
      return renderText(asset);
    }

    // Add tableName (numbering) to preview if present
    if ((asset as any).tableName) {
      return (
        <g key={`${asset.id}-labeled`}>
          {renderAsset({ ...asset, tableName: undefined } as any)}
          <text
            x={asset.x}
            y={asset.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={Math.max(12, 16 / (asset.scale || 1))}
            fill="#111827"
            fontWeight="bold"
            pointerEvents="none"
            style={{
              textShadow: '0 0 4px white, 0 0 2px white',
              userSelect: 'none'
            }}
          >
            {(asset as any).tableName}
          </text>
        </g>
      );
    }

    return null;
  };

  const renderedAssets = allItems
    ? allItems.map((item: any) => (
      <g key={item.id} style={{ color: item.hatchColor || item.fillColor || item.fill || '#000000' }}>
        {renderAsset(item)}
      </g>
    )).filter(Boolean)
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
        preserveAspectRatio={stretchToContainer ? "none" : "xMidYMid meet"}
        style={{ display: 'block' }}
      >
        {renderDefs()}

        {renderedAssets}
      </svg>
    </div>
  );
}
