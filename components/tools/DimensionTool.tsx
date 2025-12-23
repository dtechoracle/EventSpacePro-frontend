import React, { useState, useCallback, useEffect } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { useProjectStore, Dimension } from '@/store/projectStore';
import { DimensionRenderer } from '../renderers/DimensionRenderer';

interface DimensionToolProps {
    isActive: boolean;
}

export default function DimensionTool({ isActive }: DimensionToolProps) {
    const { canvasOffset, zoom, panX, panY, snapToGrid, gridSize } = useEditorStore();
    const { addDimension, getNextZIndex } = useProjectStore();

    const [step, setStep] = useState<0 | 1 | 2>(0);
    const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
    const [endPoint, setEndPoint] = useState<{ x: number; y: number } | null>(null);
    const [currentMousePos, setCurrentMousePos] = useState<{ x: number; y: number } | null>(null);

    // Screen to world conversion
    const screenToWorld = useCallback((screenX: number, screenY: number) => {
        const x = screenX - canvasOffset.left;
        const y = screenY - canvasOffset.top;
        return {
            x: (x - panX) / zoom,
            y: (y - panY) / zoom,
        };
    }, [canvasOffset, zoom, panX, panY]);

    const getSnappedPos = useCallback((pos: { x: number; y: number }) => {
        if (!snapToGrid) return pos;
        return {
            x: Math.round(pos.x / gridSize) * gridSize,
            y: Math.round(pos.y / gridSize) * gridSize,
        };
    }, [snapToGrid, gridSize]);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isActive) return;

        const worldPos = screenToWorld(e.clientX, e.clientY);
        const snapped = getSnappedPos(worldPos);
        setCurrentMousePos(snapped);
    }, [isActive, screenToWorld, getSnappedPos]);

    const handleClick = useCallback((e: MouseEvent) => {
        if (!isActive) return;
        
        // Only handle clicks on the workspace SVG, not window-wide
        const target = e.target as Element | null;
        if (!target || !target.closest('svg[data-workspace-root="true"]')) {
            return;
        }

        const worldPos = screenToWorld(e.clientX, e.clientY);
        const snapped = getSnappedPos(worldPos);

        if (step === 0) {
            setStartPoint(snapped);
            setStep(1);
        } else if (step === 1) {
            setEndPoint(snapped);
            setStep(2);
        } else if (step === 2) {
            // Finalize
            if (startPoint && endPoint) {
                // Calculate offset
                // Vector from start to end
                const dx = endPoint.x - startPoint.x;
                const dy = endPoint.y - startPoint.y;
                const length = Math.sqrt(dx * dx + dy * dy);

                if (length > 0) {
                    // Normalized direction
                    const nx = dx / length;
                    const ny = dy / length;

                    // Perpendicular vector (-ny, nx)
                    const px = -ny;
                    const py = nx;

                    // Vector from start to mouse
                    const mx = snapped.x - startPoint.x;
                    const my = snapped.y - startPoint.y;

                    // Project mouse vector onto perpendicular vector to get offset
                    // Dot product
                    const offset = mx * px + my * py;

                    const newDimension: Dimension = {
                        id: crypto.randomUUID(),
                        type: 'linear',
                        startPoint,
                        endPoint,
                        offset,
                        zIndex: getNextZIndex(),
                    };

                    addDimension(newDimension);
                }
            }

            // Reset and switch to select tool
            setStep(0);
            setStartPoint(null);
            setEndPoint(null);
            setCurrentMousePos(null);
            useEditorStore.getState().setActiveTool('select');
        }
    }, [isActive, step, screenToWorld, getSnappedPos, startPoint, endPoint, addDimension, getNextZIndex]);

    // Handle double-click to finish
    const handleDoubleClick = useCallback((e: MouseEvent) => {
        if (!isActive || step === 0) return;
        const target = e.target as Element | null;
        if (!target || !target.closest('svg[data-workspace-root="true"]')) {
            return;
        }

        if (step === 2 && startPoint && endPoint) {
            // Finalize dimension on double-click
            const worldPos = screenToWorld(e.clientX, e.clientY);
            const snapped = getSnappedPos(worldPos);
            const dx = endPoint.x - startPoint.x;
            const dy = endPoint.y - startPoint.y;
            const length = Math.sqrt(dx * dx + dy * dy);

            if (length > 0) {
                const nx = dx / length;
                const ny = dy / length;
                const px = -ny;
                const py = nx;
                const mx = snapped.x - startPoint.x;
                const my = snapped.y - startPoint.y;
                const offset = mx * px + my * py;

                const newDimension: Dimension = {
                    id: crypto.randomUUID(),
                    type: 'linear',
                    startPoint,
                    endPoint,
                    offset,
                    zIndex: getNextZIndex(),
                };

                addDimension(newDimension);
            }

            // Reset and switch to select tool
            setStep(0);
            setStartPoint(null);
            setEndPoint(null);
            setCurrentMousePos(null);
            useEditorStore.getState().setActiveTool('select');
        }
    }, [isActive, step, startPoint, endPoint, screenToWorld, getSnappedPos, addDimension, getNextZIndex]);

    // Attach listeners
    useEffect(() => {
        if (isActive) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('click', handleClick);
            window.addEventListener('dblclick', handleDoubleClick);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('click', handleClick);
            window.removeEventListener('dblclick', handleDoubleClick);
        };
    }, [isActive, handleMouseMove, handleClick, handleDoubleClick]);

    // Render preview
    if (!isActive || step === 0 || !startPoint || !currentMousePos) return null;

    let previewDimension: Dimension | null = null;

    if (step === 1) {
        // Drawing the line from start to current mouse
        // We can visualize this as a dimension with 0 offset
        previewDimension = {
            id: 'preview',
            type: 'linear',
            startPoint: startPoint,
            endPoint: currentMousePos,
            offset: 0,
            zIndex: 9999,
        };
    } else if (step === 2 && endPoint) {
        // Setting offset
        // Calculate offset based on current mouse pos
        const dx = endPoint.x - startPoint.x;
        const dy = endPoint.y - startPoint.y;
        const length = Math.sqrt(dx * dx + dy * dy);

        let offset = 0;
        if (length > 0) {
            const nx = dx / length;
            const ny = dy / length;
            const px = -ny;
            const py = nx;
            const mx = currentMousePos.x - startPoint.x;
            const my = currentMousePos.y - startPoint.y;
            offset = mx * px + my * py;
        }

        previewDimension = {
            id: 'preview',
            type: 'linear',
            startPoint: startPoint,
            endPoint: endPoint,
            offset: offset,
            zIndex: 9999,
        };
    }

    if (!previewDimension) return null;

    return (
        <DimensionRenderer dimension={previewDimension} zoom={zoom} />
    );
}
