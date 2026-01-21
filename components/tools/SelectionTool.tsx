"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { useProjectStore, Shape, Wall, Asset, Dimension, TextAnnotation } from '@/store/projectStore';
import { ASSET_LIBRARY } from '@/lib/assets';

interface SelectionToolProps {
    isActive: boolean;
}

export default function SelectionTool({ isActive }: SelectionToolProps) {
    const { selectedIds, screenToWorld, gridSize, snapToGrid, zoom, worldToScreen, panX, panY, canvasOffset } = useEditorStore();
    const { shapes, walls, assets, dimensions, textAnnotations, updateShape, updateWall, updateAsset, updateDimension, updateTextAnnotation } = useProjectStore();

    const [dragHandle, setDragHandle] = useState<string | null>(null);
    const [initialState, setInitialState] = useState<{
        items: Array<{
            type: 'shape' | 'wall' | 'asset' | 'dimension' | 'textAnnotation';
            id: string;
            object: Shape | Wall | Asset | Dimension | TextAnnotation;
            initialBounds?: { x: number, y: number, width: number, height: number }; // For walls/assets
        }>;
        startX: number;
        startY: number;
        groupBounds: { x: number, y: number, width: number, height: number, rotation: number };
    } | null>(null);

    // Calculate group bounding box
    let groupBounds = { x: 0, y: 0, width: 0, height: 0, rotation: 0 };
    const selectedItems: Array<{ type: 'shape' | 'wall' | 'asset' | 'dimension' | 'textAnnotation'; object: Shape | Wall | Asset | Dimension | TextAnnotation }> = [];

    if (selectedIds.length > 0) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        let singleRotation = 0;

        const addPoint = (px: number, py: number) => {
            minX = Math.min(minX, px);
            minY = Math.min(minY, py);
            maxX = Math.max(maxX, px);
            maxY = Math.max(maxY, py);
        };

        selectedIds.forEach(id => {
            const shape = shapes.find(s => s.id === id);
            if (shape) {
                selectedItems.push({ type: 'shape', object: shape });
                const halfW = shape.width / 2;
                const halfH = shape.height / 2;
                const rot = (shape.rotation || 0) * (Math.PI / 180);
                const cosR = Math.cos(rot);
                const sinR = Math.sin(rot);
                const corners = [
                    { x: -halfW, y: -halfH },
                    { x: halfW, y: -halfH },
                    { x: halfW, y: halfH },
                    { x: -halfW, y: halfH },
                ].map(c => ({
                    x: shape.x + c.x * cosR - c.y * sinR,
                    y: shape.y + c.x * sinR + c.y * cosR,
                }));
                corners.forEach(c => addPoint(c.x, c.y));
                if (selectedIds.length === 1) singleRotation = shape.rotation || 0;
                return;
            }

            const asset = assets.find(a => a.id === id);
            if (asset) {
                selectedItems.push({ type: 'asset', object: asset });

                // Match exactly how AssetRenderer renders the asset:
                // - Image is at x={-asset.width / 2}, y={-asset.height / 2}
                // - Image has width={asset.width}, height={asset.height}
                // - Transform is: translate(x, y) rotate(rotation) scale(scale)
                // - In SVG, transforms apply right-to-left, so: scale → rotate → translate
                // - Final size is: asset.width * asset.scale x asset.height * asset.scale
                // - Center is at: (asset.x, asset.y)

                // Use actual rendered dimensions (width * scale, height * scale)
                const width = asset.width * (asset.scale || 1);
                const height = asset.height * (asset.scale || 1);
                const halfW = width / 2;
                const halfH = height / 2;

                // Calculate rotated corners around the center (asset.x, asset.y)
                const rot = (asset.rotation || 0) * (Math.PI / 180);
                const cosR = Math.cos(rot);
                const sinR = Math.sin(rot);
                const corners = [
                    { x: -halfW, y: -halfH },
                    { x: halfW, y: -halfH },
                    { x: halfW, y: halfH },
                    { x: -halfW, y: halfH },
                ].map(c => ({
                    x: asset.x + c.x * cosR - c.y * sinR,
                    y: asset.y + c.x * sinR + c.y * cosR,
                }));
                corners.forEach(c => addPoint(c.x, c.y));
                if (selectedIds.length === 1) singleRotation = asset.rotation || 0;
                return;
            }

            const wall = walls.find(w => w.id === id);
            if (wall) {
                selectedItems.push({ type: 'wall', object: wall });
                wall.nodes.forEach(node => {
                    addPoint(node.x, node.y);
                });
                return;
            }

            const dimension = dimensions.find(d => d.id === id);
            if (dimension) {
                selectedItems.push({ type: 'dimension', object: dimension });
                // For dimensions, we'll use 2-endpoint controller, so just add the measured points
                addPoint(dimension.startPoint.x, dimension.startPoint.y);
                addPoint(dimension.endPoint.x, dimension.endPoint.y);
                return;
            }

            const textAnnotation = textAnnotations.find(t => t.id === id);
            if (textAnnotation) {
                selectedItems.push({ type: 'textAnnotation', object: textAnnotation });
                // For text, build a bounding box that hugs the rendered text.
                // Renderer uses:
                //   - textAnchor="start"  -> x is LEFT edge
                //   - dominantBaseline="middle" -> y is VERTICAL CENTER
                const fontSize = textAnnotation.fontSize || 14;
                const textLength = textAnnotation.text.length || 1;
                const estimatedWidth = Math.max(fontSize * 0.6, textLength * fontSize * 0.6); // avoid zero-width
                const estimatedHeight = fontSize * 1.2;

                const centerX = textAnnotation.x + estimatedWidth / 2;
                const centerY = textAnnotation.y;
                const halfW = estimatedWidth / 2;
                const halfH = estimatedHeight / 2;

                const rot = (textAnnotation.rotation || 0) * (Math.PI / 180);
                const cosR = Math.cos(rot);
                const sinR = Math.sin(rot);

                // Define corners relative to the visual center of the text box
                const localCorners = [
                    { x: -halfW, y: -halfH }, // top‑left
                    { x: halfW, y: -halfH }, // top‑right
                    { x: halfW, y: halfH },  // bottom‑right
                    { x: -halfW, y: halfH },  // bottom‑left
                ];

                localCorners.forEach(c => {
                    const worldX = centerX + c.x * cosR - c.y * sinR;
                    const worldY = centerY + c.x * sinR + c.y * cosR;
                    addPoint(worldX, worldY);
                });

                if (selectedIds.length === 1) {
                    singleRotation = textAnnotation.rotation || 0;
                }
                return;
            }
        });

        if (minX !== Infinity) {
            // For single asset selection, use actual asset dimensions (not axis-aligned bounding box)
            // This ensures the selection box matches the asset's rendered size exactly
            if (selectedItems.length === 1 && selectedItems[0].type === 'asset') {
                const asset = selectedItems[0].object as Asset;
                const width = asset.width * (asset.scale || 1);
                const height = asset.height * (asset.scale || 1);
                groupBounds = {
                    x: asset.x,
                    y: asset.y,
                    width,
                    height,
                    rotation: asset.rotation || 0,
                };
            } else if (selectedItems.length === 1 && selectedItems[0].type === 'shape') {
                // For single shape selection, use actual shape dimensions and rotation
                const shape = selectedItems[0].object as Shape;
                groupBounds = {
                    x: shape.x,
                    y: shape.y,
                    width: shape.width,
                    height: shape.height,
                    rotation: shape.rotation || 0,
                };
            } else {
                // For multi-selection or other types, use axis-aligned bounding box
                const width = maxX - minX;
                const height = maxY - minY;
                groupBounds = {
                    x: minX + width / 2,
                    y: minY + height / 2,
                    width,
                    height,
                    rotation: singleRotation, // rotate handles with single selection
                };
            }
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
                initialBounds: (item.type === 'wall' || item.type === 'textAnnotation') ? { ...groupBounds } : undefined
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

        // Detect a pure-shape group so we can scale the whole group uniformly
        const shapeGroupInfo = (() => {
            if (!initialState || initialState.items.length <= 1) return null;
            const allShapes = initialState.items.every((it) => it.type === 'shape');
            if (!allShapes) return null;
            return {
                groupBounds: initialState.groupBounds,
            };
        })();

        // Process each selected item
        initialState.items.forEach(item => {
            if (item.type === 'shape') {
                const shape = item.object as Shape;
                const initialShape = initialState.items.find(i => i.id === shape.id)?.object as Shape;
                if (!initialShape) return;

                let updates: Partial<Shape> = {};

                // Special handling for single straight lines/arrows (no points array)
                const isSingleStraightLine =
                    (initialShape.type === 'line' || initialShape.type === 'arrow') &&
                    !initialShape.points;

                if (shapeGroupInfo && dragHandle !== 'rotate') {
                    // Multiple shapes: scale the whole group around the shared bounding box center,
                    // but respect the dragged axis:
                    // - dragging E/W changes width only
                    // - dragging N/S changes height only
                    // - dragging a corner changes both.
                    const initialGroup = shapeGroupInfo.groupBounds;
                    const rotation = initialGroup.rotation || 0;
                    const rotRad = rotation * (Math.PI / 180);
                    const cosR = Math.cos(rotRad);
                    const sinR = Math.sin(rotRad);

                    // Convert mouse delta to group's local coordinate system
                    const localDx = dx * cosR + dy * sinR;
                    const localDy = -dx * sinR + dy * cosR;

                    let halfW = initialGroup.width / 2;
                    let halfH = initialGroup.height / 2;
                    let centerX = initialGroup.x;
                    let centerY = initialGroup.y;

                    // Determine which handles are being dragged
                    const isEast = dragHandle.includes('e');
                    const isWest = dragHandle.includes('w');
                    const isNorth = dragHandle.includes('n');
                    const isSouth = dragHandle.includes('s');
                    const isCorner = (isEast || isWest) && (isNorth || isSouth);

                    // When dragging edges, keep the opposite edge fixed and move the center by half the delta
                    // Dragging east: left edge stays fixed, right edge moves, center moves right by dx/2
                    if (isEast && !isCorner) {
                        halfW = Math.max(5, halfW + localDx);
                        centerX = initialGroup.x + (localDx / 2) * cosR;
                        centerY = initialGroup.y + (localDx / 2) * sinR;
                    }
                    // Dragging west: right edge stays fixed, left edge moves, center moves left by dx/2
                    if (isWest && !isCorner) {
                        halfW = Math.max(5, halfW - localDx);
                        centerX = initialGroup.x - (localDx / 2) * cosR;
                        centerY = initialGroup.y - (localDx / 2) * sinR;
                    }

                    // Dragging south: top edge stays fixed, bottom edge moves, center moves down by dy/2
                    if (isSouth && !isCorner) {
                        halfH = Math.max(5, halfH + localDy);
                        centerX = initialGroup.x - (localDy / 2) * sinR;
                        centerY = initialGroup.y + (localDy / 2) * cosR;
                    }
                    // Dragging north: bottom edge stays fixed, top edge moves, center moves up by dy/2
                    if (isNorth && !isCorner) {
                        halfH = Math.max(5, halfH - localDy);
                        centerX = initialGroup.x + (localDy / 2) * sinR;
                        centerY = initialGroup.y - (localDy / 2) * cosR;
                    }

                    // Corner handles: scale both dimensions, keep opposite corner fixed
                    if (isCorner) {
                        if (isEast) {
                            halfW = Math.max(5, halfW + localDx);
                        }
                        if (isWest) {
                            halfW = Math.max(5, halfW - localDx);
                        }
                        if (isSouth) {
                            halfH = Math.max(5, halfH + localDy);
                        }
                        if (isNorth) {
                            halfH = Math.max(5, halfH - localDy);
                        }
                        // For corners, opposite corner stays fixed, so center moves by half the movement in local space
                        // Then convert back to world space
                        const centerLocalDx = (isEast ? localDx : -localDx) / 2;
                        const centerLocalDy = (isSouth ? localDy : -localDy) / 2;
                        // Convert local movement back to world space
                        centerX = initialGroup.x + centerLocalDx * cosR - centerLocalDy * sinR;
                        centerY = initialGroup.y + centerLocalDx * sinR + centerLocalDy * cosR;
                    }

                    const newGroupWidth = halfW * 2;
                    const newGroupHeight = halfH * 2;

                    // For edge handles, only scale the dimension being dragged
                    let scaleX = newGroupWidth / initialGroup.width;
                    let scaleY = newGroupHeight / initialGroup.height;

                    if ((isEast || isWest) && !isCorner) {
                        // E/W edge handles: only scale width, keep height unchanged
                        scaleY = 1.0;
                    }
                    if ((isNorth || isSouth) && !isCorner) {
                        // N/S edge handles: only scale height, keep width unchanged
                        scaleX = 1.0;
                    }
                    // For corners, both scales are already calculated correctly above

                    // Scale this shape relative to the group's center
                    // First, get relative position in group's local space
                    const relX = initialShape.x - initialGroup.x;
                    const relY = initialShape.y - initialGroup.y;
                    const relLocalX = relX * cosR + relY * sinR;
                    const relLocalY = -relX * sinR + relY * cosR;

                    // Scale in local space
                    const newRelLocalX = relLocalX * scaleX;
                    const newRelLocalY = relLocalY * scaleY;

                    // Convert back to world space
                    const newRelX = newRelLocalX * cosR - newRelLocalY * sinR;
                    const newRelY = newRelLocalX * sinR + newRelLocalY * cosR;

                    const newCenterX = centerX + newRelX;
                    const newCenterY = centerY + newRelY;

                    const newWidth = Math.max(1, initialShape.width * scaleX);
                    const newHeight = Math.max(1, initialShape.height * scaleY);

                    const groupUpdates: Partial<Shape> = {
                        x: newCenterX,
                        y: newCenterY,
                        width: newWidth,
                        height: newHeight,
                    };

                    // If this shape has points (paths / polygons), scale them as well
                    if (initialShape.points && initialShape.points.length > 0) {
                        groupUpdates.points = initialShape.points.map((p) => ({
                            x: p.x * scaleX,
                            y: p.y * scaleY,
                        }));
                    }

                    updateShape(shape.id, groupUpdates);
                    return;
                }

                // Handle rotation for groups
                if (shapeGroupInfo && dragHandle === 'rotate') {
                    const initialGroup = shapeGroupInfo.groupBounds;
                    const centerX = initialGroup.x;
                    const centerY = initialGroup.y;
                    const angle = Math.atan2(worldPos.y - centerY, worldPos.x - centerX);
                    const initialAngle = Math.atan2(initialState.startY - centerY, initialState.startX - centerX);
                    const rotationDelta = angle - initialAngle;
                    const newRotation = (initialGroup.rotation || 0) + (rotationDelta * 180 / Math.PI);

                    // Rotate each shape around the group center
                    initialState.items.forEach(item => {
                        if (item.type === 'shape') {
                            const shape = item.object as Shape;
                            const relX = shape.x - centerX;
                            const relY = shape.y - centerY;
                            const cosR = Math.cos(rotationDelta);
                            const sinR = Math.sin(rotationDelta);
                            const newX = centerX + relX * cosR - relY * sinR;
                            const newY = centerY + relX * sinR + relY * cosR;
                            const shapeRotation = (shape.rotation || 0) + (rotationDelta * 180 / Math.PI);
                            updateShape(shape.id, {
                                x: newX,
                                y: newY,
                                rotation: shapeRotation,
                            });
                        }
                    });
                    return;
                }

                if (isSingleStraightLine && (dragHandle === 'w' || dragHandle === 'e')) {
                    // For single straight lines, only move the dragged endpoint
                    const rot = (initialShape.rotation || 0) * (Math.PI / 180);
                    const cosR = Math.cos(rot);
                    const sinR = Math.sin(rot);
                    const halfLen = initialShape.width / 2;

                    // Calculate initial endpoints
                    const initialStart = {
                        x: initialShape.x - halfLen * cosR,
                        y: initialShape.y - halfLen * sinR
                    };
                    const initialEnd = {
                        x: initialShape.x + halfLen * cosR,
                        y: initialShape.y + halfLen * sinR
                    };

                    // Determine which endpoint to move
                    let newStart = { ...initialStart };
                    let newEnd = { ...initialEnd };

                    if (dragHandle === 'w') {
                        // Move start endpoint to mouse position
                        newStart = { x: worldPos.x, y: worldPos.y };
                    } else if (dragHandle === 'e') {
                        // Move end endpoint to mouse position
                        newEnd = { x: worldPos.x, y: worldPos.y };
                    }

                    // Calculate new center and length
                    const newCenterX = (newStart.x + newEnd.x) / 2;
                    const newCenterY = (newStart.y + newEnd.y) / 2;
                    const dx = newEnd.x - newStart.x;
                    const dy = newEnd.y - newStart.y;
                    const newLength = Math.sqrt(dx * dx + dy * dy);
                    const newRotation = Math.atan2(dy, dx) * (180 / Math.PI);

                    updates = {
                        x: newCenterX,
                        y: newCenterY,
                        width: Math.max(1, newLength),
                        rotation: newRotation,
                    };
                } else if (dragHandle === 'rotate') {
                    const centerX = initialShape.x;
                    const centerY = initialShape.y;
                    const angle = Math.atan2(worldPos.y - centerY, worldPos.x - centerX);
                    const deg = angle * (180 / Math.PI) + 90;
                    updates = { rotation: deg };
                } else {
                    // Resize shapes
                    const rotation = initialShape.rotation || 0;

                    if (rotation === 0) {
                        // Simpler, Figma-like behavior when not rotated:
                        // dragging one side keeps the opposite side fixed.
                        let halfW = initialShape.width / 2;
                        let halfH = initialShape.height / 2;
                        let centerX = initialShape.x;
                        let centerY = initialShape.y;

                        // Horizontal handles
                        if (dragHandle.includes('e')) {
                            halfW = Math.max(5, halfW + dx);
                            centerX = initialShape.x + dx;
                        }
                        if (dragHandle.includes('w')) {
                            halfW = Math.max(5, halfW - dx);
                            centerX = initialShape.x + dx;
                        }

                        // Vertical handles
                        if (dragHandle.includes('s')) {
                            halfH = Math.max(5, halfH + dy);
                            centerY = initialShape.y + dy;
                        }
                        if (dragHandle.includes('n')) {
                            halfH = Math.max(5, halfH - dy);
                            centerY = initialShape.y + dy;
                        }

                        const newWidth = halfW * 2;
                        const newHeight = halfH * 2;

                        updates = {
                            x: centerX,
                            y: centerY,
                            width: newWidth,
                            height: newHeight,
                        };

                        // Scale polygon/polyline points in unrotated mode too
                        if (initialShape.points && initialShape.points.length > 0) {
                            const scaleX = newWidth / initialShape.width;
                            const scaleY = newHeight / initialShape.height;
                            updates.points = initialShape.points.map((p) => ({
                                x: p.x * scaleX,
                                y: p.y * scaleY,
                            }));
                        }
                    } else {
                        // Rotated shapes: keep previous center-based resize logic
                        const rot = rotation * (Math.PI / 180);
                        const cosR = Math.cos(rot);
                        const sinR = Math.sin(rot);

                        // Convert delta to shape local space
                        const localDx = dx * cosR + dy * sinR;
                        const localDy = -dx * sinR + dy * cosR;

                        let halfW = initialShape.width / 2;
                        let halfH = initialShape.height / 2;
                        let offsetLocalX = 0;
                        let offsetLocalY = 0;

                        // Horizontal handles
                        if (dragHandle.includes('e')) {
                            halfW = Math.max(5, halfW + localDx);
                            offsetLocalX = localDx / 2;
                        }
                        if (dragHandle.includes('w')) {
                            halfW = Math.max(5, halfW - localDx);
                            offsetLocalX = localDx / 2;
                        }

                        // Vertical handles
                        if (dragHandle.includes('s')) {
                            halfH = Math.max(5, halfH + localDy);
                            offsetLocalY = localDy / 2;
                        }
                        if (dragHandle.includes('n')) {
                            halfH = Math.max(5, halfH - localDy);
                            offsetLocalY = localDy / 2;
                        }

                        const newWidth = halfW * 2;
                        const newHeight = halfH * 2;

                        // Convert local offset back to world
                        const offsetWorldX = offsetLocalX * cosR - offsetLocalY * sinR;
                        const offsetWorldY = offsetLocalX * sinR + offsetLocalY * cosR;

                        const newCenterX = initialShape.x + offsetWorldX;
                        const newCenterY = initialShape.y + offsetWorldY;

                        updates = {
                            x: newCenterX,
                            y: newCenterY,
                            width: newWidth,
                            height: newHeight,
                        };

                        // Scale polyline points if present (rotated shapes only)
                        if (initialShape.points && initialShape.points.length > 0) {
                            const scaleX = newWidth / initialShape.width;
                            const scaleY = newHeight / initialShape.height;
                            updates.points = initialShape.points.map(p => ({
                                x: p.x * scaleX,
                                y: p.y * scaleY,
                            }));
                        }
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
                // Asset manipulation logic - uniform scaling only (maintain aspect ratio)
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
                    // Non-uniform scaling for assets (allow independent width/height)
                    const rotation = initialAsset.rotation || 0;
                    const rot = rotation * (Math.PI / 180);
                    const cosR = Math.cos(rot);
                    const sinR = Math.sin(rot);

                    // Convert mouse delta to asset's local space
                    const localDx = dx * cosR + dy * sinR;
                    const localDy = -dx * sinR + dy * cosR;

                    // Calculate initial dimensions
                    const initialWidth = initialAsset.width * (initialAsset.scale || 1);
                    const initialHeight = initialAsset.height * (initialAsset.scale || 1);

                    let halfW = initialWidth / 2;
                    let halfH = initialHeight / 2;
                    let offsetLocalX = 0;
                    let offsetLocalY = 0;

                    // Horizontal handles
                    if (dragHandle.includes('e')) {
                        halfW = Math.max(5, halfW + localDx / 2); // Add half delta to half width
                        offsetLocalX = localDx / 2;
                    }
                    if (dragHandle.includes('w')) {
                        halfW = Math.max(5, halfW - localDx / 2);
                        offsetLocalX = localDx / 2;
                    }

                    // Vertical handles
                    if (dragHandle.includes('s')) {
                        halfH = Math.max(5, halfH + localDy / 2);
                        offsetLocalY = localDy / 2;
                    }
                    if (dragHandle.includes('n')) {
                        halfH = Math.max(5, halfH - localDy / 2);
                        offsetLocalY = localDy / 2;
                    }

                    // Corner handles (already covered by combining above checks)

                    const newWidth = halfW * 2;
                    const newHeight = halfH * 2;

                    // Convert local offset back to world space
                    const offsetWorldX = offsetLocalX * cosR - offsetLocalY * sinR;
                    const offsetWorldY = offsetLocalX * sinR + offsetLocalY * cosR;

                    const newCenterX = initialAsset.x + offsetWorldX;
                    const newCenterY = initialAsset.y + offsetWorldY;

                    updates = {
                        x: newCenterX,
                        y: newCenterY,
                        width: newWidth,
                        height: newHeight,
                        scale: 1, // Reset scale to 1 as we are baking it into width/height
                    };
                }

                if (Object.keys(updates).length > 0) {
                    updateAsset(asset.id, updates);
                }
            } else if (item.type === 'dimension') {
                // Dimension manipulation
                const dimension = item.object as Dimension;
                const initialDimension = initialState.items.find(i => i.id === dimension.id)?.object as Dimension;
                if (!initialDimension) return;

                // Handle endpoint dragging for dimensions
                if (dragHandle === 'w') {
                    // Move start point (top)
                    updateDimension(dimension.id, {
                        startPoint: {
                            x: initialDimension.startPoint.x + dx,
                            y: initialDimension.startPoint.y + dy,
                        },
                    });
                } else if (dragHandle === 'e') {
                    // Move end point (bottom)
                    updateDimension(dimension.id, {
                        endPoint: {
                            x: initialDimension.endPoint.x + dx,
                            y: initialDimension.endPoint.y + dy,
                        },
                    });
                } else {
                    // Move entire dimension
                    updateDimension(dimension.id, {
                        startPoint: {
                            x: initialDimension.startPoint.x + dx,
                            y: initialDimension.startPoint.y + dy,
                        },
                        endPoint: {
                            x: initialDimension.endPoint.x + dx,
                            y: initialDimension.endPoint.y + dy,
                        },
                    });
                }
            } else if (item.type === 'textAnnotation') {
                // Text annotation manipulation
                const textAnnotation = item.object as TextAnnotation;
                const initialText = initialState.items.find(i => i.id === textAnnotation.id)?.object as TextAnnotation;
                if (!initialText) return;

                const initialFontSize = initialText.fontSize || 14;
                const initialRotation = initialText.rotation || 0;
                const textLength = initialText.text.length || 1;
                const initialWidth = textLength * initialFontSize * 0.6;
                const initialHeight = initialFontSize * 1.2;

                if (dragHandle === 'rotate') {
                    // Handle rotation
                    const centerX = initialText.x;
                    const centerY = initialText.y;
                    const angle = Math.atan2(worldPos.y - centerY, worldPos.x - centerX);
                    const deg = angle * (180 / Math.PI) + 90;
                    updateTextAnnotation(textAnnotation.id, {
                        rotation: deg,
                    });
                } else {
                    // Handle resize and move
                    if (initialRotation === 0) {
                        // Simple, Figma-like behavior when text is not rotated:
                        // dragging one side keeps the opposite side fixed.
                        let halfW = initialWidth / 2;
                        let halfH = initialHeight / 2;
                        let centerX = initialText.x;
                        let centerY = initialText.y;

                        // Horizontal handles
                        if (dragHandle.includes('e')) {
                            halfW = Math.max(initialFontSize * 0.3, halfW + dx);
                            centerX = initialText.x + dx;
                        }
                        if (dragHandle.includes('w')) {
                            halfW = Math.max(initialFontSize * 0.3, halfW - dx);
                            centerX = initialText.x + dx;
                        }

                        // Vertical handles
                        if (dragHandle.includes('s')) {
                            halfH = Math.max(initialFontSize * 0.6, halfH + dy);
                            centerY = initialText.y + dy;
                        }
                        if (dragHandle.includes('n')) {
                            halfH = Math.max(initialFontSize * 0.6, halfH - dy);
                            centerY = initialText.y + dy;
                        }

                        const newWidth = halfW * 2;
                        const newHeight = halfH * 2;

                        const scaleX = newWidth / initialWidth;
                        const scaleY = newHeight / initialHeight;
                        let scale = 1;
                        const hasHorizontal = dragHandle.includes('e') || dragHandle.includes('w');
                        const hasVertical = dragHandle.includes('n') || dragHandle.includes('s');
                        if (hasHorizontal && hasVertical) {
                            scale = (scaleX + scaleY) / 2;
                        } else if (hasHorizontal) {
                            scale = scaleX;
                        } else if (hasVertical) {
                            scale = scaleY;
                        }

                        const newFontSize = Math.max(8, Math.min(1000, initialFontSize * scale));

                        updateTextAnnotation(textAnnotation.id, {
                            x: centerX,
                            y: centerY,
                            fontSize: newFontSize,
                        });
                    } else {
                        // Rotated text: use local-space resize similar to rotated shapes
                        const rot = initialRotation * (Math.PI / 180);
                        const cosR = Math.cos(rot);
                        const sinR = Math.sin(rot);

                        // Convert delta to text local space (accounting for rotation)
                        const localDx = dx * cosR + dy * sinR;
                        const localDy = -dx * sinR + dy * cosR;

                        let halfW = initialWidth / 2;
                        let halfH = initialHeight / 2;
                        let offsetLocalX = 0;
                        let offsetLocalY = 0;

                        // Horizontal handles
                        if (dragHandle.includes('e')) {
                            halfW = Math.max(initialFontSize * 0.3, halfW + localDx);
                            offsetLocalX = localDx / 2;
                        }
                        if (dragHandle.includes('w')) {
                            halfW = Math.max(initialFontSize * 0.3, halfW - localDx);
                            offsetLocalX = localDx / 2;
                        }

                        // Vertical handles
                        if (dragHandle.includes('s')) {
                            halfH = Math.max(initialFontSize * 0.6, halfH + localDy);
                            offsetLocalY = localDy / 2;
                        }
                        if (dragHandle.includes('n')) {
                            halfH = Math.max(initialFontSize * 0.6, halfH - localDy);
                            offsetLocalY = localDy / 2;
                        }

                        const newWidth = halfW * 2;
                        const newHeight = halfH * 2;

                        // Calculate scale factors relative to the initial text box
                        const scaleX = newWidth / initialWidth;
                        const scaleY = newHeight / initialHeight;
                        let scale = 1;
                        const hasHorizontal = dragHandle.includes('e') || dragHandle.includes('w');
                        const hasVertical = dragHandle.includes('n') || dragHandle.includes('s');
                        if (hasHorizontal && hasVertical) {
                            scale = (scaleX + scaleY) / 2;
                        } else if (hasHorizontal) {
                            scale = scaleX;
                        } else if (hasVertical) {
                            scale = scaleY;
                        }

                        const newFontSize = Math.max(8, Math.min(1000, initialFontSize * scale));

                        // Convert local offset back to world space
                        const offsetWorldX = offsetLocalX * cosR - offsetLocalY * sinR;
                        const offsetWorldY = offsetLocalX * sinR + offsetLocalY * cosR;

                        const newCenterX = initialText.x + offsetWorldX;
                        const newCenterY = initialText.y + offsetWorldY;

                        updateTextAnnotation(textAnnotation.id, {
                            x: newCenterX,
                            y: newCenterY,
                            fontSize: newFontSize,
                        });
                    }
                }
            }
        });

    }, [dragHandle, initialState, screenToWorld, updateShape, updateWall, updateAsset, updateDimension, updateTextAnnotation]);

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

    const showHandles = selectedIds.length >= 1; // Show resize handles for single and group selections

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

    // Special case: single straight line/arrow with NO polyline points
    // (pure width/rotation line). Polylines (with points) use the standard box selector.
    const isSingleStraightLine =
        selectedItems.length === 1 &&
        selectedItems[0].type === 'shape' &&
        (((selectedItems[0].object as Shape).type === 'line' || (selectedItems[0].object as Shape).type === 'arrow') &&
            !(selectedItems[0].object as Shape).points);

    // Special case: single dimension - use 2-endpoint controller
    const isSingleDimension =
        selectedItems.length === 1 &&
        selectedItems[0].type === 'dimension';

    if (isSingleDimension) {
        const dimension = selectedItems[0].object as Dimension;
        const start = dimension.startPoint;
        const end = dimension.endPoint;

        // Calculate the dimension line direction
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);

        const startScreen = worldToScreenPoint(start.x, start.y);
        const endScreen = worldToScreenPoint(end.x, end.y);
        const centerScreen = worldToScreenPoint((start.x + end.x) / 2, (start.y + end.y) / 2);

        // Rotation handle offset perpendicular to the line
        const perpX = -Math.sin(angle) * (rotateHandleDistancePx / zoom);
        const perpY = Math.cos(angle) * (rotateHandleDistancePx / zoom);
        const rotPt = worldToScreenPoint((start.x + end.x) / 2 + perpX, (start.y + end.y) / 2 + perpY);

        return (
            <>
                {/* Overlay line along the dimension for clear controller visibility */}
                <line
                    x1={startScreen.x}
                    y1={startScreen.y}
                    x2={endScreen.x}
                    y2={endScreen.y}
                    stroke="#3B82F6"
                    strokeWidth={2}
                    vectorEffect="non-scaling-stroke"
                    pointerEvents="none"
                />
                {/* Connect rotate handle to center */}
                <line
                    x1={centerScreen.x}
                    y1={centerScreen.y}
                    x2={rotPt.x}
                    y2={rotPt.y}
                    stroke="#3B82F6"
                    strokeWidth={2}
                    vectorEffect="non-scaling-stroke"
                    pointerEvents="none"
                />
                {/* Start endpoint (top) */}
                <rect
                    x={startScreen.x - handleSizePx / 2}
                    y={startScreen.y - handleSizePx / 2}
                    width={handleSizePx}
                    height={handleSizePx}
                    fill="#ffffff"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    vectorEffect="non-scaling-stroke"
                    className="cursor-nwse-resize"
                    onMouseDown={(e) => handleMouseDown(e, 'w')}
                />
                {/* End endpoint (bottom) */}
                <rect
                    x={endScreen.x - handleSizePx / 2}
                    y={endScreen.y - handleSizePx / 2}
                    width={handleSizePx}
                    height={handleSizePx}
                    fill="#ffffff"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    vectorEffect="non-scaling-stroke"
                    className="cursor-nwse-resize"
                    onMouseDown={(e) => handleMouseDown(e, 'e')}
                />
                {/* Rotate handle */}
                <circle
                    cx={rotPt.x}
                    cy={rotPt.y}
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
    }

    if (isSingleStraightLine) {
        const shape = selectedItems[0].object as Shape;
        const rot = (shape.rotation || 0) * (Math.PI / 180);
        const cosR = Math.cos(rot);
        const sinR = Math.sin(rot);
        const halfLen = shape.width / 2;

        const start = { x: shape.x - halfLen * cosR, y: shape.y - halfLen * sinR };
        const end = { x: shape.x + halfLen * cosR, y: shape.y + halfLen * sinR };

        const startScreen = worldToScreenPoint(start.x, start.y);
        const endScreen = worldToScreenPoint(end.x, end.y);
        const centerScreen = worldToScreenPoint(shape.x, shape.y);

        // Rotation handle offset perpendicular to the line
        const perpX = -sinR * (rotateHandleDistancePx / zoom);
        const perpY = cosR * (rotateHandleDistancePx / zoom);
        const rotPt = worldToScreenPoint(shape.x + perpX, shape.y + perpY);

        return (
            <>
                {/* Overlay line along the selected line for clear controller visibility */}
                <line
                    x1={startScreen.x}
                    y1={startScreen.y}
                    x2={endScreen.x}
                    y2={endScreen.y}
                    stroke="#3B82F6"
                    strokeWidth={2}
                    vectorEffect="non-scaling-stroke"
                    pointerEvents="none"
                />
                {/* Connect rotate handle to center */}
                <line
                    x1={centerScreen.x}
                    y1={centerScreen.y}
                    x2={rotPt.x}
                    y2={rotPt.y}
                    stroke="#3B82F6"
                    strokeWidth={2}
                    vectorEffect="non-scaling-stroke"
                    pointerEvents="none"
                />
                {/* Start endpoint (treat as West) */}
                <rect
                    x={startScreen.x - handleSizePx / 2}
                    y={startScreen.y - handleSizePx / 2}
                    width={handleSizePx}
                    height={handleSizePx}
                    fill="#ffffff"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    vectorEffect="non-scaling-stroke"
                    className="cursor-ew-resize"
                    onMouseDown={(e) => handleMouseDown(e, 'w')}
                />
                {/* End endpoint (treat as East) */}
                <rect
                    x={endScreen.x - handleSizePx / 2}
                    y={endScreen.y - handleSizePx / 2}
                    width={handleSizePx}
                    height={handleSizePx}
                    fill="#ffffff"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    vectorEffect="non-scaling-stroke"
                    className="cursor-ew-resize"
                    onMouseDown={(e) => handleMouseDown(e, 'e')}
                />
                {/* Rotate handle */}
                <circle
                    cx={rotPt.x}
                    cy={rotPt.y}
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
    }

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
                                transform={`rotate(${rotation} ${pos.x} ${pos.y})`}
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
                                transform={`rotate(${rotation} ${pos.x} ${pos.y})`}
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
                                transform={`rotate(${rotation} ${pos.x} ${pos.y})`}
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
                                transform={`rotate(${rotation} ${pos.x} ${pos.y})`}
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
                                transform={`rotate(${rotation} ${pos.x} ${pos.y})`}
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
                                transform={`rotate(${rotation} ${pos.x} ${pos.y})`}
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
                                transform={`rotate(${rotation} ${pos.x} ${pos.y})`}
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
                                transform={`rotate(${rotation} ${pos.x} ${pos.y})`}
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
