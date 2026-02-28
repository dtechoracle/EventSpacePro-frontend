"use client";

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { useProjectStore } from '@/store/projectStore';

interface FreehandToolProps {
    isActive: boolean;
}

const SNAP_CLOSE_RADIUS_PX = 16; // pixels on screen — snap indicator radius

export default function FreehandTool({ isActive }: FreehandToolProps) {
    const { screenToWorld, setActiveTool, setSelectedIds, zoom } = useEditorStore();
    const { addShape } = useProjectStore();

    const [points, setPoints] = useState<{ x: number; y: number }[]>([]);
    const [isDrawing, setIsDrawing] = useState(false);
    const [nearClose, setNearClose] = useState(false); // hovering close to start point
    const [currentMouse, setCurrentMouse] = useState<{ x: number; y: number } | null>(null);
    const pointsRef = useRef<{ x: number; y: number }[]>([]);

    // Keep ref in sync so callbacks always have the latest points
    useEffect(() => { pointsRef.current = points; }, [points]);

    const isNearStart = useCallback((worldPos: { x: number; y: number }) => {
        const pts = pointsRef.current;
        if (pts.length < 3) return false;
        const start = pts[0];
        const screenDist = Math.hypot(worldPos.x - start.x, worldPos.y - start.y) * zoom;
        return screenDist < SNAP_CLOSE_RADIUS_PX;
    }, [zoom]);

    const handleMouseDown = useCallback((e: MouseEvent) => {
        if (!isActive || e.button !== 0) return;
        const worldPos = screenToWorld(e.clientX, e.clientY);
        setPoints([worldPos]);
        pointsRef.current = [worldPos];
        setIsDrawing(true);
        setNearClose(false);
    }, [isActive, screenToWorld]);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isActive) return;
        const worldPos = screenToWorld(e.clientX, e.clientY);
        setCurrentMouse(worldPos);

        if (!isDrawing) return;

        // Check proximity to start for close-path snap
        setNearClose(isNearStart(worldPos));

        // Add point if far enough from last
        setPoints(prev => {
            const last = prev[prev.length - 1];
            const dist = Math.hypot(worldPos.x - last.x, worldPos.y - last.y);
            if (dist > 3) {
                const next = [...prev, worldPos];
                pointsRef.current = next;
                return next;
            }
            return prev;
        });
    }, [isActive, isDrawing, screenToWorld, isNearStart]);

    const finishShape = useCallback((closePath: boolean) => {
        const pts = pointsRef.current;
        if (pts.length < 2) {
            setPoints([]);
            setIsDrawing(false);
            setNearClose(false);
            setCurrentMouse(null);
            return;
        }

        const usedPoints = closePath
            ? [...pts, pts[0]] // close: append start to end
            : pts;

        const xs = usedPoints.map(p => p.x);
        const ys = usedPoints.map(p => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const width = maxX - minX || 1;
        const height = maxY - minY || 1;
        const centerX = minX + width / 2;
        const centerY = minY + height / 2;

        const relativePoints = usedPoints.map(p => ({
            x: p.x - centerX,
            y: p.y - centerY,
        }));

        const newShape = {
            id: `freehand-${Date.now()}`,
            type: 'freehand' as const,
            x: centerX,
            y: centerY,
            width,
            height,
            rotation: 0,
            stroke: '#000000',
            strokeWidth: 3,
            // If path is closed, apply a light fill; otherwise transparent
            fill: 'transparent',
            fillType: 'color' as const,
            points: relativePoints,
            zIndex: useProjectStore.getState().getNextZIndex(),
        };

        addShape(newShape);
        setSelectedIds([newShape.id]);

        setPoints([]);
        pointsRef.current = [];
        setIsDrawing(false);
        setNearClose(false);
        setCurrentMouse(null);
        setActiveTool('select');
    }, [addShape, setSelectedIds, setActiveTool]);

    const handleMouseUp = useCallback((e: MouseEvent) => {
        if (!isActive || !isDrawing) return;
        const worldPos = screenToWorld(e.clientX, e.clientY);
        const closePath = isNearStart(worldPos);
        finishShape(closePath);
    }, [isActive, isDrawing, screenToWorld, isNearStart, finishShape]);

    // Escape key cancels drawing
    useEffect(() => {
        if (!isActive) return;
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isDrawing) {
                setPoints([]);
                pointsRef.current = [];
                setIsDrawing(false);
                setNearClose(false);
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [isActive, isDrawing]);

    useEffect(() => {
        if (!isActive) return;
        window.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isActive, handleMouseDown, handleMouseMove, handleMouseUp]);

    // Reset when tool deactivated
    useEffect(() => {
        if (!isActive) {
            setPoints([]);
            pointsRef.current = [];
            setIsDrawing(false);
            setNearClose(false);
            setCurrentMouse(null);
        }
    }, [isActive]);

    if (!isActive || points.length < 1) return null;

    const pathData = points.length >= 2
        ? `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ')
        : null;

    return (
        <g style={{ pointerEvents: 'none' }}>
            {/* Live path stroke */}
            {pathData && (
                <path
                    d={pathData}
                    fill={nearClose ? 'rgba(100,149,237,0.12)' : 'none'}
                    stroke={nearClose ? '#3b82f6' : '#111827'}
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.85}
                />
            )}

            {/* Start point anchor dot */}
            {points.length > 0 && (
                <circle
                    cx={points[0].x}
                    cy={points[0].y}
                    r={SNAP_CLOSE_RADIUS_PX / zoom}
                    fill={nearClose ? '#3b82f6' : 'white'}
                    stroke={nearClose ? '#2563eb' : '#3b82f6'}
                    strokeWidth={2 / zoom}
                    opacity={0.9}
                />
            )}

            {/* Current mouse cursor dot */}
            {currentMouse && isDrawing && (
                <circle
                    cx={currentMouse.x}
                    cy={currentMouse.y}
                    r={4 / zoom}
                    fill={nearClose ? '#3b82f6' : '#111827'}
                    opacity={0.7}
                />
            )}

            {/* Close-path hint label */}
            {nearClose && points.length > 2 && currentMouse && (
                <text
                    x={points[0].x}
                    y={points[0].y - (20 / zoom)}
                    fontSize={12 / zoom}
                    fill="#3b82f6"
                    textAnchor="middle"
                    fontFamily="system-ui, sans-serif"
                    fontWeight="600"
                >
                    Close path
                </text>
            )}
        </g>
    );
}
