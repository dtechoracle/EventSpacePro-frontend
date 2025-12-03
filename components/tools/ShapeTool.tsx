"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { useProjectStore, Shape } from '@/store/projectStore';

interface ShapeToolProps {
    isActive: boolean;
    shapeType: 'rectangle' | 'ellipse' | 'line' | 'arrow';
}

export default function ShapeTool({ isActive, shapeType }: ShapeToolProps) {
    const { screenToWorld, snapToGrid, gridSize, setSelectedIds, setActiveTool } = useEditorStore();
    const { addShape, getNextZIndex } = useProjectStore();

    const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
    const [endPoint, setEndPoint] = useState<{ x: number; y: number } | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    // Handle mouse down to start drawing
    const handleMouseDown = useCallback((e: MouseEvent) => {
        if (!isActive || e.button !== 0) return;

        const worldPos = screenToWorld(e.clientX, e.clientY);
        const snapped = snapToGrid
            ? { x: Math.round(worldPos.x / gridSize) * gridSize, y: Math.round(worldPos.y / gridSize) * gridSize }
            : worldPos;

        setStartPoint(snapped);
        setEndPoint(snapped);
        setIsDrawing(true);
    }, [isActive, screenToWorld, snapToGrid, gridSize]);

    // Handle mouse move for preview
    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isActive || !isDrawing || !startPoint) return;

        const worldPos = screenToWorld(e.clientX, e.clientY);
        const snapped = snapToGrid
            ? { x: Math.round(worldPos.x / gridSize) * gridSize, y: Math.round(worldPos.y / gridSize) * gridSize }
            : worldPos;

        setEndPoint(snapped);
    }, [isActive, isDrawing, startPoint, screenToWorld, snapToGrid, gridSize]);

    // Handle mouse up to finish drawing
    const handleMouseUp = useCallback(() => {
        if (!isActive || !isDrawing || !startPoint || !endPoint) return;

        const width = Math.abs(endPoint.x - startPoint.x);
        const height = Math.abs(endPoint.y - startPoint.y);

        // Minimum size check - for lines/arrows, allow zero width or height (vertical/horizontal lines)
        if (shapeType === 'line' || shapeType === 'arrow') {
            // For lines, check total distance
            const distance = Math.sqrt(width * width + height * height);
            if (distance < 5) {
                setStartPoint(null);
                setEndPoint(null);
                setIsDrawing(false);
                return;
            }
        } else {
            // For rectangles and ellipses, both dimensions must be > 5
            if (width < 5 || height < 5) {
                setStartPoint(null);
                setEndPoint(null);
                setIsDrawing(false);
                return;
            }
        }

        const centerX = (startPoint.x + endPoint.x) / 2;
        const centerY = (startPoint.y + endPoint.y) / 2;

        let rotation = 0;
        let finalWidth = width;
        let finalHeight = height;

        // For lines and arrows, calculate rotation and use width as length
        if (shapeType === 'line' || shapeType === 'arrow') {
            const dx = endPoint.x - startPoint.x;
            const dy = endPoint.y - startPoint.y;
            rotation = Math.atan2(dy, dx) * (180 / Math.PI);
            finalWidth = Math.sqrt(dx * dx + dy * dy);
            finalHeight = 2; // Line thickness
        }

        const newShape: Shape = {
            id: `shape-${Date.now()}`,
            type: shapeType,
            x: centerX,
            y: centerY,
            width: finalWidth,
            height: finalHeight,
            rotation,
            fill: 'transparent',
            stroke: '#1f2937',
            strokeWidth: 2,
            zIndex: getNextZIndex(),
        };

        addShape(newShape);

        // Auto-select the newly created shape and switch to select tool
        setSelectedIds([newShape.id]);
        setActiveTool('select');

        setStartPoint(null);
        setEndPoint(null);
        setIsDrawing(false);
    }, [isActive, isDrawing, startPoint, endPoint, shapeType, addShape, getNextZIndex, setSelectedIds, setActiveTool]);

    // Attach event listeners
    useEffect(() => {
        if (!isActive) {
            setStartPoint(null);
            setEndPoint(null);
            setIsDrawing(false);
            return;
        }

        window.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isActive, handleMouseDown, handleMouseMove, handleMouseUp]);

    if (!isActive || !isDrawing || !startPoint || !endPoint) return null;

    // Calculate preview dimensions
    const width = Math.abs(endPoint.x - startPoint.x);
    const height = Math.abs(endPoint.y - startPoint.y);
    const centerX = (startPoint.x + endPoint.x) / 2;
    const centerY = (startPoint.y + endPoint.y) / 2;

    return (
        <g className="shape-tool-overlay">
            {shapeType === 'rectangle' && (
                <rect
                    x={centerX - width / 2}
                    y={centerY - height / 2}
                    width={width}
                    height={height}
                    fill="transparent"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    strokeDasharray="5,5"
                    opacity={0.7}
                />
            )}

            {shapeType === 'ellipse' && (
                <ellipse
                    cx={centerX}
                    cy={centerY}
                    rx={width / 2}
                    ry={height / 2}
                    fill="transparent"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    strokeDasharray="5,5"
                    opacity={0.7}
                />
            )}

            {(shapeType === 'line' || shapeType === 'arrow') && (
                <line
                    x1={startPoint.x}
                    y1={startPoint.y}
                    x2={endPoint.x}
                    y2={endPoint.y}
                    stroke="#3b82f6"
                    strokeWidth={2}
                    strokeDasharray="5,5"
                    opacity={0.7}
                />
            )}
        </g>
    );
}
