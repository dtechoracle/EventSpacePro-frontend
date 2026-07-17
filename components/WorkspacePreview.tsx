"use client";

import React, { useMemo, useId } from 'react';
import { Wall, Shape, Asset, TextAnnotation } from '@/store/projectStore';
import { calculateWorkspaceBounds } from '@/utils/workspaceBounds';
import AssetRenderer from './renderers/AssetRenderer';
import { texturePatterns } from '@/utils/texturePatterns';

interface WorkspacePreviewProps {
    walls: Wall[];
    shapes: Shape[];
    assets: Asset[];
    textAnnotations?: TextAnnotation[];
    width?: number;
    height?: number;
    backgroundColor?: string;
}

/**
 * Renders a cropped preview of workspace items fitted to the container using SVG
 * Perfect for dashboard thumbnails
 */
export default function WorkspacePreview({
    walls = [],
    shapes = [],
    assets = [],
    textAnnotations = [],
    width = 400,
    height = 300,
    backgroundColor = '#ffffff'
}: WorkspacePreviewProps) {
    // Generate a unique id per instance so that SVG pattern refs don't clash
    // when multiple WorkspacePreview cards render on the same page.
    const uid = useId().replace(/:/g, '_');
    const hasContent = walls.length > 0 || shapes.length > 0 || assets.length > 0 || textAnnotations.length > 0;

    // Calculate optimal viewport to fit all items (like Figma - zoom out to fit everything)
    const viewport = useMemo(() => {
        if (!hasContent) {
            return { zoom: 1, panX: 0, panY: 0 };
        }

        const bounds = calculateWorkspaceBounds(walls, shapes, assets, textAnnotations);
        if (!bounds) {
            return { zoom: 1, panX: 0, panY: 0 };
        }

        // Zero padding for maximum impact
        const padding = 0;
        const availableWidth = width;
        const availableHeight = height;

        // Calculate zoom to fit all content
        const zoomX = availableWidth / (bounds.width || 1);
        const zoomY = availableHeight / (bounds.height || 1);
        // Allow zooming in to fill the space, up to 2x for clarity
        const zoom = Math.min(zoomX, zoomY, 2);

        // Calculate center point
        const centerX = bounds.minX + (bounds.width / 2);
        const centerY = bounds.minY + (bounds.height / 2);

        // Pan to center content in viewport
        const panX = (width / 2) - (centerX * zoom);
        const panY = (height / 2) - (centerY * zoom);

        return {
            zoom: isFinite(zoom) && zoom > 0 ? zoom : 1,
            panX: isFinite(panX) ? panX : width / 2,
            panY: isFinite(panY) ? panY : height / 2,
        };
    }, [walls, shapes, assets, textAnnotations, width, height, hasContent]);

    // Resolve fill value for a shape/asset based on fillType
    const resolveFill = (item: any) => {
        const fillType = item.fillType || 'color';
        if (fillType === 'gradient') return `url(#gradient-${uid}-${item.id})`;
        if (fillType === 'hatch' || fillType === 'hash') return `url(#hatch-${uid}-${item.id})`;
        if (fillType === 'image' && item.fillImage) return `url(#image-${uid}-${item.id})`;
        if (fillType === 'texture' && item.fillTexture) {
            const s = item.fillTextureScale || 4;
            const t = item.fillTextureThickness || 1;
            return `url(#${item.fillTexture}-scale-${s}-thick-${t})`;
        }
        if (fillType === 'none') return 'transparent';
        return item.fill || item.backgroundColor || item.fillColor || 'transparent';
    };

    const renderDefs = () => {
        const gradientIds: string[] = [];
        const hatchIds: string[] = [];
        const imageIds: string[] = [];

        // Collect shapes and assets with special fills
        [...shapes, ...assets].forEach((item: any) => {
            const fillType = item.fillType || 'color';
            if (fillType === 'gradient') gradientIds.push(item.id);
            else if (fillType === 'hatch' || fillType === 'hash') hatchIds.push(item.id);
            else if (fillType === 'image' && item.fillImage) imageIds.push(item.id);
        });

        return (
            <defs>
                {/* Background grid */}
                <pattern id={`grid_${uid}`} width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#f3f4f6" strokeWidth="0.5" />
                </pattern>

                {/* Gradient defs */}
                {gradientIds.map(id => {
                    const item = [...shapes, ...assets].find((s: any) => s.id === id) as any;
                    if (!item) return null;
                    const colors = item.gradientColors || ['#ffffff', '#000000'];
                    const angle = item.gradientAngle || 0;
                    if (item.gradientType === 'radial') {
                        return (
                            <radialGradient key={id} id={`gradient-${uid}-${id}`}>
                                <stop offset="0%" stopColor={colors[0]} />
                                <stop offset="100%" stopColor={colors[1]} />
                            </radialGradient>
                        );
                    }
                    const angleRad = (angle * Math.PI) / 180;
                    const x1 = 50 - 50 * Math.cos(angleRad);
                    const y1 = 50 - 50 * Math.sin(angleRad);
                    const x2 = 50 + 50 * Math.cos(angleRad);
                    const y2 = 50 + 50 * Math.sin(angleRad);
                    return (
                        <linearGradient key={id} id={`gradient-${uid}-${id}`} x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`}>
                            <stop offset="0%" stopColor={colors[0]} />
                            <stop offset="100%" stopColor={colors[1]} />
                        </linearGradient>
                    );
                })}

                {/* Hatch defs */}
                {hatchIds.map(id => {
                    const item = [...shapes, ...assets].find((s: any) => s.id === id) as any;
                    if (!item) return null;
                    const pattern = item.hatchPattern || 'horizontal';
                    const spacing = (item.hatchSpacing || 10) * (item.fillTextureScale || 4);
                    const color = item.hatchColor || '#000000';
                    const strokeWidth = item.hatchThickness || 1;
                    return (
                        <pattern key={id} id={`hatch-${uid}-${id}`} patternUnits="userSpaceOnUse"
                            width={spacing * 2} height={spacing * 2}
                            patternTransform={`rotate(${item.hatchRotation || 0})`}>
                            <rect width={spacing * 2} height={spacing * 2} fill="transparent" />
                            {pattern === 'horizontal' && <line x1="0" y1={spacing} x2={spacing * 2} y2={spacing} stroke={color} strokeWidth={strokeWidth} />}
                            {pattern === 'vertical' && <line x1={spacing} y1="0" x2={spacing} y2={spacing * 2} stroke={color} strokeWidth={strokeWidth} />}
                            {pattern === 'diagonal-right' && <line x1="0" y1={spacing * 2} x2={spacing * 2} y2="0" stroke={color} strokeWidth={strokeWidth} />}
                            {pattern === 'diagonal-left' && <line x1="0" y1="0" x2={spacing * 2} y2={spacing * 2} stroke={color} strokeWidth={strokeWidth} />}
                            {pattern === 'cross' && <>
                                <line x1="0" y1={spacing} x2={spacing * 2} y2={spacing} stroke={color} strokeWidth={strokeWidth} />
                                <line x1={spacing} y1="0" x2={spacing} y2={spacing * 2} stroke={color} strokeWidth={strokeWidth} />
                            </>}
                            {pattern === 'diagonal-cross' && <>
                                <line x1="0" y1="0" x2={spacing * 2} y2={spacing * 2} stroke={color} strokeWidth={strokeWidth} />
                                <line x1={spacing * 2} y1="0" x2="0" y2={spacing * 2} stroke={color} strokeWidth={strokeWidth} />
                            </>}
                            {pattern === 'dots' && <>
                                <circle cx={spacing / 2} cy={spacing / 2} r={strokeWidth} fill={color} />
                                <circle cx={spacing * 1.5} cy={spacing * 1.5} r={strokeWidth} fill={color} />
                            </>}
                            {pattern === 'brick' && <>
                                <line x1="0" y1={spacing} x2={spacing * 2} y2={spacing} stroke={color} strokeWidth={strokeWidth} />
                                <line x1={spacing} y1="0" x2={spacing} y2={spacing} stroke={color} strokeWidth={strokeWidth} />
                                <line x1="0" y1={spacing} x2={0} y2={spacing * 2} stroke={color} strokeWidth={strokeWidth} />
                            </>}
                        </pattern>
                    );
                })}

                {/* Image fill defs */}
                {imageIds.map(id => {
                    const item = [...shapes, ...assets].find((s: any) => s.id === id) as any;
                    if (!item) return null;
                    const scale = item.fillImageScale || 1;
                    const tileW = Math.max(1, 1024 * scale);
                    const tileH = Math.max(1, 1024 * scale);
                    return (
                        <pattern key={id} id={`image-${uid}-${id}`} patternUnits="userSpaceOnUse"
                            width={tileW} height={tileH}>
                            <image href={item.fillImage} x="0" y="0" width={tileW} height={tileH} preserveAspectRatio="xMidYMid slice" />
                        </pattern>
                    );
                })}

                {/* Texture Library */}
                {texturePatterns.map(p => {
                    const usages = new Set<string>();
                    [...shapes, ...assets].forEach((item: any) => {
                        if (item.fillType === 'texture' && item.fillTexture === p.id) {
                            usages.add(`${item.fillTextureScale || 4}-${item.fillTextureThickness || 1}`);
                        }
                    });
                    usages.add('1-1');
                    return Array.from(usages).map(usageStr => {
                        const [s, t] = usageStr.split('-').map(Number);
                        const scaledId = `${p.id}-scale-${s}-thick-${t}`;
                        if (p.isImage && p.path) {
                            return (
                                <pattern key={scaledId} id={scaledId} patternUnits="userSpaceOnUse"
                                    width={p.tileSize || 1024} height={p.tileSize || 1024}
                                    patternTransform={`scale(${s})`}>
                                    <image href={p.path} width={p.tileSize || 1024} height={p.tileSize || 1024} preserveAspectRatio="xMidYMid slice" />
                                </pattern>
                            );
                        } else if (p.svg) {
                            let svgStr = p.svg.replace(/id="[^"]*"/, `id="${scaledId}"`);
                            svgStr = svgStr.replace('<pattern', `<pattern patternTransform="scale(${s})"`);
                            return <g key={scaledId} dangerouslySetInnerHTML={{ __html: svgStr }} />;
                        }
                        return null;
                    });
                })}
            </defs>
        );
    };

    return (
        <div
            style={{
                width: '100%',
                height: '100%',
                backgroundColor,
                position: 'relative',
                overflow: 'hidden',
            }}
        >
            {hasContent ? (
                <svg
                    width="100%"
                    height="100%"
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        display: 'block',
                    }}
                    viewBox={`0 0 ${width} ${height}`}
                    preserveAspectRatio="xMidYMid meet"
                >
                    {renderDefs()}
                    <rect width="100%" height="100%" fill={`url(#grid_${uid})`} opacity="0.3" />

                    <g transform={`translate(${viewport.panX}, ${viewport.panY}) scale(${viewport.zoom})`}>
                        {/* Render walls (support wall-polygon) */}
                        {walls.map((wall) => {
                            const hasPolygon = (wall as any).wallPolygon && Array.isArray((wall as any).wallPolygon);
                            const strokeColor = "#334155"; // Darker slate gray

                            if (hasPolygon) {
                                const poly = (wall as any).wallPolygon as Array<{ x: number; y: number }>;
                                const points = poly.map(p => `${p.x + ((wall as any).x || 0)} ${p.y + ((wall as any).y || 0)}`).join(' ');
                                const fillColor = (wall as any).backgroundColor || 'transparent';
                                
                                return (
                                    <polygon
                                        key={wall.id}
                                        points={points}
                                        fill={fillColor}
                                        stroke={strokeColor}
                                        strokeWidth={1.5}
                                        strokeLinejoin="round"
                                        vectorEffect="non-scaling-stroke"
                                    />
                                );
                            }

                            return (
                                <g key={wall.id}>
                                    {wall.edges.map((edge) => {
                                        const nodeA = wall.nodes.find(n => n.id === edge.nodeA);
                                        const nodeB = wall.nodes.find(n => n.id === edge.nodeB);
                                        if (!nodeA || !nodeB) return null;

                                        return (
                                            <line
                                                key={edge.id}
                                                x1={nodeA.x}
                                                y1={nodeA.y}
                                                x2={nodeB.x}
                                                y2={nodeB.y}
                                                stroke={strokeColor}
                                                strokeWidth={1.5}
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                vectorEffect="non-scaling-stroke"
                                            />
                                        );
                                    })}
                                </g>
                            );
                        })}

                        {/* Render shapes - match ShapeRenderer exactly */}
                        {shapes.map((shape) => {
                            const baseScale = (shape as any).scale || 1;
                            const scaleX = (shape as any).flipX ? -baseScale : baseScale;
                            const scaleY = (shape as any).flipY ? -baseScale : baseScale;
                            const transform = `translate(${shape.x}, ${shape.y}) rotate(${shape.rotation || 0}) scale(${scaleX}, ${scaleY})`;
                            const stroke = shape.stroke || (shape as any).strokeColor || '#1f2937';
                            const strokeWidth = shape.strokeWidth || 1;
                            const fill = resolveFill(shape);

                            const commonProps = {
                                fill,
                                stroke,
                                strokeWidth,
                                vectorEffect: "non-scaling-stroke" as "non-scaling-stroke"
                            };

                            if (shape.type === 'rectangle') {
                                return (
                                    <g key={shape.id} style={{ color: (shape as any).hatchColor || shape.fill || '#000000' }}>
                                        <rect
                                            transform={transform}
                                            x={-shape.width / 2}
                                            y={-shape.height / 2}
                                            width={shape.width}
                                            height={shape.height}
                                            {...commonProps}
                                            rx={(shape as any).borderRadius || 0}
                                            ry={(shape as any).borderRadius || 0}
                                        />
                                        {/* Table Numbering */}
                                        {(shape as any).tableName && (shape as any).showTableName !== false && (
                                            <g transform={`translate(${shape.x}, ${shape.y}) rotate(${shape.rotation || 0}) scale(${scaleX}, ${scaleY}) rotate(${-(shape.rotation || 0)})`}>
                                                <circle
                                                    cx={0} cy={0}
                                                    r={Math.max(16, (shape.width || 100) * 0.12)}
                                                    fill="white" stroke="#000000"
                                                    strokeWidth={Math.max(1.5, (shape.width || 100) * 0.01)}
                                                    pointerEvents="none"
                                                    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}
                                                />
                                                <text
                                                    x={0} y={0} textAnchor="middle" dominantBaseline="middle"
                                                    fontSize={(shape as any).tableNumberingFontSize || 14}
                                                    fill={(shape as any).tableNumberingColor || '#000000'}
                                                    fontWeight={(shape as any).tableNumberingFontWeight || '900'}
                                                    fontStyle={(shape as any).tableNumberingFontStyle || 'normal'}
                                                    textDecoration={(shape as any).tableNumberingTextDecoration || 'none'}
                                                    pointerEvents="none"
                                                    style={{ userSelect: 'none', fontFamily: (shape as any).tableNumberingFontFamily || 'Inter, sans-serif' }}
                                                >
                                                    {(shape as any).tableName}
                                                </text>
                                            </g>
                                        )}
                                    </g>
                                );
                            }

                            if (shape.type === 'ellipse') {
                                return (
                                    <g key={shape.id} style={{ color: (shape as any).hatchColor || shape.fill || '#000000' }}>
                                        <ellipse
                                            transform={transform}
                                            cx={0} cy={0}
                                            rx={shape.width / 2}
                                            ry={shape.height / 2}
                                            {...commonProps}
                                        />
                                        {/* Table Numbering */}
                                        {(shape as any).tableName && (shape as any).showTableName !== false && (
                                            <g transform={`translate(${shape.x}, ${shape.y}) rotate(${shape.rotation || 0}) scale(${scaleX}, ${scaleY}) rotate(${-(shape.rotation || 0)})`}>
                                                <circle
                                                    cx={0} cy={0}
                                                    r={Math.max(16, (shape.width || 100) * 0.12)}
                                                    fill="white" stroke="#000000"
                                                    strokeWidth={Math.max(1.5, (shape.width || 100) * 0.01)}
                                                    pointerEvents="none"
                                                    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}
                                                />
                                                <text
                                                    x={0} y={0} textAnchor="middle" dominantBaseline="middle"
                                                    fontSize={(shape as any).tableNumberingFontSize || 14}
                                                    fill={(shape as any).tableNumberingColor || '#000000'}
                                                    fontWeight={(shape as any).tableNumberingFontWeight || '900'}
                                                    fontStyle={(shape as any).tableNumberingFontStyle || 'normal'}
                                                    textDecoration={(shape as any).tableNumberingTextDecoration || 'none'}
                                                    pointerEvents="none"
                                                    style={{ userSelect: 'none', fontFamily: (shape as any).tableNumberingFontFamily || 'Inter, sans-serif' }}
                                                >
                                                    {(shape as any).tableName}
                                                </text>
                                            </g>
                                        )}
                                    </g>
                                );
                            }

                            if (shape.type === 'line') {
                                if (shape.points && shape.points.length >= 2) {
                                    const pointsString = shape.points.map((p: any) => `${p.x},${p.y}`).join(' ');
                                    return (
                                        <polyline
                                            key={shape.id}
                                            transform={transform}
                                            points={pointsString}
                                            {...commonProps}
                                            fill="none"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    );
                                }

                                return (
                                    <line
                                        key={shape.id}
                                        transform={transform}
                                        x1={-shape.width / 2}
                                        y1={0}
                                        x2={shape.width / 2}
                                        y2={0}
                                        {...commonProps}
                                        strokeLinecap="round"
                                    />
                                );
                            }

                            if (shape.type === 'polygon') {
                                let pointsString = '';
                                if (shape.points && shape.points.length >= 3) {
                                    pointsString = shape.points.map((p: any) => `${p.x},${p.y}`).join(' ');
                                } else {
                                    const sides = Math.max(3, shape.polygonSides || 4);
                                    const r = Math.min(shape.width, shape.height) / 2;
                                    const pts: string[] = [];
                                    for (let i = 0; i < sides; i++) {
                                        const angle = ((Math.PI * 2) / sides) * i - Math.PI / 2;
                                        pts.push(`${r * Math.cos(angle)},${r * Math.sin(angle)}`);
                                    }
                                    pointsString = pts.join(' ');
                                }

                                return (
                                    <polygon
                                        key={shape.id}
                                        transform={transform}
                                        points={pointsString}
                                        {...commonProps}
                                        strokeLinejoin="round"
                                    />
                                );
                            }

                            return null;
                        })}

                        {/* Render assets using the same renderer as the workspace */}
                        {assets.map((asset) => {
                            const path = (asset as any).path;
                            const assetWithPath = path
                                ? { ...asset, path, type: asset.type, width: asset.width || 100, height: asset.height || 100, metadata: asset.metadata }
                                : asset;

                            // Render text for text-type assets
                            if ((asset as any).text) {
                                return (
                                    <text
                                        key={asset.id}
                                        x={asset.x}
                                        y={asset.y}
                                        fontSize={(asset as any).fontSize || 500}
                                        fill={(asset as any).textColor || (asset as any).color || '#000000'}
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                        style={{ fontFamily: (asset as any).fontFamily || 'Arial', fontWeight: (asset as any).fontWeight || 'bold' }}
                                        transform={asset.rotation ? `rotate(${asset.rotation} ${asset.x} ${asset.y})` : undefined}
                                    >
                                        {(asset as any).text}
                                    </text>
                                );
                            }

                            return (
                                <AssetRenderer
                                    key={asset.id}
                                    asset={assetWithPath as any}
                                    isSelected={false}
                                    isHovered={false}
                                    isPreview={true}
                                />
                            );
                        })}

                        {/* Render text annotations */}
                        {textAnnotations.map((annotation) => {
                            const rotation = annotation.rotation || 0;
                            const fontSize = annotation.fontSize || 250;
                            const lines = annotation.text ? annotation.text.split('\n') : [''];
                            const lineHeight = annotation.lineHeight || 1.2;
                            const approxWidth = Math.max(...lines.map(l => l.length)) * fontSize * 0.55;
                            const padding = fontSize * 0.2;
                            const bgWidth = approxWidth + padding * 2;
                            const bgHeight = lines.length * fontSize * lineHeight + padding * 2;
                            const bgX = -bgWidth / 2;
                            const bgY = -bgHeight / 2;
                            const textX = annotation.textAlign === 'left' ? bgX + padding :
                                annotation.textAlign === 'right' ? bgX + bgWidth - padding : 0;

                            return (
                                <g key={annotation.id} transform={`translate(${annotation.x}, ${annotation.y}) rotate(${rotation})`}>
                                    {annotation.backgroundColor && annotation.backgroundColor !== 'transparent' && (
                                        <rect
                                            x={bgX} y={bgY}
                                            width={bgWidth} height={bgHeight}
                                            fill={annotation.backgroundColor}
                                            rx={fontSize * 0.1}
                                        />
                                    )}
                                    <text
                                        x={textX}
                                        y={-(lines.length - 1) * (fontSize * lineHeight) / 2}
                                        fontSize={fontSize}
                                        fill={annotation.color || '#000000'}
                                        fontFamily={annotation.fontFamily || 'Inter, sans-serif'}
                                        fontWeight={annotation.fontWeight || 'normal'}
                                        fontStyle={annotation.fontStyle || 'normal'}
                                        textDecoration={annotation.textDecoration || 'none'}
                                        dominantBaseline="middle"
                                        textAnchor={annotation.textAlign === 'left' ? 'start' :
                                            annotation.textAlign === 'right' ? 'end' : 'middle'}
                                    >
                                        {lines.map((line, i) => (
                                            <tspan key={i} x={textX} dy={i === 0 ? "0" : fontSize * lineHeight}>
                                                {line}
                                            </tspan>
                                        ))}
                                    </text>
                                </g>
                            );
                        })}
                    </g>
                </svg>
            ) : (
                <div
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        color: '#9ca3af',
                        fontSize: '12px',
                        textAlign: 'center',
                        fontStyle: 'italic',
                    }}
                >
                    Empty workspace
                </div>
            )}
        </div>
    );
}
