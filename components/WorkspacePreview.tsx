"use client";

import React, { useMemo, useId } from 'react';
import { Wall, Shape, Asset } from '@/store/projectStore';
import { calculateWorkspaceBounds } from '@/utils/workspaceBounds';
import AssetRenderer from './renderers/AssetRenderer';
import { texturePatterns } from '@/utils/texturePatterns';

interface WorkspacePreviewProps {
    walls: Wall[];
    shapes: Shape[];
    assets: Asset[];
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
    width = 400,
    height = 300,
    backgroundColor = '#ffffff'
}: WorkspacePreviewProps) {
    // Generate a unique id per instance so that SVG pattern refs don't clash
    // when multiple WorkspacePreview cards render on the same page.
    const uid = useId().replace(/:/g, '_');
    const hasContent = walls.length > 0 || shapes.length > 0 || assets.length > 0;

    // Calculate optimal viewport to fit all items (like Figma - zoom out to fit everything)
    const viewport = useMemo(() => {
        if (!hasContent) {
            return { zoom: 1, panX: 0, panY: 0 };
        }

        const bounds = calculateWorkspaceBounds(walls, shapes, assets);
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
    }, [walls, shapes, assets, width, height, hasContent]);

    const renderDefs = () => {
        return (
            <defs>
                {/* Background grid */}
                <pattern id={`grid_${uid}`} width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#f3f4f6" strokeWidth="0.5" />
                </pattern>

                {/* Texture Library */}
                {texturePatterns.map(p => {
                    // Find all unique scale/thickness combos used for THIS pattern in THIS preview
                    const usages = new Set<{ s: number, t: number }>();
                    
                    // Check shapes for textures
                    shapes.forEach((s: any) => {
                        if (s.fillType === 'texture' && s.fillTexture === p.id) {
                            usages.add({ s: s.fillTextureScale || 4, t: s.fillTextureThickness || 1 });
                        }
                    });

                    // Check assets for textures (fallback)
                    assets.forEach((a: any) => {
                        if (a.fillType === 'texture' && a.fillTexture === p.id) {
                            usages.add({ s: a.fillTextureScale || 4, t: a.fillTextureThickness || 1 });
                        }
                    });

                    // Add default 1,1 for safety if it's referenced by id directly
                    usages.add({ s: 1, t: 1 });
                    
                    // Deduplicate
                    const uniqueUsages = Array.from(usages).filter((v, i, a) => 
                        a.findIndex(t => t.s === v.s && t.t === v.t) === i
                    );

                    return uniqueUsages.map(usage => {
                        const scaledId = usage.s === 1 && usage.t === 1 ? p.id : `${p.id}-scale-${usage.s}-thick-${usage.t}`;
                        
                        if (p.isImage && p.path) {
                            return (
                                <pattern 
                                    key={scaledId} 
                                    id={scaledId} 
                                    patternUnits="userSpaceOnUse" 
                                    width={p.tileSize || 1024} 
                                    height={p.tileSize || 1024} 
                                    patternTransform={`scale(${usage.s})`}
                                >
                                    <image href={p.path} width={p.tileSize || 1024} height={p.tileSize || 1024} preserveAspectRatio="xMidYMid slice" />
                                </pattern>
                            );
                        } else if (p.svg) {
                            let svgStr = p.svg.replace(/id="[^"]*"/, `id="${scaledId}"`);
                            svgStr = svgStr.replace('<pattern', `<pattern patternTransform="scale(${usage.s})"`);
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
                            const transform = `translate(${shape.x}, ${shape.y}) rotate(${shape.rotation || 0})`;
                            const stroke = shape.stroke || (shape as any).strokeColor || '#1f2937';
                            const strokeWidth = shape.strokeWidth || 1;

                            // Normalize fill property
                            let fill = shape.fill || (shape as any).backgroundColor || (shape as any).fillColor || 'transparent';
                            
                            // Map texture fill to its scaled version if applicable
                            if (shape.fillType === 'texture' && shape.fillTexture) {
                                const s = shape.fillTextureScale || 4;
                                const t = shape.fillTextureThickness || 1;
                                fill = `url(#${shape.fillTexture}-scale-${s}-thick-${t})`;
                            }

                            const commonProps = {
                                fill,
                                stroke,
                                strokeWidth,
                                vectorEffect: "non-scaling-stroke" as "non-scaling-stroke"
                            };

                            if (shape.type === 'rectangle') {
                                return (
                                    <rect
                                        key={shape.id}
                                        transform={transform}
                                        x={-shape.width / 2}
                                        y={-shape.height / 2}
                                        width={shape.width}
                                        height={shape.height}
                                        {...commonProps}
                                        rx={4}
                                        ry={4}
                                    />
                                );
                            }

                            if (shape.type === 'ellipse') {
                                return (
                                    <ellipse
                                        key={shape.id}
                                        transform={transform}
                                        cx={0}
                                        cy={0}
                                        rx={shape.width / 2}
                                        ry={shape.height / 2}
                                        {...commonProps}
                                    />
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
