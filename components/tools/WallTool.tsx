"use client";

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { useProjectStore, WallNode, WallEdge, Wall } from '@/store/projectStore';
import { snapTo90Degrees } from '@/lib/wallGeometry';
import { calculateNodeJunctions, Point } from '@/utils/geometry';
import { findWallIntersection } from '@/utils/wallSplitting';

import { findSnapPointInShapes } from '@/utils/snapToDrawing';

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

    // State for alignment guides (Removed visual guides as per user request, but kept logic for magnetic snap)
    // const [alignmentGuides, setAlignmentGuides] = useState<{ type: 'horizontal' | 'vertical'; x?: number; y?: number; label?: string }[]>([]);

    const SNAP_PIXELS = 15; // Screen pixels tolerance for snapping
    const SNAP_DISTANCE = 10; // mm
    const JUNCTION_SNAP_THRESHOLD = 15; // mm

    // Get current wall being drawn
    const currentWall = currentWallId ? walls.find(w => w.id === currentWallId) : null;
    const lastNode = lastNodeId && currentWall ? currentWall.nodes.find(n => n.id === lastNodeId) : null;

    // Handle mouse move for preview
    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isActive || !isDrawing) return;

        const worldPos = screenToWorld(e.clientX, e.clientY);

        // Base snapping: Grid or Raw
        let snapped = snapToGrid
            ? {
                x: Math.round(worldPos.x / gridSize) * gridSize,
                y: Math.round(worldPos.y / gridSize) * gridSize
            }
            : worldPos;

        const { snapToObjects } = useEditorStore.getState();
        const guides: { type: 'horizontal' | 'vertical'; x?: number; y?: number; label?: string }[] = [];

        // 0. Check for Object Snapping (Shapes/Assets) - if enabled
        if (snapToObjects) {
            const { shapes, walls, assets } = useProjectStore.getState();
            const allElements = [...shapes, ...walls.filter(w => w.id !== currentWallId), ...assets];
            const snapResult = findSnapPointInShapes(worldPos, allElements, 20 / zoom);
            if (snapResult) {
                snapped = { x: snapResult.x, y: snapResult.y };
            }
        }

        // 1. ALIGNMENT SNAPPING (Inference) - Priority over grid
        // Only apply if NOT snapping to grid (avoid fighting)
        if (!snapToGrid) {
            // Find interesting X and Y coordinates from other walls
            // We only align to start/end nodes of other walls to avoid noise
            const interestingX: number[] = [];
            const interestingY: number[] = [];

            walls.forEach(w => {
                // Don't align to current wall's own nodes to avoid self-reference confusion (except maybe start/end)
                if (w.id === currentWallId) {
                    // Align to first node of current wall is useful for rectangles
                    if (w.nodes.length > 0) {
                        interestingX.push(w.nodes[0].x);
                        interestingY.push(w.nodes[0].y);
                    }
                    return;
                }
                w.nodes.forEach(n => {
                    interestingX.push(n.x);
                    interestingY.push(n.y);
                });
            });

            // Check horizontal alignment (cursor Y matches interesting Y)
            const snapTol = SNAP_PIXELS / zoom;
            let bestYDisplay: number | null = null;
            let bestXDisplay: number | null = null;

            // Sort by distance to find closest snap
            interestingY.sort((a, b) => Math.abs(worldPos.y - a) - Math.abs(worldPos.y - b));
            if (interestingY.length > 0 && Math.abs(worldPos.y - interestingY[0]) < snapTol) {
                snapped.y = interestingY[0];
                guides.push({ type: 'horizontal', y: interestingY[0], label: '' });
                bestYDisplay = interestingY[0];
            }

            interestingX.sort((a, b) => Math.abs(worldPos.x - a) - Math.abs(worldPos.x - b));
            if (interestingX.length > 0 && Math.abs(worldPos.x - interestingX[0]) < snapTol) {
                snapped.x = interestingX[0];
                guides.push({ type: 'vertical', x: interestingX[0], label: '' });
                bestXDisplay = interestingX[0];
            }

            // 2. 90-degree constraint (if enabled or implied)
            // If we have a last node, and NO alignment snap occurred, we can enforce 90-degree
            if (lastNode && !bestXDisplay && !bestYDisplay) {
                // Only snap to 90 if significant movement or Shift key (TODO: Shift key)
                // For now, let's keep the existing behavior: snap if close to axis
                const dx = Math.abs(worldPos.x - lastNode.x);
                const dy = Math.abs(worldPos.y - lastNode.y);

                // If very close to vertical
                if (dx < snapTol) {
                    snapped.x = lastNode.x;
                    guides.push({ type: 'vertical', x: lastNode.x });
                }
                // If very close to horizontal
                else if (dy < snapTol) {
                    snapped.y = lastNode.y;
                    guides.push({ type: 'horizontal', y: lastNode.y });
                }
            } else if (lastNode) {
                // If we DID snap to alignment, check if that alignment creates a 90-degree line with lastNode
                // e.g. if we snapped X, does that make a vertical line? Yes.
                // If we snapped Y, does that make a horizontal line? Yes.
                // This is handled implicitly.
            }
        }

        // 3. LOOP CLOSING (Highest Priority)
        // Check if near first node of current wall
        let closingLoop = false;
        if (currentWall && currentWall.nodes.length > 2) {
            const firstNode = currentWall.nodes[0];
            const dist = Math.hypot(worldPos.x - firstNode.x, worldPos.y - firstNode.y);

            // Screen-relative snap distance for loop closing
            // We use worldPos instead of snapped to ensure we can snap even if grid pulled us away
            if (dist < (20 / zoom)) {
                snapped = { x: firstNode.x, y: firstNode.y };
                closingLoop = true;
                setJunctionTarget({
                    wallId: currentWallId!,
                    edgeId: '',
                    point: firstNode,
                });
                // Clear guides if we are closing loop (cleaner UI)
                guides.length = 0;
            }
        }

        // 4. JUNCTION SNAPPING
        if (!closingLoop) {
            const junction = findWallIntersection(snapped, walls, JUNCTION_SNAP_THRESHOLD, currentWallId || undefined);

            if (junction) {
                snapped = junction.point;
                setJunctionTarget(junction);
                // Clear alignment guides if we snap to a junction (hard snap wins)
                guides.length = 0;
            } else {
                setJunctionTarget(null);
            }
        }

        // Apply guides
        // setAlignmentGuides(guides); // Visual guides disabled

        // Update preview point for preview line
        setPreviewPoint(snapped);
    }, [isActive, isDrawing, lastNode, screenToWorld, snapToGrid, gridSize, walls, currentWallId, JUNCTION_SNAP_THRESHOLD, currentWall, zoom]);

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

        // FIRST PRIORITY: Check for loop closing (before other snapping)
        // This must happen before 90-degree snapping to prevent interference
        if (currentWall && currentWall.nodes.length > 2) {
            const firstNode = currentWall.nodes[0];
            const dist = Math.hypot(snapped.x - firstNode.x, snapped.y - firstNode.y);

            // Use larger snap distance for closing loop (same as in handleMouseMove)
            // Fix: Use screen-relative distance (20px) to match visual indicator
            if (dist < (20 / zoom)) {
                // Snap directly to first node to close the loop
                snapped = firstNode;

                // Close the loop by adding edge from last to first
                // Check if edge already exists
                const edgeExists = currentWall.edges.some(e =>
                    (e.nodeA === lastNodeId && e.nodeB === firstNode.id) ||
                    (e.nodeA === firstNode.id && e.nodeB === lastNodeId)
                );

                if (!edgeExists) {
                    const closeEdge: WallEdge = {
                        id: `edge-${Date.now()}-close`,
                        nodeA: lastNodeId!,
                        nodeB: firstNode.id,
                        thickness,
                    };
                    updateWall(currentWallId!, {
                        edges: [...currentWall!.edges, closeEdge],
                    });
                }
                finishWall(true);
                return;
            }
        }

        // Apply 90-degree snapping if we have a previous node (but not if closing loop)
        if (lastNode) {
            snapped = snapTo90Degrees(lastNode, snapped, 6);
        }

        // Check for junction opportunity (edges)
        const junction = findWallIntersection(snapped, walls, JUNCTION_SNAP_THRESHOLD, currentWallId || undefined);

        // Check for existing node snap (corners)
        let existingNodeId: string | null = null;
        let existingNodeWallId: string | null = null;

        for (const wall of walls) {
            // Don't snap to current wall's last node (prevent 0-length edge)
            if (wall.id === currentWallId && lastNodeId) {
                const node = wall.nodes.find(n => n.id === lastNodeId);
                if (node && Math.hypot(node.x - snapped.x, node.y - snapped.y) < SNAP_DISTANCE) {
                    return; // Ignore click on same node
                }
            }

            for (const node of wall.nodes) {
                if (Math.hypot(node.x - snapped.x, node.y - snapped.y) < SNAP_DISTANCE) {
                    snapped = { x: node.x, y: node.y };
                    existingNodeId = node.id;
                    existingNodeWallId = wall.id;
                    break;
                }
            }
            if (existingNodeId) break;
        }

        if (junction && !existingNodeId) {
            snapped = junction.point;
        }

        // Determine the node ID to use (new or existing)
        const newNodeId = existingNodeId || `node-${Date.now()}-${Math.random()}`;
        const newNode: WallNode = {
            id: newNodeId,
            x: snapped.x,
            y: snapped.y,
        };

        if (!currentWallId) {
            // FIRST CLICK - Create new wall
            // If we clicked an existing node, we start a new wall connected to it
            // But we need to be careful not to duplicate the node in the new wall if we want to share it?
            // Actually, walls are separate objects. If we want to share nodes, we need a different data structure.
            // Current structure: Wall has its own nodes.
            // So if we snap to an existing node, we should probably just place a NEW node at the same location
            // OR, if we want to "connect" them, we might need to merge walls?
            // For now, let's just place a new node at the exact same location to ensure visual continuity.
            // Ideally, we would merge, but that's complex.

            // WAIT: The user wants to avoid overlap.
            // If we start at an existing node, we are fine.
            // If we END at an existing node, we are fine.
            // The problem is drawing ON TOP of an existing edge.

            const wallId = `wall-${Date.now()}`;
            const wall: Wall = {
                id: wallId,
                nodes: [newNode],
                edges: [],
                zIndex: getNextZIndex(),
            };

            addWall(wall);
            setCurrentWallId(wallId);
            setLastNodeId(newNodeId);
            setIsDrawing(true);
        } else {
            // SUBSEQUENT CLICKS - Add node and edge to existing wall

            // Check if edge already exists between lastNode and newNode
            // We need to check ALL walls to prevent overlap
            let isDuplicateEdge = false;

            // Check current wall
            if (currentWall!.edges.some(e =>
                (e.nodeA === lastNodeId && e.nodeB === newNodeId) ||
                (e.nodeA === newNodeId && e.nodeB === lastNodeId)
            )) {
                isDuplicateEdge = true;
            }

            // Check other walls (if we are using shared nodes or coincident nodes)
            // Since nodes are unique per wall usually, checking coincident geometry is better
            if (!isDuplicateEdge) {
                const p1 = lastNode!;
                const p2 = newNode;

                for (const w of walls) {
                    for (const e of w.edges) {
                        const nA = w.nodes.find(n => n.id === e.nodeA);
                        const nB = w.nodes.find(n => n.id === e.nodeB);
                        if (!nA || !nB) continue;

                        // Check if edge (p1, p2) is same as (nA, nB) geometrically
                        if (
                            (Math.hypot(p1.x - nA.x, p1.y - nA.y) < 1 && Math.hypot(p2.x - nB.x, p2.y - nB.y) < 1) ||
                            (Math.hypot(p1.x - nB.x, p1.y - nB.y) < 1 && Math.hypot(p2.x - nA.x, p2.y - nA.y) < 1)
                        ) {
                            isDuplicateEdge = true;
                            break;
                        }
                    }
                    if (isDuplicateEdge) break;
                }
            }

            if (isDuplicateEdge) {
                // Don't add duplicate edge
                // Just move lastNodeId to the new node (so we can continue drawing from there)
                setLastNodeId(newNodeId);
                return;
            }

            const newEdge: WallEdge = {
                id: `edge-${Date.now()}`,
                nodeA: lastNodeId!,
                nodeB: newNodeId,
                thickness,
            };

            // If it's a new node (not existing in current wall), add it
            const nodesToUpdate = [...currentWall!.nodes];
            if (!currentWall!.nodes.some(n => n.id === newNodeId)) {
                nodesToUpdate.push(newNode);
            }

            updateWall(currentWallId, {
                nodes: nodesToUpdate,
                edges: [...currentWall!.edges, newEdge],
            });

            setLastNodeId(newNodeId);

            // Handle junction connection if detected (and not snapping to existing node)
            if (junction && !existingNodeId) {
                connectWallToEdge(
                    currentWallId,
                    newNodeId,
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

        // Clear state
        setCurrentWallId(null);
        setLastNodeId(null);
        setIsDrawing(false);
        setJunctionTarget(null);

        // Switch to select mode and clear selection so user can select other assets
        setActiveTool('select');
        setSelectedIds([]);
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
            {/* Start marker for closing loop: show a green circle at first node while drawing */}
            {isDrawing && currentWall && currentWall.nodes.length > 0 && (() => {
                const first = currentWall.nodes[0];
                return (
                    <circle
                        cx={first.x}
                        cy={first.y}
                        r={8 / zoom}
                        fill="rgba(16,185,129,0.15)"
                        stroke="#10b981"
                        strokeWidth={2 / zoom}
                    />
                );
            })()}

            {/* Alignment Guides (Inference) - Removed visuals */
            /*
            {alignmentGuides.map((guide, i) => {
                const infiniteLength = 100000; // Large enough to cover screen
                if (guide.type === 'horizontal') {
                    return (
                        <line
                            key={`align-h-${i}`}
                            x1={-infiniteLength}
                            y1={guide.y}
                            x2={infiniteLength}
                            y2={guide.y}
                            stroke="#3b82f6" // Blue
                            strokeWidth={1 / zoom}
                            strokeDasharray={`${8 / zoom},${4 / zoom}`} // Longer dash for inference
                            opacity={0.6}
                            vectorEffect="non-scaling-stroke"
                        />
                    );
                } else {
                    return (
                        <line
                            key={`align-v-${i}`}
                            x1={guide.x}
                            y1={-infiniteLength}
                            x2={guide.x}
                            y2={infiniteLength}
                            stroke="#3b82f6" // Blue
                            strokeWidth={1 / zoom}
                            strokeDasharray={`${8 / zoom},${4 / zoom}`}
                            opacity={0.6}
                            vectorEffect="non-scaling-stroke"
                        />
                    );
                }
            })}
            */}

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
                            strokeWidth={1}
                            opacity={0.7}
                            strokeDasharray="4,4"
                            vectorEffect="non-scaling-stroke"
                        />
                        {/* Vertical guide (green) from start point */}
                        <line
                            x1={lastNode.x}
                            y1={lastNode.y - guideLength}
                            x2={lastNode.x}
                            y2={lastNode.y + guideLength}
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

            {/* Preview line - shows next segment while drawing */}
            {isDrawing && lastNode && previewPoint && (() => {
                const dx = previewPoint.x - lastNode.x;
                const dy = previewPoint.y - lastNode.y;
                const length = Math.sqrt(dx * dx + dy * dy);
                if (length === 0) return null;

                // Use ACTUAL thickness (don't scale down) so users can see the real wall width
                const wallThickness = thickness; // Full thickness: 75, 100, 150, or 225mm

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
