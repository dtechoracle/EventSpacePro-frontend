"use client";

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useEditorStore } from '@/store/editorStore';
import { useProjectStore, Shape } from '@/store/projectStore';
import { snapTo90Degrees } from '@/lib/wallGeometry';
import { findSnapPointInShapes, SnapPoint } from '@/utils/snapToDrawing';

interface ShapeToolProps {
    isActive: boolean;
    shapeType: 'rectangle' | 'ellipse' | 'line' | 'arrow' | 'polygon';
}

export default function ShapeTool({ isActive, shapeType }: ShapeToolProps) {
    const { screenToWorld, snapToGrid, gridSize, setSelectedIds, setActiveTool, zoom } = useEditorStore();
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
    const [snapIndicator, setSnapIndicator] = useState<SnapPoint | null>(null);

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
        const { zoom, snapToObjects } = useEditorStore.getState();

        let snapped = snapToGrid
            ? { x: Math.round(worldPos.x / gridSize) * gridSize, y: Math.round(worldPos.y / gridSize) * gridSize }
            : worldPos;

        // Enhanced snap-to-objects
        let currentSnapPoint: SnapPoint | null = null;
        if (snapToObjects) {
            const { shapes, walls, assets } = useProjectStore.getState();
            const allElements = [...shapes, ...walls, ...assets];
            const snapResult = findSnapPointInShapes(worldPos, allElements, 20 / zoom);
            if (snapResult) {
                snapped = { x: snapResult.x, y: snapResult.y };
                currentSnapPoint = snapResult;
            }
        }
        setSnapIndicator(currentSnapPoint);

        if (isLineMode) {
            if (!isDrawing || !lastPoint) return;

            // If not already snapped to an object, check endpoints (legacy behavior, maybe redundant but safe)
            if (!currentSnapPoint) {
                const snapThreshold = 20 / zoom;
                for (const p of existingEndpoints) {
                    if (Math.hypot(snapped.x - p.x, snapped.y - p.y) < snapThreshold) {
                        snapped = p;
                        break;
                    }
                }
            }

            // Also snap to the start of the current line (to close loop)
            if (segments.length > 0) {
                const start = segments[0].start;
                const snapThreshold = 20 / zoom;
                if (Math.hypot(snapped.x - start.x, snapped.y - start.y) < snapThreshold) {
                    snapped = start;
                }
            }

            setPreviewPoint(snapped);
        } else {
            if (!isDrawing || !startPoint) return;
            setEndPoint(snapped);
        }
    }, [isActive, isDrawing, isLineMode, lastPoint, existingEndpoints, screenToWorld, snapToGrid, gridSize, segments, shapes]);

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
            strokeWidth: 5,
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
                // Black default stroke for single lines/arrows
                stroke: '#000000',
                strokeWidth: 5,
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

            // Check if closed loop (last point near first point)
            const first = pts[0];
            const last = pts[pts.length - 1];
            const dist = Math.hypot(last.x - first.x, last.y - first.y);
            const snapThreshold = 20 / useEditorStore.getState().zoom;
            const isClosed = dist < snapThreshold;

            let finalType = shapeType;
            if (isClosed && shapeType === 'line') {
                finalType = 'polygon';
                pts.pop(); // Remove the closing point as polygon implies closure
            }

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
                type: finalType as any,
                x: centerX,
                y: centerY,
                width,
                height,
                rotation: 0,
                fill: 'transparent', // Ready for fill
                // Black default stroke for multi‑segment lines/arrows
                stroke: '#000000',
                strokeWidth: 5,
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

        // If starting a new line and a line/arrow is selected, start from its endpoint
        if (!isDrawing) {
            const { selectedIds } = useEditorStore.getState();
            if (selectedIds.length === 1) {
                const selectedShape = shapes.find(s => s.id === selectedIds[0]);
                if (selectedShape && (selectedShape.type === 'line' || selectedShape.type === 'arrow')) {
                    let endpoint: { x: number; y: number } | null = null;

                    if (selectedShape.points && selectedShape.points.length >= 2) {
                        // Polyline - use the last point
                        const last = selectedShape.points[selectedShape.points.length - 1];
                        endpoint = { x: selectedShape.x + last.x, y: selectedShape.y + last.y };
                    } else {
                        // Legacy straight line - calculate endpoint from rotation
                        const rot = (selectedShape.rotation || 0) * (Math.PI / 180);
                        const halfLen = selectedShape.width / 2;
                        endpoint = {
                            x: selectedShape.x + halfLen * Math.cos(rot),
                            y: selectedShape.y + halfLen * Math.sin(rot)
                        };
                    }

                    if (endpoint) {
                        // Check if click is near the endpoint
                        const snapThreshold = 20 / useEditorStore.getState().zoom;
                        if (Math.hypot(worldPos.x - endpoint.x, worldPos.y - endpoint.y) < snapThreshold * 2) {
                            snapped = endpoint;
                        }
                    }
                }
            }
        }

        // snap to existing endpoints only (no forced 90°)
        const snapThreshold = 20 / useEditorStore.getState().zoom;
        for (const p of existingEndpoints) {
            if (Math.hypot(snapped.x - p.x, snapped.y - p.y) < snapThreshold) {
                snapped = p;
                break;
            }
        }

        // Also snap to the start of the current line (to close loop)
        if (segments.length > 0) {
            const start = segments[0].start;
            if (Math.hypot(snapped.x - start.x, snapped.y - start.y) < snapThreshold) {
                snapped = start;
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
    }, [isActive, isLineMode, lastPoint, segments, lastClickTime, screenToWorld, snapToGrid, gridSize, existingEndpoints, finishLine]);

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

        // Check if snapping to start (closing loop)
        const isSnappingToStart = segments.length > 0 &&
            Math.hypot(previewPoint.x - segments[0].start.x, previewPoint.y - segments[0].start.y) < 1; // Exact match due to snap logic


        return (
            <>
                {/* Line/Polyline Preview */}
                {isLineMode && segments.length > 0 && previewPoint && (
                    <>
                        {/* Guide lines - horizontal (red) and vertical (green) from last point */}
                        {(() => {
                            const lastSeg = segments[segments.length - 1];
                            const lastPt = lastSeg.end;
                            const dx = previewPoint.x - lastPt.x;
                            const dy = previewPoint.y - lastPt.y;
                            const wallLength = Math.sqrt(dx * dx + dy * dy);
                            const guideLength = Math.max(wallLength * 2, 500);

                            return (
                                <>
                                    {/* Horizontal guide (red) from last point */}
                                    <line
                                        x1={lastPt.x - guideLength}
                                        y1={lastPt.y}
                                        x2={lastPt.x + guideLength}
                                        y2={lastPt.y}
                                        stroke="#ef4444"
                                        strokeWidth={1}
                                        opacity={0.7}
                                        strokeDasharray="4,4"
                                        vectorEffect="non-scaling-stroke"
                                    />
                                    {/* Vertical guide (green) from last point */}
                                    <line
                                        x1={lastPt.x}
                                        y1={lastPt.y - guideLength}
                                        x2={lastPt.x}
                                        y2={lastPt.y + guideLength}
                                        stroke="#22c55e"
                                        strokeWidth={1}
                                        opacity={0.7}
                                        strokeDasharray="4,4"
                                        vectorEffect="non-scaling-stroke"
                                    />
                                    {/* Horizontal guide (red) from current point */}
                                    <line
                                        x1={previewPoint.x - guideLength}
                                        y1={previewPoint.y}
                                        x2={previewPoint.x + guideLength}
                                        y2={previewPoint.y}
                                        stroke="#ef4444"
                                        strokeWidth={1}
                                        opacity={0.7}
                                        strokeDasharray="4,4"
                                        vectorEffect="non-scaling-stroke"
                                    />
                                    {/* Vertical guide (green) from current point */}
                                    <line
                                        x1={previewPoint.x}
                                        y1={previewPoint.y - guideLength}
                                        x2={previewPoint.x}
                                        y2={previewPoint.y + guideLength}
                                        stroke="#22c55e"
                                        strokeWidth={1}
                                        opacity={0.7}
                                        strokeDasharray="4,4"
                                        vectorEffect="non-scaling-stroke"
                                    />
                                </>
                            );
                        })()}

                        {/* Distance measurement */}
                        {(() => {
                            const lastSeg = segments[segments.length - 1];
                            const lastPt = lastSeg.end;
                            const dx = previewPoint.x - lastPt.x;
                            const dy = previewPoint.y - lastPt.y;
                            const length = Math.sqrt(dx * dx + dy * dy);
                            if (length === 0) return null;

                            const midX = (lastPt.x + previewPoint.x) / 2;
                            const midY = (lastPt.y + previewPoint.y) / 2;
                            const dimensionText = length >= 1000
                                ? `${(length / 1000).toFixed(2)} m`
                                : `${length.toFixed(0)} mm`;

                            const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                            const textAngle = angle < -90 || angle > 90 ? angle + 180 : angle;

                            return (
                                <g transform={`translate(${midX}, ${midY}) rotate(${textAngle})`}>
                                    <rect
                                        x={-dimensionText.length * 3 - 4}
                                        y={-8}
                                        width={dimensionText.length * 6 + 8}
                                        height={16}
                                        fill="white"
                                        stroke="#3b82f6"
                                        strokeWidth={1 / zoom}
                                        rx={2 / zoom}
                                        opacity={0.95}
                                        vectorEffect="non-scaling-stroke"
                                    />
                                    <text
                                        x={0}
                                        y={4 / zoom}
                                        fill="#1f2937"
                                        fontSize={11 / zoom}
                                        fontWeight="600"
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                    >
                                        {dimensionText}
                                    </text>
                                </g>
                            );
                        })()}

                        {/* Preview line segments */}
                        {segments.map((seg, i) => (
                            <line
                                key={i}
                                x1={seg.start.x}
                                y1={seg.start.y}
                                x2={seg.end.x}
                                y2={seg.end.y}
                                stroke="#3b82f6"
                                strokeWidth={5}
                                opacity={0.6}
                                vectorEffect="non-scaling-stroke"
                            />
                        ))}
                        <line
                            x1={segments[segments.length - 1].end.x}
                            y1={segments[segments.length - 1].end.y}
                            x2={previewPoint.x}
                            y2={previewPoint.y}
                            stroke="#3b82f6"
                            strokeWidth={5}
                            strokeDasharray="5,5"
                            opacity={0.6}
                            vectorEffect="non-scaling-stroke"
                        />

                        {/* Snap circle at start point */}
                        {segments.length > 0 && (
                            <circle
                                cx={segments[0].start.x}
                                cy={segments[0].start.y}
                                r={12}
                                fill={isSnappingToStart ? "#22c55e" : "white"}
                                stroke={isSnappingToStart ? "#ffffff" : "#3b82f6"}
                                strokeWidth={3}
                                style={{ opacity: isSnappingToStart ? 1 : 0.8 }}
                            />
                        )}
                    </>
                )}

                {/* Snap Indicator */}
                {snapIndicator && (
                    <g pointerEvents="none">
                        <circle
                            cx={snapIndicator.x}
                            cy={snapIndicator.y}
                            r={8}
                            fill="none"
                            stroke="#f59e0b" // Amber-500
                            strokeWidth={2}
                        />
                        {snapIndicator.type === 'midpoint' && (
                            <path
                                d={`M${snapIndicator.x - 4},${snapIndicator.y - 4} L${snapIndicator.x + 4},${snapIndicator.y + 4} M${snapIndicator.x + 4},${snapIndicator.y - 4} L${snapIndicator.x - 4},${snapIndicator.y + 4}`}
                                stroke="#f59e0b"
                                strokeWidth={1}
                            />
                        )}
                        {snapIndicator.type === 'center' && (
                            <circle
                                cx={snapIndicator.x}
                                cy={snapIndicator.y}
                                r={2}
                                fill="#f59e0b"
                            />
                        )}
                        <text
                            x={snapIndicator.x + 12}
                            y={snapIndicator.y}
                            fill="#f59e0b"
                            fontSize={12}
                            fontWeight="bold"
                            dominantBaseline="middle"
                            style={{ textShadow: '0px 0px 2px white' }}
                        >
                            {snapIndicator.type}
                        </text>
                    </g>
                )}

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


