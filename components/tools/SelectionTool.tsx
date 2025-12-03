"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { useProjectStore, Shape, Wall, Asset } from '@/store/projectStore';

interface SelectionToolProps {
    isActive: boolean;
}

export default function SelectionTool({ isActive }: SelectionToolProps) {
    const { selectedIds, screenToWorld, gridSize, snapToGrid, zoom, worldToScreen, panX, panY, canvasOffset } = useEditorStore();
    const { shapes, walls, assets, updateShape, updateWall, updateAsset } = useProjectStore();

    const [dragHandle, setDragHandle] = useState<string | null>(null);
    const [initialState, setInitialState] = useState<{
        items: Array<{
            type: 'shape' | 'wall' | 'asset';
            id: string;
            object: Shape | Wall | Asset;
            initialBounds?: { x: number, y: number, width: number, height: number }; // For walls/assets
        }>;
        startX: number;
        startY: number;
        groupBounds: { x: number, y: number, width: number, height: number, rotation: number };
    } | null>(null);

    // Calculate group bounding box
    let groupBounds = { x: 0, y: 0, width: 0, height: 0, rotation: 0 };
    const selectedItems: Array<{ type: 'shape' | 'wall' | 'asset'; object: Shape | Wall | Asset }> = [];

    if (selectedIds.length > 0) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        let hasRotation = false;

        selectedIds.forEach(id => {
            const shape = shapes.find(s => s.id === id);
            if (shape) {
                selectedItems.push({ type: 'shape', object: shape });
                const halfW = shape.width / 2;
                const halfH = shape.height / 2;
                minX = Math.min(minX, shape.x - halfW);
                minY = Math.min(minY, shape.y - halfH);
                maxX = Math.max(maxX, shape.x + halfW);
                maxY = Math.max(maxY, shape.y + halfH);
                if (shape.rotation !== 0) hasRotation = true;
                return;
            }

            const asset = assets.find(a => a.id === id);
            if (asset) {
                selectedItems.push({ type: 'asset', object: asset });
                const width = asset.width * asset.scale;
                const height = asset.height * asset.scale;
                const halfW = width / 2;
                const halfH = height / 2;
                minX = Math.min(minX, asset.x - halfW);
                minY = Math.min(minY, asset.y - halfH);
                maxX = Math.max(maxX, asset.x + halfW);
                maxY = Math.max(maxY, asset.y + halfH);
                if (asset.rotation !== 0) hasRotation = true;
                return;
            }

            const wall = walls.find(w => w.id === id);
            if (wall) {
                selectedItems.push({ type: 'wall', object: wall });
                wall.nodes.forEach(node => {
                    minX = Math.min(minX, node.x);
                    minY = Math.min(minY, node.y);
                    maxX = Math.max(maxX, node.x);
                    maxY = Math.max(maxY, node.y);
                });
            }
        });

        if (minX !== Infinity) {
            const width = maxX - minX;
            const height = maxY - minY;
            groupBounds = {
                x: minX + width / 2,
                y: minY + height / 2,
                width,
                height,
                rotation: 0 // Group rotation not supported yet
            };
        }
    }

    const handleMouseDown = useCallback((e: React.MouseEvent, handle: string) => {
        if (selectedItems.length === 0) return;

        e.stopPropagation();
        const worldPos = screenToWorld(e.clientX, e.clientY);

        setDragHandle(handle);
        setInitialState({
            items: selectedItems.map(item => ({
                type: item.type,
                id: item.object.id,
                object: JSON.parse(JSON.stringify(item.object)), // Deep copy
                initialBounds: item.type === 'wall' ? { ...groupBounds } : undefined // Simplified for now
            })),
            startX: worldPos.x,
            startY: worldPos.y,
            groupBounds: { ...groupBounds }
        });
    }, [selectedItems, screenToWorld, groupBounds]);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!dragHandle || !initialState) return;

        const worldPos = screenToWorld(e.clientX, e.clientY);
        const dx = worldPos.x - initialState.startX;
        const dy = worldPos.y - initialState.startY;

        // Process each selected item
        initialState.items.forEach(item => {
            if (item.type === 'shape') {
                const shape = item.object as Shape;
                const initialShape = initialState.items.find(i => i.id === shape.id)?.object as Shape;
                if (!initialShape) return;

                let updates: Partial<Shape> = {};

                if (dragHandle === 'rotate') {
                    const centerX = initialShape.x;
                    const centerY = initialShape.y;
                    const angle = Math.atan2(worldPos.y - centerY, worldPos.x - centerX);
                    const deg = angle * (180 / Math.PI) + 90;
                    updates = { rotation: deg };
                } else {
                    // Simplified resizing logic
                    let newWidth = initialShape.width;
                    let newHeight = initialShape.height;
                    let newX = initialShape.x;
                    let newY = initialShape.y;

                    // Simple 8-point resize (unrotated)
                    if (initialShape.rotation === 0) {
                        if (dragHandle.includes('e')) {
                            newWidth = Math.max(10, initialShape.width + dx);
                            newX = initialShape.x + dx / 2;
                        }
                        if (dragHandle.includes('w')) {
                            newWidth = Math.max(10, initialShape.width - dx);
                            newX = initialShape.x + dx / 2;
                        }
                        if (dragHandle.includes('s')) {
                            newHeight = Math.max(10, initialShape.height + dy);
                            newY = initialShape.y + dy / 2;
                        }
                        if (dragHandle.includes('n')) {
                            newHeight = Math.max(10, initialShape.height - dy);
                            newY = initialShape.y + dy / 2;
                        }

                        updates = {
                            x: newX,
                            y: newY,
                            width: newWidth,
                            height: newHeight,
                        };
                    }
                }

                if (Object.keys(updates).length > 0) {
                    updateShape(shape.id, updates);
                }
            } else if (item.type === 'wall') {
                // Wall manipulation logic - transform nodes
                const wall = item.object as Wall;
                const initialWall = initialState.items.find(i => i.id === wall.id)?.object as Wall;
                if (!initialWall) return;

                // Re-calculate initial bounds for this specific wall from nodes
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                initialWall.nodes.forEach(node => {
                    minX = Math.min(minX, node.x);
                    minY = Math.min(minY, node.y);
                    maxX = Math.max(maxX, node.x);
                    maxY = Math.max(maxY, node.y);
                });
                const initW = maxX - minX;
                const initH = maxY - minY;
                const initX = minX + initW / 2;
                const initY = minY + initH / 2;

                if (dragHandle === 'rotate') {
                    // Rotate wall around its center
                    const centerX = initX;
                    const centerY = initY;
                    const angle = Math.atan2(worldPos.y - centerY, worldPos.x - centerX);
                    const initialAngle = Math.atan2(initialState.startY - centerY, initialState.startX - centerX);
                    const rotation = angle - initialAngle;

                    const newNodes = initialWall.nodes.map(node => {
                        const nodeDx = node.x - centerX;
                        const nodeDy = node.y - centerY;
                        return {
                            ...node,
                            x: centerX + nodeDx * Math.cos(rotation) - nodeDy * Math.sin(rotation),
                            y: centerY + nodeDx * Math.sin(rotation) + nodeDy * Math.cos(rotation)
                        };
                    });

                    updateWall(wall.id, { nodes: newNodes });
                } else {
                    // Resize wall by scaling nodes
                    let newMinX = initX - initW / 2;
                    let newMinY = initY - initH / 2;
                    let newMaxX = initX + initW / 2;
                    let newMaxY = initY + initH / 2;

                    if (dragHandle.includes('n')) newMinY += dy;
                    if (dragHandle.includes('s')) newMaxY += dy;
                    if (dragHandle.includes('w')) newMinX += dx;
                    if (dragHandle.includes('e')) newMaxX += dx;

                    const scaleX = (newMaxX - newMinX) / initW;
                    const scaleY = (newMaxY - newMinY) / initH;

                    const newNodes = initialWall.nodes.map(node => ({
                        ...node,
                        x: newMinX + (node.x - (initX - initW / 2)) * scaleX,
                        y: newMinY + (node.y - (initY - initH / 2)) * scaleY
                    }));

                    updateWall(wall.id, { nodes: newNodes });
                }
            } else if (item.type === 'asset') {
                // Asset manipulation logic - similar to shapes
                const asset = item.object as Asset;
                const initialAsset = initialState.items.find(i => i.id === asset.id)?.object as Asset;
                if (!initialAsset) return;

                let updates: Partial<Asset> = {};

                if (dragHandle === 'rotate') {
                    const centerX = initialAsset.x;
                    const centerY = initialAsset.y;
                    const angle = Math.atan2(worldPos.y - centerY, worldPos.x - centerX);
                    const deg = angle * (180 / Math.PI) + 90;
                    updates = { rotation: deg };
                } else {
                    // Simplified resizing logic for assets
                    let newWidth = initialAsset.width;
                    let newHeight = initialAsset.height;
                    let newX = initialAsset.x;
                    let newY = initialAsset.y;

                    // Simple 8-point resize (unrotated)
                    if (initialAsset.rotation === 0) {
                        if (dragHandle.includes('e')) {
                            newWidth = Math.max(10, initialAsset.width + dx);
                            newX = initialAsset.x + dx / 2;
                        }
                        if (dragHandle.includes('w')) {
                            newWidth = Math.max(10, initialAsset.width - dx);
                            newX = initialAsset.x + dx / 2;
                        }
                        if (dragHandle.includes('s')) {
                            newHeight = Math.max(10, initialAsset.height + dy);
                            newY = initialAsset.y + dy / 2;
                        }
                        if (dragHandle.includes('n')) {
                            newHeight = Math.max(10, initialAsset.height - dy);
                            newY = initialAsset.y + dy / 2;
                        }

                        updates = {
                            x: newX,
                            y: newY,
                            width: newWidth,
                            height: newHeight,
                        };
                    }
                }

                if (Object.keys(updates).length > 0) {
                    updateAsset(asset.id, updates);
                }
            }
        });

    }, [dragHandle, initialState, screenToWorld, updateShape, updateWall, updateAsset]);

    const handleMouseUp = useCallback(() => {
        setDragHandle(null);
        setInitialState(null);
    }, []);

    useEffect(() => {
        if (dragHandle) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [dragHandle, handleMouseMove, handleMouseUp]);

    if (!isActive || selectedItems.length === 0) return null;

    // Render selection overlay
    const { x, y, width, height, rotation } = groupBounds;
    const halfW = width / 2;
    const halfH = height / 2;

    // Fixed handle size in screen pixels
    const handleSizePx = 14; // Fixed size in screen pixels
    const rotateHandleDistancePx = 30;
    const rotateHandleRadiusPx = handleSizePx / 2;

    const showHandles = selectedIds.length === 1; // Only show resize handles for single selection for now

    // Convert world coordinates to SVG screen coordinates (relative to SVG viewport, not page)
    // The SVG is at absolute inset-0, so we need coordinates relative to the SVG, not including canvasOffset
    const worldToScreenPoint = (wx: number, wy: number) => {
        // Calculate screen coordinates without canvas offset (SVG coordinates)
        const screenX = wx * zoom + panX;
        const screenY = wy * zoom + panY;
        return { x: screenX, y: screenY };
    };

    // Calculate handle positions in world space (accounting for rotation)
    const cosR = Math.cos((rotation * Math.PI) / 180);
    const sinR = Math.sin((rotation * Math.PI) / 180);
    const rotatePoint = (px: number, py: number) => ({
        x: x + px * cosR - py * sinR,
        y: y + px * sinR + py * cosR,
    });

    // Convert bounding box corners to screen space for the box
    const boxTopLeft = worldToScreenPoint(x - halfW * cosR + halfH * sinR, y - halfW * sinR - halfH * cosR);
    const boxTopRight = worldToScreenPoint(x + halfW * cosR + halfH * sinR, y + halfW * sinR - halfH * cosR);
    const boxBottomLeft = worldToScreenPoint(x - halfW * cosR - halfH * sinR, y - halfW * sinR + halfH * cosR);
    const boxBottomRight = worldToScreenPoint(x + halfW * cosR - halfH * sinR, y + halfW * sinR + halfH * cosR);

    return (
        <>
            {/* Bounding Box - rendered in screen space */}
            <polygon
                points={`${boxTopLeft.x},${boxTopLeft.y} ${boxTopRight.x},${boxTopRight.y} ${boxBottomRight.x},${boxBottomRight.y} ${boxBottomLeft.x},${boxBottomLeft.y}`}
                fill="none"
                stroke="#3B82F6"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
            />

            {/* Resize Handles - rendered in screen space for fixed size */}
            {showHandles && (
                <>
                    {/* Corners */}
                    {(() => {
                        const pos = worldToScreenPoint(rotatePoint(-halfW, -halfH).x, rotatePoint(-halfW, -halfH).y);
                        return (
                            <rect 
                                x={pos.x - handleSizePx / 2} 
                                y={pos.y - handleSizePx / 2} 
                                width={handleSizePx} 
                                height={handleSizePx}
                                fill="#ffffff"
                                stroke="#3b82f6"
                                strokeWidth={2}
                                vectorEffect="non-scaling-stroke"
                                className="cursor-nwse-resize" 
                                onMouseDown={(e) => handleMouseDown(e, 'nw')} 
                            />
                        );
                    })()}
                    {(() => {
                        const pos = worldToScreenPoint(rotatePoint(halfW, -halfH).x, rotatePoint(halfW, -halfH).y);
                        return (
                            <rect 
                                x={pos.x - handleSizePx / 2} 
                                y={pos.y - handleSizePx / 2} 
                                width={handleSizePx} 
                                height={handleSizePx}
                                fill="#ffffff"
                                stroke="#3b82f6"
                                strokeWidth={2}
                                vectorEffect="non-scaling-stroke"
                                className="cursor-nesw-resize" 
                                onMouseDown={(e) => handleMouseDown(e, 'ne')} 
                            />
                        );
                    })()}
                    {(() => {
                        const pos = worldToScreenPoint(rotatePoint(halfW, halfH).x, rotatePoint(halfW, halfH).y);
                        return (
                            <rect 
                                x={pos.x - handleSizePx / 2} 
                                y={pos.y - handleSizePx / 2} 
                                width={handleSizePx} 
                                height={handleSizePx}
                                fill="#ffffff"
                                stroke="#3b82f6"
                                strokeWidth={2}
                                vectorEffect="non-scaling-stroke"
                                className="cursor-nwse-resize" 
                                onMouseDown={(e) => handleMouseDown(e, 'se')} 
                            />
                        );
                    })()}
                    {(() => {
                        const pos = worldToScreenPoint(rotatePoint(-halfW, halfH).x, rotatePoint(-halfW, halfH).y);
                        return (
                            <rect 
                                x={pos.x - handleSizePx / 2} 
                                y={pos.y - handleSizePx / 2} 
                                width={handleSizePx} 
                                height={handleSizePx}
                                fill="#ffffff"
                                stroke="#3b82f6"
                                strokeWidth={2}
                                vectorEffect="non-scaling-stroke"
                                className="cursor-nesw-resize" 
                                onMouseDown={(e) => handleMouseDown(e, 'sw')} 
                            />
                        );
                    })()}

                    {/* Edges */}
                    {(() => {
                        const pos = worldToScreenPoint(rotatePoint(0, -halfH).x, rotatePoint(0, -halfH).y);
                        return (
                            <rect 
                                x={pos.x - handleSizePx / 2} 
                                y={pos.y - handleSizePx / 2} 
                                width={handleSizePx} 
                                height={handleSizePx}
                                fill="#ffffff"
                                stroke="#3b82f6"
                                strokeWidth={2}
                                vectorEffect="non-scaling-stroke"
                                className="cursor-ns-resize" 
                                onMouseDown={(e) => handleMouseDown(e, 'n')} 
                            />
                        );
                    })()}
                    {(() => {
                        const pos = worldToScreenPoint(rotatePoint(halfW, 0).x, rotatePoint(halfW, 0).y);
                        return (
                            <rect 
                                x={pos.x - handleSizePx / 2} 
                                y={pos.y - handleSizePx / 2} 
                                width={handleSizePx} 
                                height={handleSizePx}
                                fill="#ffffff"
                                stroke="#3b82f6"
                                strokeWidth={2}
                                vectorEffect="non-scaling-stroke"
                                className="cursor-ew-resize" 
                                onMouseDown={(e) => handleMouseDown(e, 'e')} 
                            />
                        );
                    })()}
                    {(() => {
                        const pos = worldToScreenPoint(rotatePoint(0, halfH).x, rotatePoint(0, halfH).y);
                        return (
                            <rect 
                                x={pos.x - handleSizePx / 2} 
                                y={pos.y - handleSizePx / 2} 
                                width={handleSizePx} 
                                height={handleSizePx}
                                fill="#ffffff"
                                stroke="#3b82f6"
                                strokeWidth={2}
                                vectorEffect="non-scaling-stroke"
                                className="cursor-ns-resize" 
                                onMouseDown={(e) => handleMouseDown(e, 's')} 
                            />
                        );
                    })()}
                    {(() => {
                        const pos = worldToScreenPoint(rotatePoint(-halfW, 0).x, rotatePoint(-halfW, 0).y);
                        return (
                            <rect 
                                x={pos.x - handleSizePx / 2} 
                                y={pos.y - handleSizePx / 2} 
                                width={handleSizePx} 
                                height={handleSizePx}
                                fill="#ffffff"
                                stroke="#3b82f6"
                                strokeWidth={2}
                                vectorEffect="non-scaling-stroke"
                                className="cursor-ew-resize" 
                                onMouseDown={(e) => handleMouseDown(e, 'w')} 
                            />
                        );
                    })()}

                    {/* Rotate Handle */}
                    {(() => {
                        const startPos = worldToScreenPoint(rotatePoint(0, -halfH).x, rotatePoint(0, -halfH).y);
                        const endPos = worldToScreenPoint(rotatePoint(0, -halfH - rotateHandleDistancePx / zoom).x, rotatePoint(0, -halfH - rotateHandleDistancePx / zoom).y);
                        return (
                            <>
                                <line 
                                    x1={startPos.x} 
                                    y1={startPos.y} 
                                    x2={endPos.x} 
                                    y2={endPos.y} 
                                    stroke="#3B82F6" 
                                    strokeWidth={2}
                                    vectorEffect="non-scaling-stroke"
                                />
                                <circle 
                                    cx={endPos.x} 
                                    cy={endPos.y} 
                                    r={rotateHandleRadiusPx} 
                                    fill="white" 
                                    stroke="#3B82F6" 
                                    strokeWidth={2}
                                    vectorEffect="non-scaling-stroke"
                                    className="cursor-grab" 
                                    onMouseDown={(e) => handleMouseDown(e, 'rotate')} 
                                />
                            </>
                        );
                    })()}
                </>
            )}
        </>
    );
}
