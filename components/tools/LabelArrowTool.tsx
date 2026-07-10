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

    // Refs to always access latest values inside callbacks (avoids stale closures)
    const labelRef = useRef(label);
    labelRef.current = label;
    const startPointRef = useRef(startPoint);
    startPointRef.current = startPoint;
    const endPointRef = useRef(endPoint);
    endPointRef.current = endPoint;
    const isEnteringLabelRef = useRef(isEnteringLabel);
    isEnteringLabelRef.current = isEnteringLabel;

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
        if (isEnteringLabelRef.current) return;

        const worldPos = screenToWorld(e.clientX, e.clientY);

        if (!startPointRef.current) {
            setStartPoint(worldPos);
        } else if (!endPointRef.current) {
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
    }, [isActive, screenToWorld]);

    const resetState = useCallback(() => {
        setStartPoint(null);
        setEndPoint(null);
        setCurrentMousePos(null);
        setLabel('');
        setIsEnteringLabel(false);
    }, []);

    const finishArrow = useCallback(() => {
        const currentLabel = labelRef.current;
        const currentStart = startPointRef.current;
        const currentEnd = endPointRef.current;

        if (!currentStart || !currentEnd || !currentLabel.trim()) return;

        const newArrow: LabelArrow = {
            id: `label-arrow-${Date.now()}`,
            startPoint: currentStart,
            endPoint: currentEnd,
            label: currentLabel.trim(),
            fontSize: 120,
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
        resetState();
    }, [addLabelArrow, getNextZIndex, setSelectedIds, setActiveTool, resetState]);

    const cancelArrow = useCallback(() => {
        resetState();
    }, [resetState]);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (!isActive || !isEnteringLabelRef.current) return;
        
        if (e.key === 'Enter' && labelRef.current.trim()) {
            e.preventDefault();
            finishArrow();
        } else if (e.key === 'Escape') {
            cancelArrow();
        }
    }, [isActive, finishArrow, cancelArrow]);

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
        fontSize: 120,
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
                        onBlur={() => {
                            // Use a small timeout so clicking Enter doesn't race with blur
                            setTimeout(() => {
                                if (labelRef.current.trim()) {
                                    finishArrow();
                                }
                            }, 150);
                        }}
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
