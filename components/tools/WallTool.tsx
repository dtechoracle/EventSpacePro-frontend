"use client";

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { useProjectStore, WallNode, WallEdge, Wall } from '@/store/projectStore';
import { snapTo90Degrees } from '@/lib/wallGeometry';
import { calculateNodeJunctions, Point } from '@/utils/geometry';
import { findWallIntersection } from '@/utils/wallSplitting';

interface WallToolProps {
    isActive: boolean;
    thickness?: number;
}

export default function WallTool({ isActive, thickness = 150 }: WallToolProps) {
    const { canvasOffset, zoom, panX, panY, snapToGrid, gridSize, setSelectedIds, setActiveTool } = useEditorStore();
    const { addWall, updateWall, getNextZIndex, walls, connectWallToEdge, splitWallEdge } = useProjectStore();

    // Screen to world conversion
    const screenToWorld = useCallback((screenX: number, screenY: number) => {
        const x = screenX - canvasOffset.left;
        const y = screenY - canvasOffset.top;
        return {
            x: (x - panX) / zoom,
            y: (y - panY) / zoom,
        };
    }, [canvasOffset, zoom, panX, panY]);

    // Immediate mode state - track current wall being drawn
    const [currentWallId, setCurrentWallId] = useState<string | null>(null);
    const [lastNodeId, setLastNodeId] = useState<string | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [lastClickTime, setLastClickTime] = useState(0);
    const [previewPoint, setPreviewPoint] = useState<{ x: number; y: number } | null>(null);
    const [junctionTarget, setJunctionTarget] = useState<{
        wallId: string;
        edgeId: string;
        point: { x: number; y: number };
    } | null>(null);

    const SNAP_DISTANCE = 10; // mm
    const JUNCTION_SNAP_THRESHOLD = 15; // mm - threshold for detecting wall edges

    // Get current wall being drawn
    const currentWall = currentWallId ? walls.find(w => w.id === currentWallId) : null;
    const lastNode = lastNodeId && currentWall ? currentWall.nodes.find(n => n.id === lastNodeId) : null;

    // Handle mouse move for preview
    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isActive || !isDrawing) return;

        const worldPos = screenToWorld(e.clientX, e.clientY);
        let snapped = snapToGrid
            ? {
                x: Math.round(worldPos.x / gridSize) * gridSize,
                y: Math.round(worldPos.y / gridSize) * gridSize
            }
            : worldPos;

        // Apply 90-degree snapping if we have a last node
        if (lastNode) {
            snapped = snapTo90Degrees(lastNode, snapped, 6);
        }

        // Check for junction opportunities with existing walls
        const junction = findWallIntersection(snapped, walls, JUNCTION_SNAP_THRESHOLD, currentWallId || undefined);

        if (junction) {
            snapped = junction.point;
            setJunctionTarget(junction);
        } else {
            setJunctionTarget(null);
        }

        // Check if near first node to close loop
        if (currentWall && currentWall.nodes.length > 2) {
            const firstNode = currentWall.nodes[0];
            const dist = Math.hypot(snapped.x - firstNode.x, snapped.y - firstNode.y);

            if (dist < SNAP_DISTANCE) {
                // Near first node - show junction indicator
                setJunctionTarget({
                    wallId: currentWallId!,
                    edgeId: '',
                    point: firstNode,
                });
            }
        }

        // Update preview point for preview line
        setPreviewPoint(snapped);
    }, [isActive, isDrawing, lastNode, screenToWorld, snapToGrid, gridSize, walls, currentWallId, JUNCTION_SNAP_THRESHOLD, currentWall, SNAP_DISTANCE]);

    // Handle click to add node
    const handleClick = useCallback((e: MouseEvent) => {
        if (!isActive) return;

        const now = Date.now();
        const timeSinceLastClick = now - lastClickTime;
        setLastClickTime(now);

        // Double-click to finish wall
        if (timeSinceLastClick < 300 && currentWall && currentWall.nodes.length >= 2) {
            finishWall(false);
            return;
        }

        const worldPos = screenToWorld(e.clientX, e.clientY);
        let snapped = snapToGrid
            ? {
                x: Math.round(worldPos.x / gridSize) * gridSize,
                y: Math.round(worldPos.y / gridSize) * gridSize
            }
            : worldPos;

        // Apply 90-degree snapping if we have a previous node
        if (lastNode) {
            snapped = snapTo90Degrees(lastNode, snapped, 6);
        }

        // Check for junction opportunity
        const junction = findWallIntersection(snapped, walls, JUNCTION_SNAP_THRESHOLD, currentWallId || undefined);

        if (junction) {
            snapped = junction.point;
        }

        // Check for loop closing (only if we have a current wall with 3+ nodes)
        if (currentWall && currentWall.nodes.length > 2) {
            const firstNode = currentWall.nodes[0];
            const dist = Math.hypot(snapped.x - firstNode.x, snapped.y - firstNode.y);

            if (dist < SNAP_DISTANCE) {
                // Close the loop by adding edge from last to first
                const closeEdge: WallEdge = {
                    id: `edge-${Date.now()}-close`,
                    nodeA: lastNodeId!,
                    nodeB: firstNode.id,
                    thickness,
                };
                updateWall(currentWallId!, {
                    edges: [...currentWall!.edges, closeEdge],
                });
                finishWall(true);
                return;
            }
        }

        const newNode: WallNode = {
            id: `node-${Date.now()}-${Math.random()}`,
            x: snapped.x,
            y: snapped.y,
        };

        if (!currentWallId) {
            // FIRST CLICK - Create new wall with single node
            const wallId = `wall-${Date.now()}`;
            const wall: Wall = {
                id: wallId,
                nodes: [newNode],
                edges: [],
                zIndex: getNextZIndex(),
            };

            addWall(wall);
            setCurrentWallId(wallId);
            setLastNodeId(newNode.id);
            setIsDrawing(true);
        } else {
            // SUBSEQUENT CLICKS - Add node and edge to existing wall
            const newEdge: WallEdge = {
                id: `edge-${Date.now()}`,
                nodeA: lastNodeId!,
                nodeB: newNode.id,
                thickness,
            };

            updateWall(currentWallId, {
                nodes: [...currentWall!.nodes, newNode],
                edges: [...currentWall!.edges, newEdge],
            });

            setLastNodeId(newNode.id);

            // Handle junction connection if detected
            if (junction) {
                // Connect this wall to the junction
                connectWallToEdge(
                    currentWallId,
                    newNode.id,
                    junction.wallId,
                    junction.edgeId,
                    junction.point
                );
            }
        }
    }, [isActive, currentWallId, currentWall, lastNode, lastNodeId, screenToWorld, snapToGrid, gridSize, lastClickTime, walls, JUNCTION_SNAP_THRESHOLD, SNAP_DISTANCE, thickness, addWall, updateWall, getNextZIndex, connectWallToEdge]);

    const finishWall = useCallback((closed: boolean = false) => {
        if (!currentWallId) {
            // No wall to finish
            setIsDrawing(false);
            return;
        }

        // Wall already exists - just clear state and select it
        setSelectedIds([currentWallId]);
        setActiveTool('select');

        setCurrentWallId(null);
        setLastNodeId(null);
        setIsDrawing(false);
        setJunctionTarget(null);
    }, [currentWallId, setSelectedIds, setActiveTool]);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (!isActive) return;

        if (e.key === 'Escape') {
            if (isDrawing) {
                finishWall(false);
            }
        } else if (e.key === 'Enter') {
            if (isDrawing && currentWall && currentWall.nodes.length >= 2) {
                finishWall(false);
            }
        }
    }, [isActive, isDrawing, currentWall, finishWall]);

    // Cleanup when tool becomes inactive
    useEffect(() => {
        if (!isActive) {
            setIsDrawing(false);
            setCurrentWallId(null);
            setLastNodeId(null);
            setJunctionTarget(null);
            setPreviewPoint(null);
            return;
        }


        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('click', handleClick);
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('click', handleClick);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isActive, handleMouseMove, handleClick, handleKeyDown]);

    if (!isActive) return null;

    // Show preview line and junction indicator
    return (
        <>
            {/* Guide lines - horizontal (red) and vertical (green) from start point */}
            {isDrawing && lastNode && previewPoint && (() => {
                // Calculate reasonable guide line length (about 2x the wall length or 500mm, whichever is larger)
                const dx = previewPoint.x - lastNode.x;
                const dy = previewPoint.y - lastNode.y;
                const wallLength = Math.sqrt(dx * dx + dy * dy);
                const guideLength = Math.max(wallLength * 2, 500); // At least 500mm or 2x wall length
                
                return (
                    <>
                        {/* Horizontal guide (red) from start point */}
                        <line
                            x1={lastNode.x - guideLength}
                            y1={lastNode.y}
                            x2={lastNode.x + guideLength}
                            y2={lastNode.y}
                            stroke="#ef4444"
                            strokeWidth={1 / zoom}
                            opacity={0.7}
                            strokeDasharray={`${4 / zoom},${4 / zoom}`}
                            vectorEffect="non-scaling-stroke"
                        />
                        {/* Vertical guide (green) from start point */}
                        <line
                            x1={lastNode.x}
                            y1={lastNode.y - guideLength}
                            x2={lastNode.x}
                            y2={lastNode.y + guideLength}
                            stroke="#22c55e"
                            strokeWidth={1 / zoom}
                            opacity={0.7}
                            strokeDasharray={`${4 / zoom},${4 / zoom}`}
                            vectorEffect="non-scaling-stroke"
                        />
                        {/* Horizontal guide (red) from current point */}
                        <line
                            x1={previewPoint.x - guideLength}
                            y1={previewPoint.y}
                            x2={previewPoint.x + guideLength}
                            y2={previewPoint.y}
                            stroke="#ef4444"
                            strokeWidth={1 / zoom}
                            opacity={0.7}
                            strokeDasharray={`${4 / zoom},${4 / zoom}`}
                            vectorEffect="non-scaling-stroke"
                        />
                        {/* Vertical guide (green) from current point */}
                        <line
                            x1={previewPoint.x}
                            y1={previewPoint.y - guideLength}
                            x2={previewPoint.x}
                            y2={previewPoint.y + guideLength}
                            stroke="#22c55e"
                            strokeWidth={1 / zoom}
                            opacity={0.7}
                            strokeDasharray={`${4 / zoom},${4 / zoom}`}
                            vectorEffect="non-scaling-stroke"
                        />
                    </>
                );
            })()}

            {/* Preview line - shows next segment while drawing */}
            {isDrawing && lastNode && previewPoint && (() => {
                const dx = previewPoint.x - lastNode.x;
                const dy = previewPoint.y - lastNode.y;
                const length = Math.sqrt(dx * dx + dy * dy);
                if (length === 0) return null;

                // Use actual thickness from wall type selector via sceneStore
                // Scale down by 6 for visual display (real architectural thickness is 75-225mm)
                // This matches the WallRenderer scaling for consistent appearance
                const realThickness = thickness; // Actual architectural thickness (e.g., 75, 100, 150, 225mm)
                const wallThickness = realThickness / 6; // Scale down for screen display

                // Calculate perpendicular offset for wall thickness
                const perpX = (-dy / length) * (wallThickness / 2);
                const perpY = (dx / length) * (wallThickness / 2);

                return (
                    <g>
                        {/* Left line */}
                        <line
                            x1={lastNode.x - perpX}
                            y1={lastNode.y - perpY}
                            x2={previewPoint.x - perpX}
                            y2={previewPoint.y - perpY}
                            stroke="#3b82f6"
                            strokeWidth={2 / zoom}
                            strokeDasharray={`${5 / zoom},${5 / zoom}`}
                            opacity={0.6}
                        />

                        {/* Right line */}
                        <line
                            x1={lastNode.x + perpX}
                            y1={lastNode.y + perpY}
                            x2={previewPoint.x + perpX}
                            y2={previewPoint.y + perpY}
                            stroke="#3b82f6"
                            strokeWidth={2 / zoom}
                            strokeDasharray={`${5 / zoom},${5 / zoom}`}
                            opacity={0.6}
                        />
                    </g>
                );
            })()}

            {/* Real-time dimension display outside the wall */}
            {isDrawing && lastNode && previewPoint && (() => {
                const dx = previewPoint.x - lastNode.x;
                const dy = previewPoint.y - lastNode.y;
                const length = Math.sqrt(dx * dx + dy * dy);
                if (length === 0) return null;
                
                // Calculate dimension position (outside the wall, perpendicular offset)
                const perpX = -dy / length;
                const perpY = dx / length;
                const dimensionOffset = 20; // Offset in mm
                const midX = (lastNode.x + previewPoint.x) / 2;
                const midY = (lastNode.y + previewPoint.y) / 2;
                const dimensionX = midX + perpX * dimensionOffset;
                const dimensionY = midY + perpY * dimensionOffset;
                
                // Format dimension text
                const dimensionText = length >= 1000 
                    ? `${(length / 1000).toFixed(2)} m` 
                    : `${length.toFixed(0)} mm`;
                
                // Calculate angle for text rotation
                const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                const textAngle = angle < -90 || angle > 90 ? angle + 180 : angle;

                return (
                    <g transform={`translate(${dimensionX}, ${dimensionY}) rotate(${textAngle})`}>
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

            {/* Junction indicator - show when near existing node */}
            {junctionTarget && (
                <circle
                    cx={junctionTarget.point.x}
                    cy={junctionTarget.point.y}
                    r={8 / zoom}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth={2 / zoom}
                />
            )}

            {/* Close loop indicator */}
            {junctionTarget && (
                <circle
                    cx={junctionTarget.point.x}
                    cy={junctionTarget.point.y}
                    r={12 / zoom}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth={2 / zoom}
                    strokeDasharray={`${4 / zoom},${4 / zoom}`}
                />
            )}
        </>
    );
}
