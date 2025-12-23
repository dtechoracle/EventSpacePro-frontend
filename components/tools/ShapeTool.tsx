"use client";

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useEditorStore } from '@/store/editorStore';
import { useProjectStore, Shape } from '@/store/projectStore';
import { snapTo90Degrees } from '@/lib/wallGeometry';

interface ShapeToolProps {
    isActive: boolean;
    shapeType: 'rectangle' | 'ellipse' | 'line' | 'arrow' | 'polygon';
}

export default function ShapeTool({ isActive, shapeType }: ShapeToolProps) {
    const { screenToWorld, snapToGrid, gridSize, setSelectedIds, setActiveTool } = useEditorStore();
    const { addShape, getNextZIndex, shapes } = useProjectStore();

    // Multi-segment state for lines/arrows
    const [segments, setSegments] = useState<Array<{ start: { x: number; y: number }; end: { x: number; y: number } }>>([]);
    const [lastPoint, setLastPoint] = useState<{ x: number; y: number } | null>(null);
    const [previewPoint, setPreviewPoint] = useState<{ x: number; y: number } | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [lastClickTime, setLastClickTime] = useState(0);

    // Single-segment state for rectangles/ellipses
    const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
    const [endPoint, setEndPoint] = useState<{ x: number; y: number } | null>(null);

    const isLineMode = shapeType === 'line' || shapeType === 'arrow';
    const isPolygon = shapeType === 'polygon';

    const [polygonSides, setPolygonSides] = useState<number>(4);
    const [showPolygonModal, setShowPolygonModal] = useState<boolean>(false);
    const [polygonInput, setPolygonInput] = useState<string>('4');

    // Prompt for polygon sides when activating the polygon tool
    useEffect(() => {
        if (isActive && isPolygon) {
            setPolygonInput('4');
            setShowPolygonModal(true);
        } else {
            setShowPolygonModal(false);
        }
    }, [isActive, isPolygon]);

    const confirmPolygonSides = useCallback(() => {
        const n = parseInt(polygonInput, 10);
        const valid = Number.isFinite(n) ? Math.max(4, Math.min(12, n)) : 4;
        setPolygonSides(valid);
        setShowPolygonModal(false);
    }, [polygonInput]);

    const cancelPolygonSides = useCallback(() => {
        setPolygonSides(4);
        setShowPolygonModal(false);
    }, []);

    // existing line endpoints for snapping
    const existingEndpoints = useMemo(() => {
        const pts: Array<{ x: number; y: number }> = [];
        shapes.forEach(s => {
            if (s.type === 'line' || s.type === 'arrow') {
                if (s.points && s.points.length >= 2) {
                    // polyline endpoints
                    const first = s.points[0];
                    const last = s.points[s.points.length - 1];
                    const cx = s.x;
                    const cy = s.y;
                    pts.push({ x: cx + first.x, y: cy + first.y });
                    pts.push({ x: cx + last.x, y: cy + last.y });
                } else {
                    const rot = (s.rotation || 0) * Math.PI / 180;
                    const dx = Math.cos(rot) * (s.width / 2);
                    const dy = Math.sin(rot) * (s.width / 2);
                    pts.push({ x: s.x - dx, y: s.y - dy });
                    pts.push({ x: s.x + dx, y: s.y + dy });
                }
            }
        });
        return pts;
    }, [shapes]);

    // Handle mouse down (rect/ellipse only)
    const handleMouseDown = useCallback((e: MouseEvent) => {
        if (!isActive || isLineMode || e.button !== 0) return;

        // Wait for polygon sides input before drawing
        if (isPolygon && showPolygonModal) return;

        // Ignore clicks that are not inside the main workspace SVG
        const target = e.target as Element | null;
        if (!target || !target.closest('svg[data-workspace-root="true"]')) {
            return;
        }

        const worldPos = screenToWorld(e.clientX, e.clientY);
        const snapped = snapToGrid
            ? { x: Math.round(worldPos.x / gridSize) * gridSize, y: Math.round(worldPos.y / gridSize) * gridSize }
            : worldPos;

        setStartPoint(snapped);
        setEndPoint(snapped);
        setIsDrawing(true);
    }, [isActive, isLineMode, screenToWorld, snapToGrid, gridSize]);

    // Handle mouse move
    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isActive) return;
        const worldPos = screenToWorld(e.clientX, e.clientY);
        let snapped = snapToGrid
            ? { x: Math.round(worldPos.x / gridSize) * gridSize, y: Math.round(worldPos.y / gridSize) * gridSize }
            : worldPos;

        if (isLineMode) {
            if (!isDrawing || !lastPoint) return;
            // snap only to existing endpoints (no forced 90°)
            for (const p of existingEndpoints) {
                if (Math.hypot(snapped.x - p.x, snapped.y - p.y) < gridSize * 0.4) {
                    snapped = p;
                    break;
                }
            }
            setPreviewPoint(snapped);
        } else {
            if (!isDrawing || !startPoint) return;
            setEndPoint(snapped);
        }
    }, [isActive, isDrawing, isLineMode, lastPoint, existingEndpoints, screenToWorld, snapToGrid, gridSize]);

    // Handle mouse up (rect/ellipse/polygon only)
    const handleMouseUp = useCallback(() => {
        if (!isActive || isLineMode || !isDrawing || !startPoint || !endPoint) return;

        const width = Math.abs(endPoint.x - startPoint.x);
        const height = Math.abs(endPoint.y - startPoint.y);
        if (width < 5 || height < 5) {
            setStartPoint(null);
            setEndPoint(null);
            setIsDrawing(false);
            return;
        }

        const centerX = (startPoint.x + endPoint.x) / 2;
        const centerY = (startPoint.y + endPoint.y) / 2;

        let finalWidth = width;
        let finalHeight = height;

        const newShape: Shape = {
            id: `shape-${Date.now()}`,
            type: shapeType,
            x: centerX,
            y: centerY,
            width: finalWidth,
            height: finalHeight,
            rotation: 0,
            fill: 'transparent',
            // Default black stroke for better visibility
            stroke: '#000000',
            strokeWidth: 2,
            zIndex: getNextZIndex(),
        };

        // If polygon, generate regular polygon points
        if (shapeType === 'polygon') {
            const sides = Math.max(4, polygonSides || 4);
            const radius = Math.min(width, height) / 2;
            const pts: { x: number; y: number }[] = [];
            for (let i = 0; i < sides; i++) {
                const angle = ((Math.PI * 2) / sides) * i - Math.PI / 2;
                pts.push({
                    x: Math.cos(angle) * radius,
                    y: Math.sin(angle) * radius,
                });
            }
            // Tighten bounds to the polygon itself so controllers hug the shape
            finalWidth = radius * 2;
            finalHeight = radius * 2;
            newShape.width = finalWidth;
            newShape.height = finalHeight;
            newShape.points = pts;
            newShape.polygonSides = sides;
        }

        addShape(newShape);
        setSelectedIds([newShape.id]);
        setActiveTool('select');

        setStartPoint(null);
        setEndPoint(null);
        setIsDrawing(false);
    }, [isActive, isLineMode, isDrawing, startPoint, endPoint, shapeType, addShape, getNextZIndex, setSelectedIds, setActiveTool, polygonSides]);

    // Line/polyline: finish and create shape
    const finishLine = useCallback((overrideSegments?: Array<{ start: { x: number; y: number }; end: { x: number; y: number } }>, overrideLastPoint?: { x: number; y: number }) => {
        const segs = overrideSegments ?? segments;
        const last = overrideLastPoint ?? lastPoint;

        if (segs.length === 0 || !last) {
            setIsDrawing(false);
            setSegments([]);
            setLastPoint(null);
            setPreviewPoint(null);
            return;
        }

        // Single segment -> store as classic straight line (width/rotation) with no points
        if (segs.length === 1) {
            const seg = segs[0];
            const dx = seg.end.x - seg.start.x;
            const dy = seg.end.y - seg.start.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const centerX = (seg.start.x + seg.end.x) / 2;
            const centerY = (seg.start.y + seg.end.y) / 2;
            const rotation = Math.atan2(dy, dx) * (180 / Math.PI);

            const newShape: Shape = {
                id: `shape-${Date.now()}`,
                type: shapeType,
                x: centerX,
                y: centerY,
                width: Math.max(distance, 1),
                height: 2,
                rotation,
                fill: 'transparent',
                // Black, very thick default stroke for single lines/arrows
                stroke: '#000000',
                strokeWidth: 2,
                zIndex: getNextZIndex(),
            };

            addShape(newShape);
            setSelectedIds([newShape.id]);
            setActiveTool('select');
        } else {
            // Multi‑segment -> store as polyline points
            const pts: { x: number; y: number }[] = [];
            pts.push(segs[0].start);
            segs.forEach(seg => pts.push(seg.end));

            const xs = pts.map(p => p.x);
            const ys = pts.map(p => p.y);
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);
            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;
            const width = Math.max(maxX - minX, 10);
            const height = Math.max(maxY - minY, 10);

            const relativePoints = pts.map(p => ({ x: p.x - centerX, y: p.y - centerY }));

            const newShape: Shape = {
                id: `shape-${Date.now()}`,
                type: shapeType,
                x: centerX,
                y: centerY,
                width,
                height,
                rotation: 0,
                fill: 'transparent',
                // Black, very thick default stroke for multi‑segment lines/arrows
                stroke: '#000000',
                strokeWidth: 2,
                points: relativePoints,
                zIndex: getNextZIndex(),
            };

            addShape(newShape);
            setSelectedIds([newShape.id]);
            setActiveTool('select');
        }

        setSegments([]);
        setLastPoint(null);
        setPreviewPoint(null);
        setIsDrawing(false);
    }, [segments, lastPoint, shapeType, addShape, getNextZIndex, setSelectedIds, setActiveTool]);

    // Handle click for line/polyline
    const handleLineClick = useCallback((e: MouseEvent) => {
        if (!isActive || !isLineMode || e.button !== 0) return;

        // Safety: if polygon modal is open, do not start drawing
        if (isPolygon && showPolygonModal) return;

        // Ignore clicks that are not inside the main workspace SVG
        const target = e.target as Element | null;
        if (!target || !target.closest('svg[data-workspace-root="true"]')) {
            return;
        }

        const now = Date.now();
        const timeSinceLast = now - lastClickTime;
        setLastClickTime(now);

        const worldPos = screenToWorld(e.clientX, e.clientY);
        let snapped = snapToGrid
            ? { x: Math.round(worldPos.x / gridSize) * gridSize, y: Math.round(worldPos.y / gridSize) * gridSize }
            : worldPos;

        // snap to existing endpoints only (no forced 90°)
        for (const p of existingEndpoints) {
            if (Math.hypot(snapped.x - p.x, snapped.y - p.y) < gridSize * 0.4) {
                snapped = p;
                break;
            }
        }

        if (!isDrawing) {
            setIsDrawing(true);
            setLastPoint(snapped);
            setPreviewPoint(snapped);
            return;
        }

        if (lastPoint) {
            const dist = Math.hypot(snapped.x - lastPoint.x, snapped.y - lastPoint.y);
            if (dist < 5) return;

            const newSegment = { start: lastPoint, end: snapped };
            const nextSegments = [...segments, newSegment];
            setSegments(nextSegments);
            setLastPoint(snapped);
            setPreviewPoint(snapped);

            // double click to finish AFTER adding the segment
            if (timeSinceLast < 300) {
                finishLine(nextSegments, snapped);
            }
        }
    }, [isActive, isLineMode, lastPoint, segments.length, lastClickTime, screenToWorld, snapToGrid, gridSize, existingEndpoints, finishLine]);

    // Attach event listeners
    useEffect(() => {
        if (!isActive) {
            setStartPoint(null);
            setEndPoint(null);
            setIsDrawing(false);
            setSegments([]);
            setLastPoint(null);
            setPreviewPoint(null);
            return;
        }

        if (isLineMode) {
            window.addEventListener('click', handleLineClick);
            window.addEventListener('mousemove', handleMouseMove);
            const handleKey = (e: KeyboardEvent) => {
                if (e.key === 'Escape') finishLine();
            };
            window.addEventListener('keydown', handleKey);
            return () => {
                window.removeEventListener('click', handleLineClick);
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('keydown', handleKey);
            };
        } else {
            window.addEventListener('mousedown', handleMouseDown);
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            return () => {
                window.removeEventListener('mousedown', handleMouseDown);
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isActive, isLineMode, handleLineClick, handleMouseDown, handleMouseMove, handleMouseUp, finishLine]);

    // Render
    if (!isActive) return null;

    const polygonModal = showPolygonModal
        ? createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" style={{ pointerEvents: 'auto' }}>
                <div className="bg-white rounded-lg shadow-xl p-4 w-72 space-y-3">
                    <div className="text-sm font-semibold">Polygon sides</div>
                    <div className="text-xs text-gray-500">Enter number of sides (min 4, max 12)</div>
                    <input
                        type="number"
                        min={4}
                        max={12}
                        value={polygonInput}
                        onChange={(e) => setPolygonInput(e.target.value)}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring focus:border-blue-400"
                    />
                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            onClick={cancelPolygonSides}
                            className="px-3 py-1 text-sm rounded bg-gray-100 hover:bg-gray-200"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={confirmPolygonSides}
                            className="px-3 py-1 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
                        >
                            OK
                        </button>
                    </div>
                </div>
            </div>,
            document.body
        )
        : null;

    // Line/polyline preview
    if (isLineMode) {
        if (!isDrawing || !lastPoint || !previewPoint) return polygonModal;
        return (
            <>
                <g className="shape-tool-overlay" style={{ pointerEvents: 'none' }}>
                    {segments.map((seg, idx) => (
                        <line
                            key={idx}
                            x1={seg.start.x}
                            y1={seg.start.y}
                            x2={seg.end.x}
                            y2={seg.end.y}
                            stroke="#3b82f6"
                            strokeWidth={2}
                            opacity={0.7}
                            vectorEffect="non-scaling-stroke"
                        />
                    ))}
                    <line
                        x1={lastPoint.x}
                        y1={lastPoint.y}
                        x2={previewPoint.x}
                        y2={previewPoint.y}
                        stroke="#3b82f6"
                        strokeWidth={2}
                        strokeDasharray="5,5"
                        opacity={0.7}
                        vectorEffect="non-scaling-stroke"
                    />
                </g>
                {polygonModal}
            </>
        );
    }

    if (!isDrawing || !startPoint || !endPoint) return polygonModal;

    // Calculate preview dimensions
    const width = Math.abs(endPoint.x - startPoint.x);
    const height = Math.abs(endPoint.y - startPoint.y);
    const centerX = (startPoint.x + endPoint.x) / 2;
    const centerY = (startPoint.y + endPoint.y) / 2;

    // Ensure minimum dimensions for visibility
    const minSize = 1;
    const previewWidth = Math.max(width, minSize);
    const previewHeight = Math.max(height, minSize);

    return (
        <>
            <g className="shape-tool-overlay" style={{ pointerEvents: 'none' }}>
                {shapeType === 'rectangle' && (
                    <rect
                        x={centerX - previewWidth / 2}
                        y={centerY - previewHeight / 2}
                        width={previewWidth}
                        height={previewHeight}
                        fill="transparent"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        strokeDasharray="5,5"
                        opacity={0.7}
                        vectorEffect="non-scaling-stroke"
                    />
                )}

                {shapeType === 'ellipse' && (
                    <ellipse
                        cx={centerX}
                        cy={centerY}
                        rx={Math.max(previewWidth / 2, minSize / 2)}
                        ry={Math.max(previewHeight / 2, minSize / 2)}
                        fill="transparent"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        strokeDasharray="5,5"
                        opacity={0.7}
                        vectorEffect="non-scaling-stroke"
                    />
                )}

                {shapeType === 'polygon' && (
                    <polygon
                        points={(() => {
                            const pts: string[] = [];
                            const sides = polygonSides || 4;
                            const radius = Math.min(previewWidth, previewHeight) / 2;
                            for (let i = 0; i < sides; i++) {
                                const angle = (2 * Math.PI * i) / sides - Math.PI / 2;
                                const x = centerX + radius * Math.cos(angle);
                                const y = centerY + radius * Math.sin(angle);
                                pts.push(`${x},${y}`);
                            }
                            return pts.join(' ');
                        })()}
                        fill="transparent"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        strokeDasharray="5,5"
                        opacity={0.7}
                        vectorEffect="non-scaling-stroke"
                    />
                )}

                {isLineMode && (
                    <line
                        x1={startPoint.x}
                        y1={startPoint.y}
                        x2={endPoint.x}
                        y2={endPoint.y}
                        stroke="#3b82f6"
                        strokeWidth={2}
                        strokeDasharray="5,5"
                        opacity={0.7}
                        vectorEffect="non-scaling-stroke"
                    />
                )}
            </g>
            {polygonModal}
        </>
    );
}
