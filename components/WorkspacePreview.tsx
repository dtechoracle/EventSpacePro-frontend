"use client";

import React, { useMemo } from 'react';
import { Wall, Shape, Asset } from '@/store/projectStore';
import { fitWorkspaceToContainer, calculateWorkspaceBounds } from '@/utils/workspaceBounds';
import { ASSET_LIBRARY } from '@/lib/assets';
import AssetRenderer from './renderers/AssetRenderer';

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

        // Use smaller padding for tighter previews
        const padding = 20;
        const availableWidth = width - (padding * 2);
        const availableHeight = height - (padding * 2);

        // Calculate zoom to fit all content
        const zoomX = availableWidth / bounds.width;
        const zoomY = availableHeight / bounds.height;
        const zoom = Math.min(zoomX, zoomY, 1); // Never zoom in, always zoom out

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
                    {/* Background grid for better visibility */}
                    <defs>
                        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#f3f4f6" strokeWidth="0.5"/>
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" opacity="0.3" />
                    
                    <g transform={`translate(${viewport.panX}, ${viewport.panY}) scale(${viewport.zoom})`}>
                        {/* Render walls (support wall-polygon) */}
                        {walls.map((wall) => {
                            const hasPolygon = (wall as any).wallPolygon && Array.isArray((wall as any).wallPolygon);
                            if (hasPolygon) {
                                const poly = (wall as any).wallPolygon as Array<{ x: number; y: number }>;
                                const points = poly.map(p => `${p.x + (wall as any).x} ${p.y + (wall as any).y}`).join(' ');
                                const strokeColor = (wall as any).strokeColor || '#1E40AF';
                                const fillColor = (wall as any).backgroundColor || 'transparent';
                                // Keep wall strokes lean in preview to avoid big solid fills
                                const rawThickness =
                                    (wall as any).wallThickness ??
                                    (wall as any).strokeWidth ??
                                    (wall as any).thickness ??
                                    6;
                                const thickness = Math.max(rawThickness, 1) / viewport.zoom;
                                return (
                                    <g key={wall.id}>
                                        <polygon
                                            points={points}
                                            fill={fillColor}
                                            stroke={strokeColor}
                                            strokeWidth={Math.max(thickness, 2)}
                                            strokeLinejoin="round"
                                        />
                                        {/* Optional centerline */}
                                        {(wall as any).centerline && Array.isArray((wall as any).centerline) && (wall as any).centerline.length >= 2 && (
                                            <polyline
                                                points={(wall as any).centerline.map((p: any) => `${p.x + (wall as any).x} ${p.y + (wall as any).y}`).join(' ')}
                                                fill="none"
                                                stroke={strokeColor}
                                                strokeWidth={1}
                                                strokeDasharray="4,4"
                                                strokeLinecap="round"
                                                opacity={0.6}
                                            />
                                        )}
                                    </g>
                                );
                            }

                            return (
                                <g key={wall.id}>
                                    {wall.edges.map((edge) => {
                                        const nodeA = wall.nodes.find(n => n.id === edge.nodeA);
                                        const nodeB = wall.nodes.find(n => n.id === edge.nodeB);
                                        if (!nodeA || !nodeB) return null;
                                        
                                        const thickness = Math.max(edge.thickness || 75, 2) / viewport.zoom;
                                        
                                        return (
                                            <line
                                                key={edge.id}
                                                x1={nodeA.x}
                                                y1={nodeA.y}
                                                x2={nodeB.x}
                                                y2={nodeB.y}
                                                stroke="#1E40AF"
                                                strokeWidth={Math.max(thickness, 2)}
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                        );
                                    })}
                                </g>
                            );
                        })}

                        {/* Render shapes - match ShapeRenderer exactly */}
                        {shapes.map((shape) => {
                            const transform = `translate(${shape.x}, ${shape.y}) rotate(${shape.rotation || 0})`;
                            // Use the same logic as ShapeRenderer - check fill first, then backgroundColor, then fillColor
                            // Default to 'transparent' if none exists
                            const fill = shape.fill || (shape as any).backgroundColor || (shape as any).fillColor || 'transparent';
                            const stroke = shape.stroke || (shape as any).strokeColor || '#1f2937';
                            const strokeWidth = Math.max((shape.strokeWidth || 2) / viewport.zoom, 1);

                            if (shape.type === 'rectangle') {
                                return (
                                    <rect
                                        key={shape.id}
                                        transform={transform}
                                        x={-shape.width / 2}
                                        y={-shape.height / 2}
                                        width={shape.width}
                                        height={shape.height}
                                        fill={fill}
                                        stroke={stroke}
                                        strokeWidth={strokeWidth}
                                        rx={4}
                                        ry={4}
                                    />
                                );
                            }

                            if (shape.type === 'ellipse') {
                                const rx = shape.width / 2 || 50;
                                const ry = shape.height / 2 || 50;
                                return (
                                    <ellipse
                                        key={shape.id}
                                        transform={transform}
                                        cx={0}
                                        cy={0}
                                        rx={rx}
                                        ry={ry}
                                        fill={fill}
                                        stroke={stroke}
                                        strokeWidth={strokeWidth}
                                    />
                                );
                            }

                            if (shape.type === 'line') {
                                // Handle line with points if available
                                if (shape.points && shape.points.length >= 2) {
                                    const points = shape.points.map((p: any) => `${p.x},${p.y}`).join(' ');
                                    return (
                                        <polyline
                                            key={shape.id}
                                            transform={transform}
                                            points={points}
                                            fill="none"
                                            stroke={stroke}
                                            strokeWidth={strokeWidth}
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
                                        stroke={stroke}
                                        strokeWidth={strokeWidth}
                                        strokeLinecap="round"
                    />
                                );
                            }

                            if (shape.type === 'polygon') {
                                // Render polygon using stored points if present; fallback to regular polygon by sides
                                let points: string | null = null;
                                if (shape.points && shape.points.length >= 3) {
                                    points = shape.points.map((p: any) => `${p.x},${p.y}`).join(' ');
                                } else {
                                    const sides = Math.max(
                                        4,
                                        Math.min(
                                            12,
                                            shape.polygonSides ||
                                                (shape.points ? shape.points.length : 4)
                                        )
                                    );
                                    const r = Math.min(shape.width, shape.height) / 2;
                                    const pts: string[] = [];
                                    for (let i = 0; i < sides; i++) {
                                        const angle = ((Math.PI * 2) / sides) * i - Math.PI / 2;
                                        const x = r * Math.cos(angle);
                                        const y = r * Math.sin(angle);
                                        pts.push(`${x},${y}`);
                                    }
                                    points = pts.join(' ');
                                }

                                return (
                                    <polygon
                                        key={shape.id}
                                        transform={transform}
                                        points={points || ''}
                                        fill={fill}
                                        stroke={stroke}
                                        strokeWidth={strokeWidth}
                                        strokeLinejoin="round"
                                    />
                                );
                            }

                            return null;
                        })}

                        {/* Render assets using the same renderer as the workspace */}
                        {assets.map((asset) => {
                            // If an explicit path exists on the asset, prefer it (covers backend-provided paths)
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
