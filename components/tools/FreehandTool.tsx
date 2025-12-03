"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { useProjectStore } from '@/store/projectStore';

interface FreehandToolProps {
    isActive: boolean;
}

export default function FreehandTool({ isActive }: FreehandToolProps) {
    const { screenToWorld, setActiveTool, setSelectedIds } = useEditorStore();
    const { addShape } = useProjectStore();

    const [points, setPoints] = useState<{ x: number; y: number }[]>([]);
    const [isDrawing, setIsDrawing] = useState(false);

    // Handle mouse down to start drawing
    const handleMouseDown = useCallback((e: MouseEvent) => {
        if (!isActive) return;

        const worldPos = screenToWorld(e.clientX, e.clientY);
        setPoints([worldPos]);
        setIsDrawing(true);
    }, [isActive, screenToWorld]);

    // Handle mouse move to add points
    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isActive || !isDrawing) return;

        const worldPos = screenToWorld(e.clientX, e.clientY);

        // Add point if it's far enough from the last point (simple smoothing)
        setPoints(prev => {
            const lastPoint = prev[prev.length - 1];
            const dist = Math.hypot(worldPos.x - lastPoint.x, worldPos.y - lastPoint.y);
            if (dist > 2) { // 2mm minimum distance
                return [...prev, worldPos];
            }
            return prev;
        });
    }, [isActive, isDrawing, screenToWorld]);

    // Handle mouse up to finish drawing
    const handleMouseUp = useCallback(() => {
        if (!isActive || !isDrawing) return;

        if (points.length > 1) {
            // Calculate bounding box
            const xs = points.map(p => p.x);
            const ys = points.map(p => p.y);
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);
            const width = maxX - minX;
            const height = maxY - minY;
            const centerX = minX + width / 2;
            const centerY = minY + height / 2;

            // Normalize points relative to center
            const relativePoints = points.map(p => ({
                x: p.x - centerX,
                y: p.y - centerY
            }));

            const newShape = {
                id: `freehand-${Date.now()}`,
                type: 'freehand' as const,
                x: centerX,
                y: centerY,
                width: width || 1, // Prevent 0 dimensions
                height: height || 1,
                rotation: 0,
                stroke: '#000000',
                strokeWidth: 2,
                fill: 'transparent',
                points: relativePoints,
                zIndex: useProjectStore.getState().getNextZIndex(),
            };

            addShape(newShape);
            setSelectedIds([newShape.id]);

            // Reset
            setPoints([]);
            setIsDrawing(false);
            setActiveTool('select'); // Switch back to select tool
        } else {
            setPoints([]);
            setIsDrawing(false);
        }
    }, [isActive, isDrawing, points, addShape, setSelectedIds, setActiveTool]);

    // Attach global event listeners
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

    if (!isActive || points.length < 2) return null;

    // Render preview path
    const pathData = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');

    return (
        <path
            d={pathData}
            fill="none"
            stroke="#3b82f6"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.7}
            style={{ pointerEvents: 'none' }}
        />
    );
}
