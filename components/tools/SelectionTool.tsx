import { useSceneStore } from '@/store/sceneStore';
import { calculateSmartSnap, Bounds } from '@/utils/smartSnapping';
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { useProjectStore, Shape, Wall, Asset, Dimension, TextAnnotation, LabelArrow } from '@/store/projectStore';
import { SpatialIndex, getRotatedItemBounds } from '@/utils/spatialIndex';

interface SelectionToolProps {
    isActive: boolean;
    viewportSize: { width: number; height: number };
}

export default function SelectionTool({ isActive, viewportSize }: SelectionToolProps) {
    const ROTATION_SNAP_STEP = 15;
    const ROTATION_SNAP_THRESHOLD = 4;
    const selectedIds = useEditorStore(s => s.selectedIds);
    const screenToWorld = useEditorStore(s => s.screenToWorld);
    const zoom = useEditorStore(s => s.zoom);
    const panX = useEditorStore(s => s.panX);
    const panY = useEditorStore(s => s.panY);
    const activeTool = useEditorStore(s => s.activeTool);
    const snapToGridEnabled = useSceneStore(s => s.snapToGridEnabled);
    const gridSize = useSceneStore(s => s.gridSize);
    const shapes = useProjectStore(s => s.shapes);
    const walls = useProjectStore(s => s.walls);
    const assets = useProjectStore(s => s.assets);
    const dimensions = useProjectStore(s => s.dimensions);
    const textAnnotations = useProjectStore(s => s.textAnnotations);
    const labelArrows = useProjectStore(s => s.labelArrows);

    const [dragHandle, setDragHandle] = useState<string | null>(null);
    const lastMoveFrameRef = useRef(0);
    const [initialState, setInitialState] = useState<{
        items: Array<{
            type: 'shape' | 'wall' | 'asset' | 'dimension' | 'textAnnotation' | 'labelArrow';
            id: string;
            object: Shape | Wall | Asset | Dimension | TextAnnotation | LabelArrow;
        }>;
        startX: number;
        startY: number;
        groupBounds: { x: number, y: number, width: number, height: number, rotation: number };
    } | null>(null);
    const [currentRotation, setCurrentRotation] = useState(0);


    // Populate selectedItems for logic below
    const selectedItems = useMemo((): Array<{ type: 'shape' | 'wall' | 'asset' | 'dimension' | 'textAnnotation' | 'labelArrow'; object: Shape | Wall | Asset | Dimension | TextAnnotation | LabelArrow }> => {
        const shapeMap = new Map(shapes.map(item => [item.id, item]));
        const assetMap = new Map(assets.map(item => [item.id, item]));
        const wallMap = new Map(walls.map(item => [item.id, item]));
        const dimensionMap = new Map(dimensions.map(item => [item.id, item]));
        const textMap = new Map(textAnnotations.map(item => [item.id, item]));
        const labelMap = new Map(labelArrows.map(item => [item.id, item]));

        const nextItems: Array<{ type: 'shape' | 'wall' | 'asset' | 'dimension' | 'textAnnotation' | 'labelArrow'; object: Shape | Wall | Asset | Dimension | TextAnnotation | LabelArrow }> = [];

        selectedIds.forEach(id => {
            const shape = shapeMap.get(id);
            if (shape) { nextItems.push({ type: 'shape', object: shape }); return; }
            const asset = assetMap.get(id);
            if (asset) { nextItems.push({ type: 'asset', object: asset }); return; }
            const wall = wallMap.get(id);
            if (wall) { nextItems.push({ type: 'wall', object: wall }); return; }
            const dim = dimensionMap.get(id);
            if (dim) { nextItems.push({ type: 'dimension', object: dim }); return; }
            const ta = textMap.get(id);
            if (ta) { nextItems.push({ type: 'textAnnotation', object: ta }); return; }
            const la = labelMap.get(id);
            if (la) nextItems.push({ type: 'labelArrow', object: la });
        });

        return nextItems;
    }, [selectedIds, shapes, assets, walls, dimensions, textAnnotations, labelArrows]);

    const assetSpatialIndex = useMemo(
        () => new SpatialIndex(
            assets
                .filter(asset => !asset.isExploded)
                .map(asset => ({
                    id: asset.id,
                    item: asset,
                    bounds: getRotatedItemBounds(asset),
                    zIndex: asset.zIndex || 0,
                }))
        ),
        [assets]
    );

    // Calculate group bounding box
    const groupBounds = useMemo(() => {
        let nextGroupBounds = { x: 0, y: 0, width: 0, height: 0, rotation: 0 };

        if (selectedIds.length === 0) return nextGroupBounds;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        let singleRotation = 0;

        const addPoint = (px: number, py: number) => {
            minX = Math.min(minX, px);
            minY = Math.min(minY, py);
            maxX = Math.max(maxX, px);
            maxY = Math.max(maxY, py);
        };

        selectedItems.forEach(item => {
            if (item.type === 'shape') {
                const shape = item.object as Shape;
                const halfW = shape.width / 2;
                const halfH = shape.height / 2;
                const rot = (shape.rotation || 0) * (Math.PI / 180);
                const cosR = Math.cos(rot);
                const sinR = Math.sin(rot);
                const corners = [
                    { x: -halfW, y: -halfH }, { x: halfW, y: -halfH },
                    { x: halfW, y: halfH }, { x: -halfW, y: halfH },
                ].map(c => ({
                    x: shape.x + c.x * cosR - c.y * sinR,
                    y: shape.y + c.x * sinR + c.y * cosR,
                }));
                corners.forEach(c => addPoint(c.x, c.y));
                if (selectedIds.length === 1) singleRotation = shape.rotation || 0;
            } else if (item.type === 'asset') {
                const asset = item.object as Asset;
                const width = asset.width * (asset.scale || 1);
                const height = asset.height * (asset.scale || 1);
                const halfW = width / 2;
                const halfH = height / 2;
                const rot = (asset.rotation || 0) * (Math.PI / 180);
                const cosR = Math.cos(rot);
                const sinR = Math.sin(rot);
                const corners = [
                    { x: -halfW, y: -halfH }, { x: halfW, y: -halfH },
                    { x: halfW, y: halfH }, { x: -halfW, y: halfH },
                ].map(c => ({
                    x: asset.x + c.x * cosR - c.y * sinR,
                    y: asset.y + c.x * sinR + c.y * cosR,
                }));
                corners.forEach(c => addPoint(c.x, c.y));
                if (selectedIds.length === 1) singleRotation = asset.rotation || 0;
            } else if (item.type === 'wall') {
                const wall = item.object as Wall;
                wall.nodes.forEach(n => addPoint(n.x, n.y));
            } else if (item.type === 'dimension') {
                const dim = item.object as Dimension;
                addPoint(dim.startPoint.x, dim.startPoint.y);
                addPoint(dim.endPoint.x, dim.endPoint.y);
            } else if (item.type === 'textAnnotation') {
                const ta = item.object as TextAnnotation;
                const fs = ta.fontSize || 250;
                const lineHeight = ta.lineHeight || 1.2;
                const lines = (ta.text || '').split('\n');
                const maxChars = Math.max(...lines.map(l => l.length), 1);
                const width = maxChars * fs * 0.6;
                const height = lines.length * fs * lineHeight;
                const rot = (ta.rotation || 0) * (Math.PI / 180);
                const cosR = Math.cos(rot);
                const sinR = Math.sin(rot);
                const corners = [
                    { x: -width / 2, y: -height / 2 }, { x: width / 2, y: -height / 2 },
                    { x: width / 2, y: height / 2 }, { x: -width / 2, y: height / 2 },
                ].map(c => ({
                    x: ta.x + c.x * cosR - c.y * sinR,
                    y: ta.y + c.x * sinR + c.y * cosR,
                }));
                corners.forEach(c => addPoint(c.x, c.y));
                if (selectedIds.length === 1) singleRotation = ta.rotation || 0;
            } else if (item.type === 'labelArrow') {
                const la = item.object as LabelArrow;
                addPoint(la.startPoint.x, la.startPoint.y);
                addPoint(la.endPoint.x, la.endPoint.y);
            }
        });

        if (minX !== Infinity && isFinite(minX) && isFinite(maxX) && isFinite(minY) && isFinite(maxY)) {
            if (selectedItems.length === 1) {
                const item = selectedItems[0].object as any;
                const type = selectedItems[0].type;
                if (type === 'asset') {
                    nextGroupBounds = { x: item.x || 0, y: item.y || 0, width: (item.width || 0) * (item.scale || 1), height: (item.height || 0) * (item.scale || 1), rotation: item.rotation || 0 };
                } else if (type === 'shape') {
                    nextGroupBounds = { x: item.x || 0, y: item.y || 0, width: item.width || 0, height: item.height || 0, rotation: item.rotation || 0 };
                } else if (type === 'textAnnotation') {
                    const fs = item.fontSize || 250;
                    const lineHeight = item.lineHeight || 1.2;
                    const lines = (item.text || '').split('\n');
                    const maxChars = Math.max(...lines.map((l: string) => l.length), 1);
                    const width = maxChars * fs * 0.6;
                    const height = lines.length * fs * lineHeight;
                    nextGroupBounds = { x: item.x || 0, y: item.y || 0, width, height, rotation: item.rotation || 0 };
                } else {
                    nextGroupBounds = { x: (minX + maxX) / 2, y: (minY + maxY) / 2, width: maxX - minX, height: maxY - minY, rotation: isFinite(singleRotation) ? singleRotation : 0 };
                }
            } else {
                nextGroupBounds = { x: (minX + maxX) / 2, y: (minY + maxY) / 2, width: maxX - minX, height: maxY - minY, rotation: 0 };
            }
        }
        return nextGroupBounds;
    }, [selectedIds.length, selectedItems]);

    const handleMouseDown = useCallback((e: React.MouseEvent, handle: string) => {
        if (selectedIds.length === 0) return;
        e.stopPropagation();
        const worldPos = screenToWorld(e.clientX, e.clientY);
        useProjectStore.getState().saveToHistory();
        if (selectedIds.length > 3) {
            useSceneStore.getState().setSnapGuides([]);
        }
        lastMoveFrameRef.current = 0;
        setDragHandle(handle);
        setInitialState({
            items: selectedItems.map(it => ({ id: (it.object as any).id, type: it.type, object: JSON.parse(JSON.stringify(it.object)) })),
            startX: worldPos.x,
            startY: worldPos.y,
            groupBounds: { ...groupBounds }
        });
        setCurrentRotation(0);
    }, [selectedIds, screenToWorld, groupBounds, selectedItems]);


    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!dragHandle || !initialState) return;

        const now = performance.now();
        if (now - lastMoveFrameRef.current < 16) return;
        lastMoveFrameRef.current = now;

        const worldPos = screenToWorld(e.clientX, e.clientY);
        const dx = worldPos.x - initialState.startX;
        const dy = worldPos.y - initialState.startY;

        const { snapToObjects } = useEditorStore.getState();
        const { setSnapGuides, snapToGridEnabled, gridSize } = useSceneStore.getState();
        const store = useProjectStore.getState();

        // 1. Unified Movement Logic
        if (dragHandle === 'move' || !dragHandle || dragHandle === 'select') {
            let finalDx = dx;
            let finalDy = dy;

            const shouldUseObjectSnap = snapToObjects && selectedIds.length <= 3;
            if (shouldUseObjectSnap) {
                const currentBounds: Bounds = {
                    x: initialState.groupBounds.x + dx,
                    y: initialState.groupBounds.y + dy,
                    width: initialState.groupBounds.width,
                    height: initialState.groupBounds.height,
                    rotation: initialState.groupBounds.rotation
                };
                const store = useProjectStore.getState();
                const selectedIdSet = new Set(selectedIds);
                const snapSearchPadding = Math.max(currentBounds.width, currentBounds.height, 300 / zoom, 120);
                const nearbyAssets = assetSpatialIndex
                    .query({
                        left: currentBounds.x - currentBounds.width / 2 - snapSearchPadding,
                        top: currentBounds.y - currentBounds.height / 2 - snapSearchPadding,
                        right: currentBounds.x + currentBounds.width / 2 + snapSearchPadding,
                        bottom: currentBounds.y + currentBounds.height / 2 + snapSearchPadding,
                    })
                    .map(entry => entry.item)
                    .filter(asset => !selectedIdSet.has(asset.id));
                const others = [
                    ...store.shapes.filter(s => !selectedIdSet.has(s.id)).map(s => {
                        const rad = ((s.rotation || 0) * Math.PI) / 180;
                        const cos = Math.abs(Math.cos(rad)), sin = Math.abs(Math.sin(rad));
                        return { ...s, width: s.width * cos + s.height * sin, height: s.width * sin + s.height * cos, type: 'shape' };
                    }),
                    ...nearbyAssets.map(a => {
                        const rad = ((a.rotation || 0) * Math.PI) / 180;
                        const cos = Math.abs(Math.cos(rad)), sin = Math.abs(Math.sin(rad));
                        const w = a.width * (a.scale || 1), h = a.height * (a.scale || 1);
                        return { ...a, width: w * cos + h * sin, height: w * sin + h * cos, type: 'asset' };
                    }),
                    ...store.walls.filter(w => !selectedIdSet.has(w.id)).map(w => {
                        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                        w.nodes.forEach(n => { minX = Math.min(minX, n.x); minY = Math.min(minY, n.y); maxX = Math.max(maxX, n.x); maxY = Math.max(maxY, n.y); });
                        return { id: w.id, x: (minX + maxX) / 2, y: (minY + maxY) / 2, width: maxX - minX, height: maxY - minY, type: 'wall' };
                    }),
                    ...store.textAnnotations.filter(t => !selectedIdSet.has(t.id)).map(t => {
                        const fs = t.fontSize || 250;
                        const lines = (t.text || '').split('\n');
                        const maxChars = Math.max(...lines.map(l => l.length), 1);
                        const w = maxChars * fs * 0.6;
                        const h = lines.length * fs * (t.lineHeight || 1.2);
                        const rad = ((t.rotation || 0) * Math.PI) / 180;
                        const cos = Math.abs(Math.cos(rad)), sin = Math.abs(Math.sin(rad));
                        return { ...t, width: w * cos + h * sin, height: w * sin + h * cos, type: 'textAnnotation' };
                    }),
                ];

                const snap = calculateSmartSnap(currentBounds, others as any, 10 / zoom);
                finalDx = dx + snap.dx;
                finalDy = dy + snap.dy;
                setSnapGuides(snap.guides);
            } else if (snapToGridEnabled) {
                const newX = Math.round((initialState.groupBounds.x + dx) / gridSize) * gridSize;
                const newY = Math.round((initialState.groupBounds.y + dy) / gridSize) * gridSize;
                finalDx = newX - initialState.groupBounds.x;
                finalDy = newY - initialState.groupBounds.y;
            }

            const batchUpdates: any[] = [];
            initialState.items.forEach(item => {
                const it = item.object as any;
                if (item.type === 'shape') batchUpdates.push({ id: item.id, type: 'shape', updates: { x: it.x + finalDx, y: it.y + finalDy } });
                else if (item.type === 'asset') batchUpdates.push({ id: item.id, type: 'asset', updates: { x: it.x + finalDx, y: it.y + finalDy } });
                else if (item.type === 'wall') batchUpdates.push({ id: item.id, type: 'wall', updates: { nodes: it.nodes.map((n: any) => ({ ...n, x: n.x + finalDx, y: n.y + finalDy })) } });
                else if (item.type === 'dimension') batchUpdates.push({ id: item.id, type: 'dimension', updates: { startPoint: { x: it.startPoint.x + finalDx, y: it.startPoint.y + finalDy }, endPoint: { x: it.endPoint.x + finalDx, y: it.endPoint.y + finalDy } } });
                else if (item.type === 'textAnnotation') batchUpdates.push({ id: item.id, type: 'textAnnotation', updates: { x: it.x + finalDx, y: it.y + finalDy } });
                else if (item.type === 'labelArrow') batchUpdates.push({ id: item.id, type: 'labelArrow', updates: { startPoint: { x: it.startPoint.x + finalDx, y: it.startPoint.y + finalDy }, endPoint: { x: it.endPoint.x + finalDx, y: it.endPoint.y + finalDy } } });
            });
            if (batchUpdates.length > 0) store.batchUpdateItems(batchUpdates, true);
            return;
        }

        // Vertex dragging support for polyline shapes
        if (dragHandle.startsWith('vertex-')) {
            const index = parseInt(dragHandle.split('-')[1]);
            const batchUpdates: any[] = [];
            initialState.items.forEach(item => {
                const it = item.object as any;
                if (item.type === 'shape' && it.points) {
                    const newPoints = [...it.points];
                    // Polyline points are local to (x, y); we apply dx/dy in rotated local space
                    // But simplified here to global dx/dy since rotation isn't usually applied to polylines in this app's logic
                    newPoints[index] = { 
                        x: it.points[index].x + dx, 
                        y: it.points[index].y + dy 
                    };
                    batchUpdates.push({ id: item.id, type: 'shape', updates: { points: newPoints } });
                }
            });
            if (batchUpdates.length > 0) store.batchUpdateItems(batchUpdates, true);
            return;
        }

        // 2. Unified Rotation Logic
        if (dragHandle === 'rotate') {
            const centerX = initialState.groupBounds.x;
            const centerY = initialState.groupBounds.y;
            const angle = Math.atan2(worldPos.y - centerY, worldPos.x - centerX);
            const startAngleRaw = Math.atan2(initialState.startY - centerY, initialState.startX - centerX);
            const deltaRad = angle - startAngleRaw;
            const deltaDegRaw = deltaRad * (180 / Math.PI);
            const nearestSnap = Math.round(deltaDegRaw / ROTATION_SNAP_STEP) * ROTATION_SNAP_STEP;
            const deltaDeg = Math.abs(deltaDegRaw - nearestSnap) <= ROTATION_SNAP_THRESHOLD ? nearestSnap : deltaDegRaw;
            setCurrentRotation(deltaDeg);

            const appliedDeltaRad = deltaDeg * (Math.PI / 180);
            const cosR = Math.cos(appliedDeltaRad);
            const sinR = Math.sin(appliedDeltaRad);

            const batchUpdates: any[] = [];
            initialState.items.forEach(item => {
                const it = item.object as any;
                const rx = it.x - centerX;
                const ry = it.y - centerY;
                const newX = centerX + rx * cosR - ry * sinR;
                const newY = centerY + rx * sinR + ry * cosR;
                const newRot = (it.rotation || 0) + deltaDeg;

                if (item.type === 'shape') batchUpdates.push({ id: item.id, type: 'shape', updates: { x: newX, y: newY, rotation: newRot } });
                else if (item.type === 'asset') batchUpdates.push({ id: item.id, type: 'asset', updates: { x: newX, y: newY, rotation: newRot } });
                else if (item.type === 'wall') {
                    const newNodes = it.nodes.map((n: any) => {
                        const nx = n.x - centerX;
                        const ny = n.y - centerY;
                        return { ...n, x: centerX + nx * cosR - ny * sinR, y: centerY + nx * sinR + ny * cosR };
                    });
                    batchUpdates.push({ id: item.id, type: 'wall', updates: { nodes: newNodes } });
                } else if (item.type === 'textAnnotation') batchUpdates.push({ id: item.id, type: 'textAnnotation', updates: { x: newX, y: newY, rotation: newRot } });
                else if (item.type === 'dimension') {
                    const ns = { x: centerX + (it.startPoint.x - centerX) * cosR - (it.startPoint.y - centerY) * sinR, y: centerY + (it.startPoint.x - centerX) * sinR + (it.startPoint.y - centerY) * cosR };
                    const ne = { x: centerX + (it.endPoint.x - centerX) * cosR - (it.endPoint.y - centerY) * sinR, y: centerY + (it.endPoint.x - centerX) * sinR + (it.endPoint.y - centerY) * cosR };
                    batchUpdates.push({ id: item.id, type: 'dimension', updates: { startPoint: ns, endPoint: ne } });
                } else if (item.type === 'labelArrow') {
                    const ns = { x: centerX + (it.startPoint.x - centerX) * cosR - (it.startPoint.y - centerY) * sinR, y: centerY + (it.startPoint.x - centerX) * sinR + (it.startPoint.y - centerY) * cosR };
                    const ne = { x: centerX + (it.endPoint.x - centerX) * cosR - (it.endPoint.y - centerY) * sinR, y: centerY + (it.endPoint.x - centerX) * sinR + (it.endPoint.y - centerY) * cosR };
                    batchUpdates.push({ id: item.id, type: 'labelArrow', updates: { startPoint: ns, endPoint: ne } });
                }
            });
            if (batchUpdates.length > 0) store.batchUpdateItems(batchUpdates, true);
            return;
        }

        // 3. Resize Logic (Mainly for Shapes/Assets)
        let finalDx = dx;
        let finalDy = dy;

        const { snapToGridEnabled: resizeSnapGrid, gridSize: resizeGridSize } = useSceneStore.getState();
        if (resizeSnapGrid) {
            finalDx = Math.round(dx / resizeGridSize) * resizeGridSize;
            finalDy = Math.round(dy / resizeGridSize) * resizeGridSize;
        }

        initialState.items.forEach(item => {
            if (item.type === 'shape') {
                const initialShape = item.object as Shape;
                const rotation = initialShape.rotation || 0;
                const rotRad = rotation * (Math.PI / 180);
                const cosR = Math.cos(rotRad);
                const sinR = Math.sin(rotRad);
                const localDx = finalDx * cosR + finalDy * sinR;
                const localDy = -finalDx * sinR + finalDy * cosR;

                let halfW = initialShape.width / 2;
                let halfH = initialShape.height / 2;
                let centerX = initialShape.x;
                let centerY = initialShape.y;

                if (dragHandle.includes('e')) halfW = Math.max(5, halfW + localDx / 2);
                if (dragHandle.includes('w')) halfW = Math.max(5, halfW - localDx / 2);
                if (dragHandle.includes('s')) halfH = Math.max(5, halfH + localDy / 2);
                if (dragHandle.includes('n')) halfH = Math.max(5, halfH - localDy / 2);

                if (rotation === 0) {
                    if (dragHandle.includes('e')) centerX = initialShape.x + (halfW * 2 - initialShape.width) / 2;
                    if (dragHandle.includes('w')) centerX = initialShape.x - (halfW * 2 - initialShape.width) / 2;
                    if (dragHandle.includes('s')) centerY = initialShape.y + (halfH * 2 - initialShape.height) / 2;
                    if (dragHandle.includes('n')) centerY = initialShape.y - (halfH * 2 - initialShape.height) / 2;
                } else {
                    const offLX = (dragHandle.includes('e') ? localDx / 2 : (dragHandle.includes('w') ? -localDx / 2 : 0));
                    const offLY = (dragHandle.includes('s') ? localDy / 2 : (dragHandle.includes('n') ? -localDy / 2 : 0));
                    centerX = initialShape.x + offLX * cosR - offLY * sinR;
                    centerY = initialShape.y + offLX * sinR + offLY * cosR;
                }
                store.updateShape(item.id, { x: centerX, y: centerY, width: halfW * 2, height: halfH * 2 }, true);

            } else if (item.type === 'asset') {
                const initialAsset = item.object as Asset;
                const rotation = initialAsset.rotation || 0;
                const rotRad = rotation * (Math.PI / 180);
                const cosR = Math.cos(rotRad);
                const sinR = Math.sin(rotRad);
                const localDx = finalDx * cosR + finalDy * sinR;
                const localDy = -finalDx * sinR + finalDy * cosR;
                const initialWidth = initialAsset.width * (initialAsset.scale || 1);
                const initialHeight = initialAsset.height * (initialAsset.scale || 1);

                let halfW = initialWidth / 2;
                let halfH = initialHeight / 2;
                let offLX = 0, offLY = 0;
                if (dragHandle.includes('e')) { halfW = Math.max(5, halfW + localDx / 2); offLX = halfW - initialWidth / 2; }
                if (dragHandle.includes('w')) { halfW = Math.max(5, halfW - localDx / 2); offLX = initialWidth / 2 - halfW; }
                if (dragHandle.includes('s')) { halfH = Math.max(5, halfH + localDy / 2); offLY = halfH - initialHeight / 2; }
                if (dragHandle.includes('n')) { halfH = Math.max(5, halfH - localDy / 2); offLY = initialHeight / 2 - halfH; }

                const nextX = initialAsset.x + offLX * cosR - offLY * sinR;
                const nextY = initialAsset.y + offLX * sinR + offLY * cosR;
                store.updateAsset(item.id, { x: nextX, y: nextY, width: halfW * 2, height: halfH * 2, scale: 1 }, true);

            } else if (item.type === 'wall') {
                const initialWall = item.object as Wall;
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                initialWall.nodes.forEach(n => { minX = Math.min(minX, n.x); minY = Math.min(minY, n.y); maxX = Math.max(maxX, n.x); maxY = Math.max(maxY, n.y); });
                const iW = maxX - minX, iH = maxY - minY;
                if (iW === 0 || iH === 0) return;
                let nMinX = minX, nMinY = minY, nMaxX = maxX, nMaxY = maxY;
                if (dragHandle.includes('n')) nMinY += finalDy;
                if (dragHandle.includes('s')) nMaxY += finalDy;
                if (dragHandle.includes('w')) nMinX += finalDx;
                if (dragHandle.includes('e')) nMaxX += finalDx;
                const sX = (nMaxX - nMinX) / iW, sY = (nMaxY - nMinY) / iH;
                const newNodes = initialWall.nodes.map(n => ({ ...n, x: nMinX + (n.x - minX) * sX, y: nMinY + (n.y - minY) * sY }));
            store.updateWall(item.id, { nodes: newNodes }, true);
            }
        });
    }, [dragHandle, initialState, screenToWorld, selectedIds, zoom, assetSpatialIndex]);

    const handleMouseUp = useCallback(() => {
        setDragHandle(null);
        setInitialState(null);
        setCurrentRotation(0);
        lastMoveFrameRef.current = 0;

        useSceneStore.getState().setSnapGuides([]);
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

    // Only use initial state for Rotation to keep pivot stable.
    // Movement and Resizing should use the live recalculated groupBounds from the store.
    const activeGroupBounds = (dragHandle === 'rotate' && initialState) ? initialState.groupBounds : groupBounds;
    const { x, y, width, height, rotation } = activeGroupBounds;
    const effectiveRotation = (dragHandle === 'rotate') ? (rotation + currentRotation) : rotation;

    const halfW = width / 2;
    const halfH = height / 2;
    
    const worldToScreenPoint = (wx: number, wy: number) => ({ x: wx * zoom + panX, y: wy * zoom + panY });
    const cosR = Math.cos((effectiveRotation * Math.PI) / 180);
    const sinR = Math.sin((effectiveRotation * Math.PI) / 180);
    const rotatePoint = (px: number, py: number) => ({ x: x + px * cosR - py * sinR, y: y + px * sinR + py * cosR });

    const clampX = (val: number) => Math.max(-2000, Math.min((viewportSize?.width || 0) + 2000, val || 0));
    const clampY = (val: number) => Math.max(-2000, Math.min((viewportSize?.height || 0) + 2000, val || 0));
    
    const p1w = rotatePoint(-halfW, -halfH);
    const p2w = rotatePoint(halfW, -halfH);
    const p3w = rotatePoint(-halfW, halfH);
    const p4w = rotatePoint(halfW, halfH);

    const boxTopLeft = { x: clampX(worldToScreenPoint(p1w.x, p1w.y).x), y: clampY(worldToScreenPoint(p1w.x, p1w.y).y) };
    const boxTopRight = { x: clampX(worldToScreenPoint(p2w.x, p2w.y).x), y: clampY(worldToScreenPoint(p2w.x, p2w.y).y) };
    const boxBottomLeft = { x: clampX(worldToScreenPoint(p3w.x, p3w.y).x), y: clampY(worldToScreenPoint(p3w.x, p3w.y).y) };
    const boxBottomRight = { x: clampX(worldToScreenPoint(p4w.x, p4w.y).x), y: clampY(worldToScreenPoint(p4w.x, p4w.y).y) };
    const centerScreen = worldToScreenPoint(x, y);
    const rotationGuideLength = Math.max(80, Math.max(width, height) * zoom * 0.7);
    const rotationGuideAngle = (effectiveRotation * Math.PI) / 180;
    const rotationGuideStart = {
        x: centerScreen.x - Math.cos(rotationGuideAngle) * rotationGuideLength,
        y: centerScreen.y - Math.sin(rotationGuideAngle) * rotationGuideLength
    };
    const rotationGuideEnd = {
        x: centerScreen.x + Math.cos(rotationGuideAngle) * rotationGuideLength,
        y: centerScreen.y + Math.sin(rotationGuideAngle) * rotationGuideLength
    };
    const isRotationSnapped = dragHandle === 'rotate' && Math.abs(currentRotation - Math.round(currentRotation / ROTATION_SNAP_STEP) * ROTATION_SNAP_STEP) < 0.001;
    const rotationAngleLabel = `${Math.round((((effectiveRotation % 360) + 360) % 360))}°`;

    const isTooLarge = width > 50000 || height > 50000;
    const overlayFill = isTooLarge ? "none" : "rgba(59, 130, 246, 0.05)";
    const overlayDash = isTooLarge ? "2 2" : "none";
    const allowOverlayMove = selectedItems.length < 12;

    const isSingleStraightLine = selectedItems.length === 1 && selectedItems[0].type === 'shape' && (((selectedItems[0].object as Shape).type === 'line' || (selectedItems[0].object as Shape).type === 'arrow') && !(selectedItems[0].object as Shape).points);
    const isSingleDimension = selectedItems.length === 1 && selectedItems[0].type === 'dimension';

    if (isSingleDimension) {
        const dim = selectedItems[0].object as Dimension;
        const start = dim.startPoint, end = dim.endPoint;
        const startScreen = worldToScreenPoint(start.x, start.y), endScreen = worldToScreenPoint(end.x, end.y);
        const centerScreen = worldToScreenPoint((start.x + end.x) / 2, (start.y + end.y) / 2);
        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        const rotPt = worldToScreenPoint((start.x + end.x) / 2 - Math.sin(angle) * (30 / zoom), (start.y + end.y) / 2 + Math.cos(angle) * (30 / zoom));

        return (
            <g data-export-ignore="true">
                <line x1={startScreen.x} y1={startScreen.y} x2={endScreen.x} y2={endScreen.y} stroke="#3B82F6" strokeWidth={2} vectorEffect="non-scaling-stroke" />
                <line x1={centerScreen.x} y1={centerScreen.y} x2={rotPt.x} y2={rotPt.y} stroke="#3B82F6" strokeWidth={2} vectorEffect="non-scaling-stroke" />
                <rect x={startScreen.x - 7} y={startScreen.y - 7} width={14} height={14} fill="white" stroke="#3b82f6" strokeWidth={2} className="cursor-nwse-resize" onMouseDown={(e) => handleMouseDown(e, 'w')} />
                <rect x={endScreen.x - 7} y={endScreen.y - 7} width={14} height={14} fill="white" stroke="#3b82f6" strokeWidth={2} className="cursor-nwse-resize" onMouseDown={(e) => handleMouseDown(e, 'e')} />
                <circle cx={rotPt.x} cy={rotPt.y} r={7} fill="white" stroke="#3B82F6" strokeWidth={2} className="cursor-grab" onMouseDown={(e) => handleMouseDown(e, 'rotate')} />
            </g>
        );
    }

    if (isSingleStraightLine) {
        const shape = selectedItems[0].object as Shape;
        const rot = (shape.rotation || 0) * (Math.PI / 180);
        const s = { x: shape.x - (shape.width / 2) * Math.cos(rot), y: shape.y - (shape.width / 2) * Math.sin(rot) };
        const e = { x: shape.x + (shape.width / 2) * Math.cos(rot), y: shape.y + (shape.width / 2) * Math.sin(rot) };
        const ss = worldToScreenPoint(s.x, s.y), es = worldToScreenPoint(e.x, e.y), cs = worldToScreenPoint(shape.x, shape.y);
        const rp = worldToScreenPoint(shape.x - Math.sin(rot) * (30 / zoom), shape.y + Math.cos(rot) * (30 / zoom));
        return (
            <g data-export-ignore="true">
                <line x1={ss.x} y1={ss.y} x2={es.x} y2={es.y} stroke="#3B82F6" strokeWidth={2} vectorEffect="non-scaling-stroke" />
                <line x1={cs.x} y1={cs.y} x2={rp.x} y2={rp.y} stroke="#3B82F6" strokeWidth={2} vectorEffect="non-scaling-stroke" />
                {/* For straight lines, these handles still scale the whole item relative to center/opposite */}
                <rect x={ss.x - 7} y={ss.y - 7} width={14} height={14} fill="white" stroke="#3b82f6" strokeWidth={2} className="cursor-pointer" onMouseDown={(e) => handleMouseDown(e, 'w')} />
                <rect x={es.x - 7} y={es.y - 7} width={14} height={14} fill="white" stroke="#3b82f6" strokeWidth={2} className="cursor-pointer" onMouseDown={(e) => handleMouseDown(e, 'e')} />
                <circle cx={rp.x} cy={rp.y} r={7} fill="white" stroke="#3B82F6" strokeWidth={2} className="cursor-grab" onMouseDown={(e) => handleMouseDown(e, 'rotate')} />
            </g>
        );
    }

    // New: If single Polyline is selected, render vertex handles
    const isSinglePolyline = selectedItems.length === 1 && selectedItems[0].type === 'shape' && (selectedItems[0].object as Shape).points;
    if (isSinglePolyline) {
        const shape = selectedItems[0].object as Shape;
        if (shape.points) {
            return (
                <g data-export-ignore="true">
                    {/* Bounding box for moving the whole thing */}
                    <polygon 
                        points={`${boxTopLeft.x},${boxTopLeft.y} ${boxTopRight.x},${boxTopRight.y} ${boxBottomRight.x},${boxBottomRight.y} ${boxBottomLeft.x},${boxBottomLeft.y}`} 
                        fill={overlayFill} 
                        stroke="#3B82F6" 
                        strokeWidth={isTooLarge ? 1 : 2} 
                        strokeDasharray={overlayDash}
                        vectorEffect="non-scaling-stroke" 
                        onMouseDown={(e) => handleMouseDown(e, 'move')} 
                        style={{ cursor: 'move' }}
                    />
                    {shape.points.map((p, i) => {
                        const pt = worldToScreenPoint(shape.x + p.x, shape.y + p.y);
                        return (
                            <rect 
                                key={i} 
                                x={pt.x - 5} y={pt.y - 5} width={10} height={10} 
                                fill="white" stroke="#3b82f6" strokeWidth={1.5} 
                                className="cursor-crosshair" 
                                onMouseDown={(e) => handleMouseDown(e, `vertex-${i}`)} 
                            />
                        );
                    })}
                </g>
            );
        }
    }

    return (
        <g data-export-ignore="true">
            {dragHandle === 'rotate' && (
                <>
                    <line
                        x1={0}
                        y1={centerScreen.y}
                        x2={viewportSize.width}
                        y2={centerScreen.y}
                        stroke="#22c55e"
                        strokeWidth={1.5}
                        strokeDasharray="8 6"
                        vectorEffect="non-scaling-stroke"
                    />
                    <line
                        x1={centerScreen.x}
                        y1={0}
                        x2={centerScreen.x}
                        y2={viewportSize.height}
                        stroke="#ef4444"
                        strokeWidth={1.5}
                        strokeDasharray="8 6"
                        vectorEffect="non-scaling-stroke"
                    />
                    <line
                        x1={rotationGuideStart.x}
                        y1={rotationGuideStart.y}
                        x2={rotationGuideEnd.x}
                        y2={rotationGuideEnd.y}
                        stroke={isRotationSnapped ? "#f59e0b" : "#2563EB"}
                        strokeWidth={isRotationSnapped ? 2 : 1.5}
                        strokeDasharray="10 6"
                        vectorEffect="non-scaling-stroke"
                    />
                    <g transform={`translate(${centerScreen.x + 14}, ${centerScreen.y - 14})`}>
                        <rect
                            x={0}
                            y={-18}
                            rx={6}
                            ry={6}
                            width={46}
                            height={24}
                            fill="white"
                            stroke={isRotationSnapped ? "#f59e0b" : "#3B82F6"}
                            strokeWidth={1}
                            vectorEffect="non-scaling-stroke"
                        />
                        <text
                            x={23}
                            y={-2}
                            textAnchor="middle"
                            fontSize={12}
                            fontWeight={600}
                            fill={isRotationSnapped ? "#b45309" : "#1D4ED8"}
                        >
                            {rotationAngleLabel}
                        </text>
                    </g>
                </>
            )}
            {/* Move handle (transparent overlay) */}
            <polygon 
                points={`${boxTopLeft.x},${boxTopLeft.y} ${boxTopRight.x},${boxTopRight.y} ${boxBottomRight.x},${boxBottomRight.y} ${boxBottomLeft.x},${boxBottomLeft.y}`} 
                fill={overlayFill} 
                stroke="#3B82F6" 
                strokeWidth={isTooLarge ? 1 : 2} 
                strokeDasharray={overlayDash}
                vectorEffect="non-scaling-stroke" 
                onMouseDown={allowOverlayMove ? (e) => handleMouseDown(e, 'move') : undefined} 
                style={{ cursor: allowOverlayMove ? 'move' : 'default', pointerEvents: allowOverlayMove ? 'auto' : 'none' }}
            />
            
            {['nw', 'ne', 'se', 'sw', 'n', 'e', 's', 'w'].map(h => {
                const px = h.includes('w') ? -halfW : (h.includes('e') ? halfW : 0);
                const py = h.includes('n') ? -halfH : (h.includes('s') ? halfH : 0);
                const pos = worldToScreenPoint(rotatePoint(px, py).x, rotatePoint(px, py).y);
                const cursors: Record<string, string> = { nw: 'nwse', ne: 'nesw', se: 'nwse', sw: 'nesw', n: 'ns', s: 'ns', e: 'ew', w: 'ew' };
                return (
                    <rect 
                        key={h} 
                        x={pos.x - 7} y={pos.y - 7} 
                        width={14} height={14} 
                        fill="white" stroke="#3b82f6" strokeWidth={2} 
                        style={{ cursor: `${cursors[h]}-resize` }}
                        onMouseDown={(e) => handleMouseDown(e, h)} 
                        transform={`rotate(${effectiveRotation} ${pos.x} ${pos.y})`} 
                    />
                );
            })}

            {(() => {
                const sp_raw = worldToScreenPoint(rotatePoint(0, -halfH).x, rotatePoint(0, -halfH).y);
                const ep_raw = worldToScreenPoint(rotatePoint(0, -halfH - Math.max(0, 30 / (zoom || 1))).x, rotatePoint(0, -halfH - Math.max(0, 30 / (zoom || 1))).y);
                
                const sp = { x: clampX(sp_raw.x), y: clampY(sp_raw.y) };
                const ep = { x: clampX(ep_raw.x), y: clampY(ep_raw.y) };
                
                return (
                    <>
                        <line x1={sp.x} y1={sp.y} x2={ep.x} y2={ep.y} stroke="#3B82F6" strokeWidth={2} vectorEffect="non-scaling-stroke" />
                        <circle cx={ep.x} cy={ep.y} r={7} fill="white" stroke="#3B82F6" strokeWidth={2} style={{ cursor: 'grab' }} onMouseDown={(e) => handleMouseDown(e, 'rotate')} />
                    </>
                );
            })()}
        </g>
    );
}
