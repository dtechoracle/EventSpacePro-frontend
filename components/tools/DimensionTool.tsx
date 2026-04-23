import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { useSceneStore } from '@/store/sceneStore';
import { useProjectStore, Dimension } from '@/store/projectStore';
import { DimensionRenderer } from '../renderers/DimensionRenderer';
import { findSnapPointInShapes } from '@/utils/snapToDrawing';
import { ASSET_LIBRARY } from '@/lib/assets';

interface DimensionToolProps {
    isActive: boolean;
}

const marqueeAssetTypes = new Set(
    ASSET_LIBRARY
        .filter((asset) => asset.category === 'Marquee')
        .map((asset) => asset.id)
);

export default function DimensionTool({ isActive }: DimensionToolProps) {
    const { canvasOffset, zoom, panX, panY, dimensionType } = useEditorStore();
    const { snapToGridEnabled, gridSize } = useSceneStore();
    const addDimension = useProjectStore(s => s.addDimension);
    const getNextZIndex = useProjectStore(s => s.getNextZIndex);
    const shapes = useProjectStore(s => s.shapes);
    const walls = useProjectStore(s => s.walls);
    const assets = useProjectStore(s => s.assets);
    const marqueeAssets = useMemo(
        () => assets.filter(asset => marqueeAssetTypes.has(asset.type)),
        [assets]
    );

    const [step, setStep] = useState<0 | 1 | 2>(0);
    const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
    const [endPoint, setEndPoint] = useState<{ x: number; y: number } | null>(null);
    const [startTargetId, setStartTargetId] = useState<string | null>(null);
    const [endTargetId, setEndTargetId] = useState<string | null>(null);
    const [centerPoint, setCenterPoint] = useState<{ x: number; y: number } | null>(null);
    const [currentMousePos, setCurrentMousePos] = useState<{ x: number; y: number } | null>(null);

    // Reset state when tool becomes inactive or mode changes
    useEffect(() => {
        if (!isActive) {
            setStep(0);
            setStartPoint(null);
            setEndPoint(null);
            setStartTargetId(null);
            setEndTargetId(null);
            setCenterPoint(null);
            setCurrentMousePos(null);
        }
    }, [isActive, dimensionType]);

    // Screen to world conversion
    const screenToWorld = useCallback((screenX: number, screenY: number) => {
        const x = screenX - canvasOffset.left;
        const y = screenY - canvasOffset.top;
        return {
            x: (x - panX) / zoom,
            y: (y - panY) / zoom,
        };
    }, [canvasOffset, zoom, panX, panY]);

    const getSnapInfo = useCallback((pos: { x: number; y: number }) => {
        // 1. Smart Snapping (Objects)
        const { snapToObjects } = useEditorStore.getState();
        if (snapToObjects) {
            const allElements = [...shapes, ...walls, ...marqueeAssets];
            const snapResult = findSnapPointInShapes(pos, allElements, 20 / zoom);
            if (snapResult) {
                return { point: { x: snapResult.x, y: snapResult.y }, elementId: snapResult.elementId };
            }
        }

        // 2. Grid Snapping
        if (!snapToGridEnabled) return { point: pos, elementId: null };
        return {
            point: {
                x: Math.round(pos.x / gridSize) * gridSize,
                y: Math.round(pos.y / gridSize) * gridSize,
            },
            elementId: null,
        };
    }, [snapToGridEnabled, gridSize, zoom, shapes, walls, marqueeAssets]);

    const getSnappedPos = useCallback((pos: { x: number; y: number }) => getSnapInfo(pos).point, [getSnapInfo]);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isActive) return;

        const worldPos = screenToWorld(e.clientX, e.clientY);
        const snapped = getSnappedPos(worldPos);
        setCurrentMousePos(snapped);
    }, [isActive, screenToWorld, getSnappedPos]);

    const handleClick = useCallback((e: MouseEvent) => {
        if (!isActive) return;

        const target = e.target as Element | null;
        if (!target || !target.closest('svg[data-workspace-root="true"]')) {
            return;
        }

        const worldPos = screenToWorld(e.clientX, e.clientY);
        const snapInfo = getSnapInfo(worldPos);
        const snapped = snapInfo.point;

        const mode = dimensionType;

        if (mode === 'linear') {
            if (step === 0) {
                setStartPoint(snapped);
                setStartTargetId(snapInfo.elementId);
                setStep(1);
            } else if (step === 1) {
                setEndPoint(snapped);
                setEndTargetId(snapInfo.elementId);
                setStep(2);
            } else if (step === 2) {
                // Finalize Linear
                if (startPoint && endPoint) {
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

                        addDimension({
                            id: crypto.randomUUID(),
                            type: 'linear',
                            startPoint,
                            endPoint,
                            targetIds: Array.from(new Set([startTargetId, endTargetId].filter((id): id is string => Boolean(id)))),
                            offset,
                            zIndex: getNextZIndex(),
                            strokeWidth: 1.5,
                            color: '#000000',
                            fontSize: 18,
                            fontFamily: 'Inter, sans-serif',
                        });
                    }
                }
                setStep(0);
                setStartPoint(null);
                setEndPoint(null);
                setStartTargetId(null);
                setEndTargetId(null);
                setCurrentMousePos(null);
                useEditorStore.getState().setActiveTool('select');
            }
        } else if (mode === 'angular') {
            // Step 0: Center/Vertex
            // Step 1: Start Point (Ray 1)
            // Step 2: End Point (Ray 2) -> Finish
            if (step === 0) {
                setCenterPoint(snapped);
                setStep(1);
            } else if (step === 1) {
                setStartPoint(snapped);
                setStep(2);
            } else if (step === 2) {
                if (centerPoint && startPoint) {
                    // Use snapped as endPoint
                    // Offset (Radius) is determined by distance from center to endPoint
                    const radius = Math.hypot(snapped.x - centerPoint.x, snapped.y - centerPoint.y);
                    addDimension({
                        id: crypto.randomUUID(),
                        type: 'angular',
                        centerPoint,
                        startPoint,
                        endPoint: snapped,
                        offset: radius, // Radius
                        zIndex: getNextZIndex(),
                        strokeWidth: 1.5,
                        color: '#000000',
                        fontSize: 18,
                        fontFamily: 'Inter, sans-serif',
                    });
                }
                setStep(0);
                setCenterPoint(null);
                setStartPoint(null);
                setEndPoint(null);
                setCurrentMousePos(null);
                useEditorStore.getState().setActiveTool('select');
            }
        } else if (mode === 'radial') {
            // Step 0: Center
            // Step 1: Radius Point -> Finish
            if (step === 0) {
                setCenterPoint(snapped);
                setStep(1);
            } else if (step === 1) {
                if (centerPoint) {
                    // snapped is endPoint (on circle)
                    const radius = Math.hypot(snapped.x - centerPoint.x, snapped.y - centerPoint.y);
                    addDimension({
                        id: crypto.randomUUID(),
                        type: 'radial',
                        centerPoint,
                        startPoint: centerPoint, // redundant but safe
                        endPoint: snapped, // Point on circle
                        offset: 0,
                        value: Math.round(radius),
                        zIndex: getNextZIndex(),
                        strokeWidth: 1.5,
                        color: '#000000',
                        fontSize: 18,
                        fontFamily: 'Inter, sans-serif',
                    });
                }
                setStep(0);
                setCenterPoint(null);
                setStartPoint(null);
                setEndPoint(null);
                setCurrentMousePos(null);
                useEditorStore.getState().setActiveTool('select');
            }
        }

    }, [isActive, step, dimensionType, screenToWorld, getSnapInfo, startPoint, endPoint, centerPoint, startTargetId, endTargetId, addDimension, getNextZIndex]);

    // Attach listeners
    useEffect(() => {
        if (isActive) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('click', handleClick);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('click', handleClick);
        };
    }, [isActive, handleMouseMove, handleClick]);


    // Render Preview
    if (!isActive || !currentMousePos) return null;

    let previewDimension: Dimension | null = null;
    const mode = dimensionType;

    if (mode === 'linear') {
        if (step === 1 && startPoint) {
            // Line Start->Mouse
            previewDimension = {
                id: 'preview',
                type: 'linear',
                startPoint,
                endPoint: currentMousePos,
                offset: 0,
                zIndex: 9999,
            };
        } else if (step === 2 && startPoint && endPoint) {
            // Full Preview with Offset
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
                startPoint,
                endPoint,
                offset,
                zIndex: 9999,
            };
        }
    } else if (mode === 'angular') {
        if (step === 1 && centerPoint) {
            // Line Center->Mouse
            // Use linear visualization for the ray
            previewDimension = {
                id: 'preview-ray1',
                type: 'linear',
                startPoint: centerPoint,
                endPoint: currentMousePos,
                offset: 0,
                zIndex: 9999
            };
        } else if (step === 2 && centerPoint && startPoint) {
            // Preview Arc
            const radius = Math.hypot(currentMousePos.x - centerPoint.x, currentMousePos.y - centerPoint.y);
            previewDimension = {
                id: 'preview',
                type: 'angular',
                centerPoint,
                startPoint, // Ray 1 direction
                endPoint: currentMousePos, // Ray 2 direction
                offset: radius,
                zIndex: 9999
            };
        }
    } else if (mode === 'radial') {
        if (step === 1 && centerPoint) {
            // Preview Radial
            const radius = Math.hypot(currentMousePos.x - centerPoint.x, currentMousePos.y - centerPoint.y);
            previewDimension = {
                id: 'preview',
                type: 'radial',
                centerPoint,
                startPoint: centerPoint,
                endPoint: currentMousePos,
                offset: 0,
                value: Math.round(radius),
                zIndex: 9999
            };
        }
    }

    if (!previewDimension) return null;

    return (
        <DimensionRenderer dimension={previewDimension} zoom={zoom} />
    );
}
