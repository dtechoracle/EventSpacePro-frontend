"use client";

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { useProjectStore, LabelArrow } from '@/store/projectStore';
import LabelArrowRenderer from '../renderers/LabelArrowRenderer';

interface LabelArrowToolProps {
    isActive: boolean;
}

export default function LabelArrowTool({ isActive }: LabelArrowToolProps) {
    const { screenToWorld, setActiveTool, setSelectedIds, zoom } = useEditorStore();
    const addLabelArrow = useProjectStore(s => s.addLabelArrow);
    const getNextZIndex = useProjectStore(s => s.getNextZIndex);

    const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
    const [endPoint, setEndPoint] = useState<{ x: number; y: number } | null>(null);
    const [currentMousePos, setCurrentMousePos] = useState<{ x: number; y: number } | null>(null);
    const [label, setLabel] = useState<string>('');
    const [isEnteringLabel, setIsEnteringLabel] = useState(false);
    const activatedAtRef = useRef(0);

    const isWorkspaceClick = (target: EventTarget | null) => {
        return target instanceof Element && Boolean(target.closest('[data-workspace-root="true"]'));
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isActive) return;
        const worldPos = screenToWorld(e.clientX, e.clientY);
        setCurrentMousePos(worldPos);
    }, [isActive, screenToWorld]);

    const handleClick = useCallback((e: MouseEvent) => {
        if (!isActive) return;
        if (Date.now() - activatedAtRef.current < 180) return;
        if (!isWorkspaceClick(e.target)) return;
        if (isEnteringLabel) return;

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
    }, [isActive, isEnteringLabel, screenToWorld, startPoint, endPoint]);

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
            fontSize: 16,
            fontFamily: 'Inter, sans-serif',
            color: '#000000',
            strokeWidth: 3,
            arrowHeadType: 'filled-triangle',
            arrowTailType: 'none',
            textPosition: 'bottom',
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
            activatedAtRef.current = Date.now();
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('click', handleClick);
            window.addEventListener('keydown', handleKeyDown);
        } else {
            activatedAtRef.current = 0;
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
    const len = Math.max(0.01, Math.hypot(dx, dy));
    const safeZoom = Math.max(zoom, 0.01);
    const inputT = 0.14; // Default label position is "bottom", meaning the tail/start of the arrow.
    const inputX = startPoint.x + dx * inputT;
    const inputY = startPoint.y + dy * inputT;

    const previewArrow: LabelArrow = {
        id: 'label-arrow-preview',
        startPoint,
        endPoint: previewEnd,
        label: label || 'Label',
        fontSize: 16,
        fontFamily: 'Inter, sans-serif',
        color: '#3b82f6',
        strokeWidth: 3,
        arrowHeadType: 'filled-triangle',
        arrowTailType: 'none',
        textPosition: 'bottom',
        zIndex: 9999,
    };

    return (
        <g>
            <LabelArrowRenderer arrow={previewArrow} zoom={zoom} />
            {/* Label input */}
            {isEnteringLabel && endPoint && (
                <foreignObject
                    x={inputX - (150 / safeZoom)}
                    y={inputY - (22 / safeZoom)}
                    width={300 / safeZoom}
                    height={48 / safeZoom}
                >
                    <input
                        id="label-arrow-input"
                        type="text"
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                        onBlur={finishArrow}
                        className="border border-blue-500 rounded bg-white shadow"
                        style={{
                            outline: 'none',
                            width: `${300 / safeZoom}px`,
                            height: `${40 / safeZoom}px`,
                            fontSize: `${15 / safeZoom}px`,
                            padding: `${6 / safeZoom}px ${10 / safeZoom}px`,
                        }}
                        autoFocus
                    />
                </foreignObject>
            )}
        </g>
    );
}

