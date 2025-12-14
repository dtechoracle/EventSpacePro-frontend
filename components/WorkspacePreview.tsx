"use client";

import React, { useMemo } from 'react';
import { Wall, Shape, Asset } from '@/store/projectStore';
import { fitWorkspaceToContainer, calculateWorkspaceBounds } from '@/utils/workspaceBounds';

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
                        {/* Render walls */}
                        {walls.map((wall) => (
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
                        ))}

                        {/* Render shapes */}
                        {shapes.map((shape) => {
                            const transform = `translate(${shape.x}, ${shape.y}) rotate(${shape.rotation || 0})`;
                            // Check both fill and backgroundColor (from API data)
                            // If fill is 'transparent' or missing, try backgroundColor as fallback
                            let fill = shape.fill;
                            if (!fill || fill === 'transparent' || fill === '') {
                                fill = (shape as any).backgroundColor || 'transparent';
                            }
                            // Debug log for shapes with colors
                            if (fill && fill !== 'transparent') {
                                console.log(`[WorkspacePreview] Rendering shape ${shape.id} with fill:`, fill);
                            }
                            const stroke = shape.stroke || (shape as any).strokeColor || '#3B82F6';
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

                            return null;
                        })}

                        {/* Render assets */}
                        {assets.map((asset) => {
                            const transform = `translate(${asset.x}, ${asset.y}) rotate(${asset.rotation || 0}) scale(${asset.scale || 1})`;
                            const w = asset.width || 100;
                            const h = asset.height || 100;
                            // Check both fillColor and backgroundColor (from API data)
                            const fillColor = asset.fillColor || asset.backgroundColor || '#3B82F6';
                            const strokeColor = asset.strokeColor || '#1E40AF';
                            const opacity = asset.opacity !== undefined ? asset.opacity : 1;

                            return (
                                <g key={asset.id} transform={transform}>
                                    {/* Render asset as a rectangle with label */}
                                    <rect
                                        x={-w / 2}
                                        y={-h / 2}
                                        width={w}
                                        height={h}
                                        fill={fillColor}
                                        stroke={strokeColor}
                                        strokeWidth={Math.max((asset.strokeWidth || 2) / viewport.zoom, 1)}
                                        opacity={opacity}
                                        rx={4}
                                        ry={4}
                                    />
                                    {/* Show asset type as text for identification */}
                                    <text
                                        x={0}
                                        y={0}
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                        fontSize={Math.max(Math.min(w, h) * 0.2, 8)}
                                        fill="#ffffff"
                                        fontWeight="bold"
                                        pointerEvents="none"
                                        style={{ userSelect: 'none' }}
                                    >
                                        {asset.type?.substring(0, 3).toUpperCase() || 'A'}
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
