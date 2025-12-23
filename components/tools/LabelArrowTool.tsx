"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { useProjectStore, LabelArrow } from '@/store/projectStore';

interface LabelArrowToolProps {
    isActive: boolean;
}

export default function LabelArrowTool({ isActive }: LabelArrowToolProps) {
    const { screenToWorld, setActiveTool, setSelectedIds } = useEditorStore();
    const { addLabelArrow, getNextZIndex } = useProjectStore();

    const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
    const [endPoint, setEndPoint] = useState<{ x: number; y: number } | null>(null);
    const [currentMousePos, setCurrentMousePos] = useState<{ x: number; y: number } | null>(null);
    const [label, setLabel] = useState<string>('');
    const [isEnteringLabel, setIsEnteringLabel] = useState(false);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isActive) return;
        const worldPos = screenToWorld(e.clientX, e.clientY);
        setCurrentMousePos(worldPos);
    }, [isActive, screenToWorld]);

    const handleClick = useCallback((e: MouseEvent) => {
        if (!isActive) return;
        const worldPos = screenToWorld(e.clientX, e.clientY);

        if (!startPoint) {
            setStartPoint(worldPos);
        } else if (!endPoint) {
            setEndPoint(worldPos);
            setIsEnteringLabel(true);
            // Focus on input
            setTimeout(() => {
                const input = document.getElementById('label-arrow-input');
                if (input) {
                    (input as HTMLInputElement).focus();
                }
            }, 100);
        }
    }, [isActive, screenToWorld, startPoint, endPoint]);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (!isActive || !isEnteringLabel) return;
        
        if (e.key === 'Enter' && label.trim()) {
            finishArrow();
        } else if (e.key === 'Escape') {
            cancelArrow();
        }
    }, [isActive, isEnteringLabel, label]);

    const finishArrow = useCallback(() => {
        if (!startPoint || !endPoint || !label.trim()) return;

        const newArrow: LabelArrow = {
            id: `label-arrow-${Date.now()}`,
            startPoint,
            endPoint,
            label: label.trim(),
            fontSize: 14,
            color: '#000000',
            strokeWidth: 2,
            zIndex: getNextZIndex(),
        };

        addLabelArrow(newArrow);
        setSelectedIds([newArrow.id]);
        setActiveTool('select');

        // Reset
        setStartPoint(null);
        setEndPoint(null);
        setCurrentMousePos(null);
        setLabel('');
        setIsEnteringLabel(false);
    }, [startPoint, endPoint, label, addLabelArrow, getNextZIndex, setSelectedIds, setActiveTool]);

    const cancelArrow = useCallback(() => {
        setStartPoint(null);
        setEndPoint(null);
        setCurrentMousePos(null);
        setLabel('');
        setIsEnteringLabel(false);
    }, []);

    useEffect(() => {
        if (isActive) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('click', handleClick);
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('click', handleClick);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isActive, handleMouseMove, handleClick, handleKeyDown]);

    // Render preview
    if (!isActive || !startPoint) return null;

    const previewEnd = endPoint || currentMousePos;
    if (!previewEnd) return null;

    const dx = previewEnd.x - startPoint.x;
    const dy = previewEnd.y - startPoint.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);

    // Arrow head
    const arrowHeadSize = 10;
    const arrowAngle = angle * (Math.PI / 180);
    const arrowX = previewEnd.x - Math.cos(arrowAngle) * arrowHeadSize;
    const arrowY = previewEnd.y - Math.sin(arrowAngle) * arrowHeadSize;
    const perpX = -Math.sin(arrowAngle) * (arrowHeadSize / 2);
    const perpY = Math.cos(arrowAngle) * (arrowHeadSize / 2);

    return (
        <g>
            {/* Arrow line */}
            <line
                x1={startPoint.x}
                y1={startPoint.y}
                x2={arrowX}
                y2={arrowY}
                stroke="#3b82f6"
                strokeWidth={2}
                strokeLinecap="round"
            />
            {/* Arrow head */}
            <polygon
                points={`${previewEnd.x},${previewEnd.y} ${arrowX + perpX},${arrowY + perpY} ${arrowX - perpX},${arrowY - perpY}`}
                fill="#3b82f6"
                stroke="#3b82f6"
            />
            {/* Label input */}
            {isEnteringLabel && endPoint && (
                <foreignObject
                    x={endPoint.x + 10}
                    y={endPoint.y - 20}
                    width="200"
                    height="30"
                >
                    <input
                        id="label-arrow-input"
                        type="text"
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                        onBlur={finishArrow}
                        className="px-2 py-1 border border-blue-500 rounded text-sm"
                        style={{ outline: 'none' }}
                        autoFocus
                    />
                </foreignObject>
            )}
        </g>
    );
}

