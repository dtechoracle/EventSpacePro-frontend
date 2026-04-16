"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { useSceneStore } from '@/store/sceneStore';
import { useProjectStore, WallNode, WallEdge, Wall } from '@/store/projectStore';
import { findWallIntersection, findWallIntersectionsAlongExtendedSegment, findWallIntersectionsAlongSegment } from '@/utils/wallSplitting';

import { findClosestSnapPointFromList, findSnapPointInShapes, getSnapPoints } from '@/utils/snapToDrawing';
import { ASSET_LIBRARY } from '@/lib/assets';

interface WallToolProps {
    isActive: boolean;
    thickness?: number;
}

export default function WallTool({ isActive, thickness = 150 }: WallToolProps) {
    const { canvasOffset, zoom, panX, panY, setSelectedIds, setActiveTool, hoveredId } = useEditorStore();
    const { snapToGridEnabled, gridSize } = useSceneStore();
    const { addWall, updateWall, getNextZIndex, walls, shapes, assets, splitWallEdge } = useProjectStore();

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

    const SNAP_PIXELS = 24; // Screen pixels tolerance for snapping
    const SNAP_DISTANCE = 10; // mm
    const JUNCTION_SNAP_THRESHOLD = 15; // mm

    // Get current wall being drawn
    const currentWall = currentWallId ? walls.find(w => w.id === currentWallId) : null;
    const lastNode = lastNodeId && currentWall ? currentWall.nodes.find(n => n.id === lastNodeId) : null;

    const findExistingNodeAtPoint = useCallback((point: { x: number; y: number }) => {
        for (const wall of walls) {
            if (wall.id === currentWallId && lastNodeId) {
                const node = wall.nodes.find(n => n.id === lastNodeId);
                if (node && Math.hypot(node.x - point.x, node.y - point.y) < SNAP_DISTANCE) {
                    return { nodeId: null, point: node, isCurrentLastNode: true };
                }
            }

            for (const node of wall.nodes) {
                if (Math.hypot(node.x - point.x, node.y - point.y) < SNAP_DISTANCE) {
                    return { nodeId: node.id, point: node, isCurrentLastNode: false };
                }
            }
        }

        return { nodeId: null, point: null, isCurrentLastNode: false };
    }, [SNAP_DISTANCE, currentWallId, lastNodeId, walls]);

    const findDirectSnapPoint = useCallback((worldPos: { x: number; y: number }) => {
        const snapThreshold = 48 / zoom;
        const wallCandidates = walls.filter(wall => wall.id !== currentWallId);
        let closest = findClosestSnapPointFromList(
            worldPos,
            wallCandidates.flatMap((wall) => getSnapPoints(wall)),
            snapThreshold
        );

        if (!closest) {
            const candidates = [
                ...shapes,
                ...assets.filter((asset) => {
                    const assetDef = ASSET_LIBRARY.find((def) => def.id === asset.type);
                    return assetDef?.category === 'Marquee';
                }),
            ];

            closest = findClosestSnapPointFromList(
                worldPos,
                candidates.flatMap((element) => getSnapPoints(element)),
                snapThreshold
            );
        }

        if (!closest && currentWall && currentWall.nodes.length > 0) {
            closest = findClosestSnapPointFromList(
                worldPos,
                getSnapPoints(currentWall),
                snapThreshold
            );
        }

        return closest;
    }, [assets, currentWall, currentWallId, shapes, walls, zoom]);

    const connectNodeToWallEdge = useCallback((
        sourceWallId: string,
        sourceNodeId: string,
        targetWallId: string,
        targetEdgeId: string,
        point: { x: number; y: number }
    ) => {
        const mergedNode = splitWallEdge(targetWallId, targetEdgeId, point, true);
        if (!mergedNode) return null;

        const latestSourceWall = useProjectStore.getState().walls.find(w => w.id === sourceWallId);
        if (!latestSourceWall) return mergedNode;

        updateWall(sourceWallId, {
            nodes: latestSourceWall.nodes.map(node =>
                node.id === sourceNodeId ? mergedNode : node
            ),
            edges: latestSourceWall.edges.map(edge => ({
                ...edge,
                nodeA: edge.nodeA === sourceNodeId ? mergedNode.id : edge.nodeA,
                nodeB: edge.nodeB === sourceNodeId ? mergedNode.id : edge.nodeB,
            })),
        }, true);

        return mergedNode;
    }, [splitWallEdge, updateWall]);

    const getSegmentIntersections = useCallback((start: { x: number; y: number }, end: { x: number; y: number }) => {
        return findWallIntersectionsAlongExtendedSegment(
            start,
            end,
            thickness,
            walls,
            currentWallId || undefined
        );
    }, [currentWallId, thickness, walls]);

    const removeDuplicateSharedEdges = useCallback((sourceWallId: string) => {
        const latestWalls = useProjectStore.getState().walls;
        const sourceWall = latestWalls.find(w => w.id === sourceWallId);
        if (!sourceWall) return;

        const edgeIdsByWall = new Map<string, Set<string>>();
        const pointTolerance = 1;

        const markEdge = (wallId: string, edgeId: string) => {
            if (!edgeIdsByWall.has(wallId)) {
                edgeIdsByWall.set(wallId, new Set<string>());
            }
            edgeIdsByWall.get(wallId)!.add(edgeId);
        };

        const pointsMatch = (a: { x: number; y: number }, b: { x: number; y: number }) =>
            Math.hypot(a.x - b.x, a.y - b.y) < pointTolerance;

        const getEdgeNodes = (wall: Wall, edge: WallEdge) => {
            const nodeA = wall.nodes.find(node => node.id === edge.nodeA);
            const nodeB = wall.nodes.find(node => node.id === edge.nodeB);
            return nodeA && nodeB ? { nodeA, nodeB } : null;
        };

        latestWalls.forEach(otherWall => {
            if (otherWall.id === sourceWallId) return;

            sourceWall.edges.forEach(sourceEdge => {
                const sourceNodes = getEdgeNodes(sourceWall, sourceEdge);
                if (!sourceNodes) return;

                otherWall.edges.forEach(otherEdge => {
                    const otherNodes = getEdgeNodes(otherWall, otherEdge);
                    if (!otherNodes) return;

                    const sameDirection =
                        pointsMatch(sourceNodes.nodeA, otherNodes.nodeA) &&
                        pointsMatch(sourceNodes.nodeB, otherNodes.nodeB);
                    const oppositeDirection =
                        pointsMatch(sourceNodes.nodeA, otherNodes.nodeB) &&
                        pointsMatch(sourceNodes.nodeB, otherNodes.nodeA);

                    if (sameDirection || oppositeDirection) {
                        markEdge(sourceWall.id, sourceEdge.id);
                        markEdge(otherWall.id, otherEdge.id);
                    }
                });
            });
        });

        edgeIdsByWall.forEach((edgeIds, wallId) => {
            const wall = useProjectStore.getState().walls.find(w => w.id === wallId);
            if (!wall || edgeIds.size === 0) return;

            updateWall(wallId, {
                edges: wall.edges.filter(edge => !edgeIds.has(edge.id)),
            }, true);
        });
    }, [updateWall]);

    const refreshWallGeometry = useCallback((wallId: string) => {
        const wall = useProjectStore.getState().walls.find((entry) => entry.id === wallId);
        if (!wall) return;

        updateWall(wallId, {
            nodes: wall.nodes.map((node) => ({ ...node })),
            edges: wall.edges.map((edge) => ({ ...edge })),
        }, true);
    }, [updateWall]);

    const getSnappedWallPoint = useCallback((worldPos: { x: number; y: number }) => {
        if (currentWall && currentWall.nodes.length > 2) {
            const firstNode = currentWall.nodes[0];
            const distToFirstNode = Math.hypot(worldPos.x - firstNode.x, worldPos.y - firstNode.y);
            if (distToFirstNode < (32 / zoom)) {
                return {
                    snapped: { x: firstNode.x, y: firstNode.y },
                    closingLoop: true,
                    junction: {
                        wallId: currentWallId!,
                        edgeId: '',
                        point: firstNode,
                    },
                };
            }
        }

        const directSnapPoint = findDirectSnapPoint(worldPos);
        if (directSnapPoint) {
            return {
                snapped: { x: directSnapPoint.x, y: directSnapPoint.y },
                closingLoop: false,
                junction: null,
            };
        }

        let snapped = snapToGridEnabled
            ? {
                x: Math.round(worldPos.x / gridSize) * gridSize,
                y: Math.round(worldPos.y / gridSize) * gridSize
            }
            : worldPos;

        let snappedXToGuide = false;
        let snappedYToGuide = false;
        const snapTol = SNAP_PIXELS / zoom;
        const alignmentReference = worldPos;
        const interestingX: number[] = [];
        const interestingY: number[] = [];

        walls.forEach(w => {
            if (w.id === currentWallId) {
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

        interestingY.sort((a, b) => Math.abs(alignmentReference.y - a) - Math.abs(alignmentReference.y - b));
        if (interestingY.length > 0 && Math.abs(alignmentReference.y - interestingY[0]) < snapTol) {
            snapped.y = interestingY[0];
            snappedYToGuide = true;
        }

        interestingX.sort((a, b) => Math.abs(alignmentReference.x - a) - Math.abs(alignmentReference.x - b));
        if (interestingX.length > 0 && Math.abs(alignmentReference.x - interestingX[0]) < snapTol) {
            snapped.x = interestingX[0];
            snappedXToGuide = true;
        }

        if (lastNode) {
            const dx = Math.abs(alignmentReference.x - lastNode.x);
            const dy = Math.abs(alignmentReference.y - lastNode.y);

            if (!snappedXToGuide && dx < snapTol) {
                snapped.x = lastNode.x;
            }

            if (!snappedYToGuide && dy < snapTol) {
                snapped.y = lastNode.y;
            }
        }

        const { snapToObjects } = useEditorStore.getState();
        if (snapToObjects && !snappedXToGuide && !snappedYToGuide) {
            const allElements = [...shapes, ...walls.filter(w => w.id !== currentWallId), ...assets];
            const snapResult = findSnapPointInShapes(worldPos, allElements, 20 / zoom);
            if (snapResult) {
                snapped = { x: snapResult.x, y: snapResult.y };
            }
        }

        let closingLoop = false;

        const junction = findWallIntersection(snapped, walls, JUNCTION_SNAP_THRESHOLD, currentWallId || undefined);
        if (junction) {
            snapped = junction.point;
        }

        return {
            snapped,
            closingLoop,
            junction,
        };
    }, [currentWall, currentWallId, findDirectSnapPoint, gridSize, lastNode, snapToGridEnabled, walls, zoom]);

    const finishWall = useCallback((closed: boolean = false) => {
        if (!currentWallId) {
            setIsDrawing(false);
            return;
        }

        setCurrentWallId(null);
        setLastNodeId(null);
        setIsDrawing(false);
        setJunctionTarget(null);

        setActiveTool('select');
        setSelectedIds([]);
    }, [currentWallId, setSelectedIds, setActiveTool]);

    // Handle mouse move for preview
    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isActive) return;

        const worldPos = screenToWorld(e.clientX, e.clientY);
        const { snapped, junction } = getSnappedWallPoint(worldPos);
        const segmentIntersections = isDrawing && lastNode
            ? getSegmentIntersections(lastNode, snapped)
            : [];
        const firstIntersection = segmentIntersections[0] || null;
        const segmentJunction = !junction ? firstIntersection : null;

        setJunctionTarget(junction || segmentJunction || null);
        setPreviewPoint(snapped);
    }, [getSegmentIntersections, getSnappedWallPoint, isActive, isDrawing, lastNode, screenToWorld]);

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

        const worldPos = previewPoint || screenToWorld(e.clientX, e.clientY);
        let { snapped, closingLoop, junction } = getSnappedWallPoint(worldPos);

        // FIRST PRIORITY: Check for loop closing (before other snapping)
        // This must happen before 90-degree snapping to prevent interference
        if (closingLoop && currentWall && currentWall.nodes.length > 2) {
            const firstNode = currentWall.nodes[0];
            const edgeExists = currentWall.edges.some(e =>
                (e.nodeA === lastNodeId && e.nodeB === firstNode.id) ||
                (e.nodeA === firstNode.id && e.nodeB === lastNodeId)
            );

            if (!edgeExists) {
                const closingIntersections = lastNode
                    ? getSegmentIntersections(lastNode, firstNode)
                    : [];

                if (closingIntersections.length > 0) {
                    const updatedNodes = [...currentWall.nodes];
                    const updatedEdges = [...currentWall.edges];
                    const touchedWallIds = new Set<string>([currentWallId!]);
                    const pendingConnections: Array<{
                        sourceNodeId: string;
                        wallId: string;
                        edgeId: string;
                        point: { x: number; y: number };
                    }> = [];
                    let previousNodeId = lastNodeId!;

                    const addNodeIfNeeded = (node: WallNode) => {
                        if (!updatedNodes.some(existing => existing.id === node.id)) {
                            updatedNodes.push(node);
                        }
                    };

                    for (const intersection of closingIntersections) {
                        const intersectionNodeId = `node-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
                        const intersectionNode: WallNode = {
                            id: intersectionNodeId,
                            x: intersection.point.x,
                            y: intersection.point.y,
                        };

                        addNodeIfNeeded(intersectionNode);
                        updatedEdges.push({
                            id: `edge-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                            nodeA: previousNodeId,
                            nodeB: intersectionNodeId,
                            thickness,
                        });

                        pendingConnections.push({
                            sourceNodeId: intersectionNodeId,
                            wallId: intersection.wallId,
                            edgeId: intersection.edgeId,
                            point: intersection.point,
                        });
                        touchedWallIds.add(intersection.wallId);

                        previousNodeId = intersectionNodeId;
                    }

                    updatedEdges.push({
                        id: `edge-${Date.now()}-close`,
                        nodeA: previousNodeId,
                        nodeB: firstNode.id,
                        thickness,
                    });

                    updateWall(currentWallId!, {
                        nodes: updatedNodes,
                        edges: updatedEdges,
                    });

                    pendingConnections.forEach(connection => {
                        connectNodeToWallEdge(
                            currentWallId!,
                            connection.sourceNodeId,
                            connection.wallId,
                            connection.edgeId,
                            connection.point
                        );
                    });

                    removeDuplicateSharedEdges(currentWallId!);
                    touchedWallIds.forEach((wallId) => refreshWallGeometry(wallId));
                } else {
                    const closeEdge: WallEdge = {
                        id: `edge-${Date.now()}-close`,
                        nodeA: lastNodeId!,
                        nodeB: firstNode.id,
                        thickness,
                    };
                    updateWall(currentWallId!, {
                        edges: [...currentWall!.edges, closeEdge],
                    });
                    refreshWallGeometry(currentWallId!);
                }
            }
            finishWall(true);
            return;
        }

        // Check for junction opportunity (edges)
        // Check for existing node snap (corners)
        let existingNodeId: string | null = null;
        const existingNodeResult = findExistingNodeAtPoint(snapped);
        if (existingNodeResult.isCurrentLastNode) {
            return;
        }
        if (existingNodeResult.nodeId && existingNodeResult.point) {
            snapped = { x: existingNodeResult.point.x, y: existingNodeResult.point.y };
            existingNodeId = existingNodeResult.nodeId;
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
            setIsDrawing(true);

            if (junction && !existingNodeId && junction.edgeId) {
                const mergedNode = connectNodeToWallEdge(
                    wallId,
                    newNodeId,
                    junction.wallId,
                    junction.edgeId,
                    junction.point
                );
                setLastNodeId(mergedNode?.id || newNodeId);
            } else {
                setLastNodeId(newNodeId);
            }
        } else {
            // SUBSEQUENT CLICKS - Add node and edge to existing wall
            const segmentIntersections = lastNode
                ? getSegmentIntersections(lastNode, snapped)
                : [];

            const extendedIntersection = segmentIntersections.find(intersection => intersection.tSegment > 1);
            if (extendedIntersection) {
                snapped = extendedIntersection.point;
                newNode.x = snapped.x;
                newNode.y = snapped.y;
            }

            if (segmentIntersections.length > 0) {
                const updatedNodes = [...currentWall!.nodes];
                const updatedEdges = [...currentWall!.edges];
                const touchedWallIds = new Set<string>([currentWallId]);
                const pendingConnections: Array<{
                    sourceNodeId: string;
                    wallId: string;
                    edgeId: string;
                    point: { x: number; y: number };
                }> = [];
                let previousNodeId = lastNodeId!;

                const addNodeIfNeeded = (node: WallNode) => {
                    if (!updatedNodes.some(existing => existing.id === node.id)) {
                        updatedNodes.push(node);
                    }
                };

                for (const intersection of segmentIntersections) {
                    const intersectionNodeId = `node-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
                    const intersectionNode: WallNode = {
                        id: intersectionNodeId,
                        x: intersection.point.x,
                        y: intersection.point.y,
                    };

                    addNodeIfNeeded(intersectionNode);
                    updatedEdges.push({
                        id: `edge-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                        nodeA: previousNodeId,
                        nodeB: intersectionNodeId,
                        thickness,
                    });

                    pendingConnections.push({
                        sourceNodeId: intersectionNodeId,
                        wallId: intersection.wallId,
                        edgeId: intersection.edgeId,
                        point: intersection.point,
                    });
                    touchedWallIds.add(intersection.wallId);

                    previousNodeId = intersectionNodeId;
                }

                addNodeIfNeeded(newNode);
                updatedEdges.push({
                    id: `edge-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                    nodeA: previousNodeId,
                    nodeB: newNodeId,
                    thickness,
                });

                updateWall(currentWallId, {
                    nodes: updatedNodes,
                    edges: updatedEdges,
                });

                pendingConnections.forEach(connection => {
                    connectNodeToWallEdge(
                        currentWallId,
                        connection.sourceNodeId,
                        connection.wallId,
                        connection.edgeId,
                        connection.point
                    );
                });

                let finalNodeId = newNodeId;
                if (junction && !existingNodeId) {
                    const mergedNode = connectNodeToWallEdge(
                        currentWallId,
                        newNodeId,
                        junction.wallId,
                        junction.edgeId,
                        junction.point
                    );
                    if (mergedNode) {
                        finalNodeId = mergedNode.id;
                    }
                }

                removeDuplicateSharedEdges(currentWallId);
                touchedWallIds.forEach((wallId) => refreshWallGeometry(wallId));
                setLastNodeId(finalNodeId);
                return;
            }

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
                const mergedNode = connectNodeToWallEdge(
                    currentWallId,
                    newNodeId,
                    junction.wallId,
                    junction.edgeId,
                    junction.point
                );
                if (mergedNode) {
                    setLastNodeId(mergedNode.id);
                }
                refreshWallGeometry(junction.wallId);
                refreshWallGeometry(currentWallId);
            }
            removeDuplicateSharedEdges(currentWallId);
        }
    }, [connectNodeToWallEdge, findExistingNodeAtPoint, getSegmentIntersections, getSnappedWallPoint, isActive, currentWallId, currentWall, lastNode, lastNodeId, previewPoint, refreshWallGeometry, removeDuplicateSharedEdges, screenToWorld, lastClickTime, walls, thickness, addWall, updateWall, getNextZIndex, finishWall]);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (!isActive) return;

        if (e.key === 'Escape') {
            if (isDrawing) {
                finishWall(false);
            } else {
                setActiveTool('select');
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

    const cursorMarkerStroke = 1.25 / zoom;
    const junctionMarkerRadius = 4.5 / zoom;

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
                        r={junctionMarkerRadius}
                        fill="rgba(16,185,129,0.15)"
                        stroke="#10b981"
                        strokeWidth={cursorMarkerStroke}
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
                const guideLength = 200000; // Increased to 200m to cover workspace size

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
                            strokeWidth={1}
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
                            strokeWidth={1}
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
                            strokeWidth={1}
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

                // Use ACTUAL thickness (don't scale down) so users can see the real wall width
                const wallThickness = thickness; // Full thickness: 75, 100, 150, or 225mm

                // Calculate perpendicular offset for wall thickness
                const perpX = (-dy / length) * (wallThickness / 2);
                const perpY = (dx / length) * (wallThickness / 2);

                const openings = getSegmentIntersections(lastNode, previewPoint)
                    .filter((intersection) => intersection.tSegment > 0 && intersection.tSegment < 1)
                    .map((intersection) => {
                        const targetWall = walls.find((wall) => wall.id === intersection.wallId);
                        const targetEdge = targetWall?.edges.find((edge) => edge.id === intersection.edgeId);
                        const targetThickness = targetEdge?.thickness || thickness;

                        const otherDx = intersection.nodeB.x - intersection.nodeA.x;
                        const otherDy = intersection.nodeB.y - intersection.nodeA.y;
                        const angle1 = Math.atan2(dy, dx);
                        const angle2 = Math.atan2(otherDy, otherDx);
                        let angleDiff = Math.abs(angle1 - angle2);
                        if (angleDiff > Math.PI) angleDiff = (2 * Math.PI) - angleDiff;

                        const sinAngle = Math.abs(Math.sin(angleDiff));
                        if (sinAngle < 0.2) {
                            return null;
                        }

                        const halfProjectedLength = (targetThickness / 2) / sinAngle;
                        const halfProjectedT = Math.min(0.49, halfProjectedLength / length);

                        return {
                            startT: Math.max(0, intersection.tSegment - halfProjectedT),
                            endT: Math.min(1, intersection.tSegment + halfProjectedT),
                        };
                    })
                    .filter((opening): opening is { startT: number; endT: number } => Boolean(opening))
                    .sort((a, b) => a.startT - b.startT);

                const mergedOpenings: Array<{ startT: number; endT: number }> = [];
                openings.forEach((opening) => {
                    const lastOpening = mergedOpenings[mergedOpenings.length - 1];
                    if (!lastOpening || opening.startT > lastOpening.endT) {
                        mergedOpenings.push({ ...opening });
                        return;
                    }

                    lastOpening.endT = Math.max(lastOpening.endT, opening.endT);
                });

                const segments: Array<{ startT: number; endT: number }> = [];
                let currentT = 0;
                mergedOpenings.forEach((opening) => {
                    if (opening.startT > currentT) {
                        segments.push({ startT: currentT, endT: opening.startT });
                    }
                    currentT = Math.max(currentT, opening.endT);
                });
                if (currentT < 1) {
                    segments.push({ startT: currentT, endT: 1 });
                }

                const pointAtT = (t: number) => ({
                    x: lastNode.x + dx * t,
                    y: lastNode.y + dy * t,
                });

                return (
                    <g>
                        {segments.map((segment, index) => {
                            const start = pointAtT(segment.startT);
                            const end = pointAtT(segment.endT);

                            return (
                                <g key={`preview-segment-${index}`}>
                                    <line
                                        x1={start.x - perpX}
                                        y1={start.y - perpY}
                                        x2={end.x - perpX}
                                        y2={end.y - perpY}
                                        stroke="#3b82f6"
                                        strokeWidth={2}
                                        strokeDasharray="5,5"
                                        opacity={0.6}
                                        vectorEffect="non-scaling-stroke"
                                    />
                                    <line
                                        x1={start.x + perpX}
                                        y1={start.y + perpY}
                                        x2={end.x + perpX}
                                        y2={end.y + perpY}
                                        stroke="#3b82f6"
                                        strokeWidth={2}
                                        strokeDasharray="5,5"
                                        opacity={0.6}
                                        vectorEffect="non-scaling-stroke"
                                    />
                                </g>
                            );
                        })}
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
                    <g transform={`translate(${dimensionX}, ${dimensionY}) scale(${1 / zoom}) rotate(${textAngle})`}>
                        <rect
                            x={-dimensionText.length * 4 - 6}
                            y={-10}
                            width={dimensionText.length * 8 + 12}
                            height={20}
                            fill="#ffffff"
                            stroke="#3b82f6"
                            strokeWidth={1.5}
                            rx={4}
                            opacity={0.9}
                            style={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.1))' }}
                        />
                        <text
                            x={0}
                            y={1}
                            fill="#1f2937"
                            fontSize={12}
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
                    r={junctionMarkerRadius}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth={cursorMarkerStroke}
                />
            )}
        </>
    );
}
