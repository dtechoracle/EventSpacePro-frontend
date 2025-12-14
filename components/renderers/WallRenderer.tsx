"use client";

import React, { useMemo, useCallback } from 'react';
import { Wall } from '@/store/projectStore';
import { calculateNodeJunctions, Point } from '@/utils/geometry';
import { useEditorStore } from '@/store/editorStore';
import { useProjectStore } from '@/store/projectStore';
import { pointToLineDistance } from '@/utils/wallOpenings';
import { calculateAllCutouts, getCutoutsForEdge, WallCutout } from '@/utils/wallCutouts';

interface WallRendererProps {
    wall: Wall;
    isSelected: boolean;
    isHovered: boolean;
}

export default function WallRenderer({ wall, isSelected, isHovered }: WallRendererProps) {
    const { nodes, edges } = wall;
    const { selectedEdgeId, setSelectedEdgeId } = useEditorStore();
    const { assets, walls: allWalls } = useProjectStore();

    // Calculate all cutouts for doors/windows
    const wallCutouts = useMemo(() => {
        return calculateAllCutouts(assets, allWalls);
    }, [assets, allWalls]);

    // Create a map of node IDs to nodes for quick lookup
    const nodeMap = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

    // Calculate junctions for all nodes
    const junctions = useMemo(() => {
        const nodeEdges = new Map<string, Array<{ id: string; otherNode: Point; thickness: number }>>();
        const { walls: allWalls } = useProjectStore.getState();

        // Helper to process edges from any wall
        const processEdges = (wallEdges: typeof edges, wallNodes: typeof nodes) => {
            const wNodeMap = new Map(wallNodes.map((node) => [node.id, node]));

            wallEdges.forEach(edge => {
                const nodeA = wNodeMap.get(edge.nodeA);
                const nodeB = wNodeMap.get(edge.nodeB);
                if (!nodeA || !nodeB) return;

                // Find corresponding nodes in OUR wall by position (not ID!)
                const POSITION_TOLERANCE = 1; // mm
                const ourNodeA = nodes.find(n =>
                    Math.abs(n.x - nodeA.x) < POSITION_TOLERANCE &&
                    Math.abs(n.y - nodeA.y) < POSITION_TOLERANCE
                );
                const ourNodeB = nodes.find(n =>
                    Math.abs(n.x - nodeB.x) < POSITION_TOLERANCE &&
                    Math.abs(n.y - nodeB.y) < POSITION_TOLERANCE
                );

                // Only process if at least one endpoint is at one of OUR node positions
                if (!ourNodeA && !ourNodeB) return;

                // Use OUR node IDs as keys, so edges from different walls get grouped together
                const keyA = ourNodeA ? ourNodeA.id : edge.nodeA;
                const keyB = ourNodeB ? ourNodeB.id : edge.nodeB;

                if (!nodeEdges.has(keyA)) nodeEdges.set(keyA, []);
                if (!nodeEdges.has(keyB)) nodeEdges.set(keyB, []);

                const realThickness = edge.thickness || 150; // Default to 150 if missing

                // Add edges using our node positions
                const existingA = nodeEdges.get(keyA)!.find(e => e.id === edge.id);
                if (!existingA) {
                    nodeEdges.get(keyA)!.push({ id: edge.id, otherNode: nodeB, thickness: realThickness });
                }

                const existingB = nodeEdges.get(keyB)!.find(e => e.id === edge.id);
                if (!existingB) {
                    nodeEdges.get(keyB)!.push({ id: edge.id, otherNode: nodeA, thickness: realThickness });
                }
            });
        };

        // 1. Process our own edges
        processEdges(edges, nodes);

        // 2. Process edges from other walls that have nodes at the same POSITION (not same ID)
        // This is critical for T-junctions and cross-junctions where different walls
        // have separate node objects at the same intersection point
        const POSITION_TOLERANCE = 1; // mm - nodes within 1mm are considered the same position

        allWalls.forEach(otherWall => {
            if (otherWall.id === wall.id) return;

            // Check if this wall has any node at the same position as our nodes
            const sharesPosition = otherWall.nodes.some(otherNode =>
                nodes.some(ourNode =>
                    Math.abs(otherNode.x - ourNode.x) < POSITION_TOLERANCE &&
                    Math.abs(otherNode.y - ourNode.y) < POSITION_TOLERANCE
                )
            );

            if (sharesPosition) {
                processEdges(otherWall.edges, otherWall.nodes);
            }
        });

        // Calculate geometry for each node
        const results = new Map<string, Record<string, { left: Point; right: Point }>>();
        nodeEdges.forEach((connectedEdges, nodeId) => {
            // Only calculate for nodes that belong to THIS wall
            if (nodeMap.has(nodeId)) {
                const node = nodeMap.get(nodeId)!;
                results.set(nodeId, calculateNodeJunctions(node, connectedEdges));
            }
        });

        return results;
    }, [nodes, edges, nodeMap]);

    // Helper function to calculate line-line intersection
    const getLineLineIntersection = useCallback((
        p1: Point, p2: Point, p3: Point, p4: Point
    ): { point: Point; t1: number; t2: number } | null => {
        const x1 = p1.x, y1 = p1.y;
        const x2 = p2.x, y2 = p2.y;
        const x3 = p3.x, y3 = p3.y;
        const x4 = p4.x, y4 = p4.y;

        const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
        if (Math.abs(denom) < 0.0001) return null;

        const t1 = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
        const t2 = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

        if (t1 >= 0 && t1 <= 1 && t2 >= 0 && t2 <= 1) {
            return {
                point: {
                    x: x1 + t1 * (x2 - x1),
                    y: y1 + t1 * (y2 - y1),
                },
                t1,
                t2,
            };
        }

        return null;
    }, []);

    // Calculate openings for each edge (both assets and wall intersections)
    const edgeOpenings = useMemo(() => {
        const openingsMap = new Map<string, Array<{ type: 'asset' | 'wall' | 'door-window'; startT: number; endT: number }>>();

        edges.forEach(edge => {
            const nodeA = nodeMap.get(edge.nodeA);
            const nodeB = nodeMap.get(edge.nodeB);
            if (!nodeA || !nodeB) return;

            const openings: Array<{ type: 'asset' | 'wall' | 'door-window'; startT: number; endT: number }> = [];

            // 1. Find asset openings (doors/windows)
            const attachedAssets = assets.filter(asset =>
                asset.attachedToWallId === wall.id &&
                (asset.type === 'door' || asset.type === 'window')
            );

            attachedAssets.forEach(asset => {
                const { distance, t } = pointToLineDistance(
                    { x: asset.x, y: asset.y },
                    nodeA,
                    nodeB
                );

                if (distance < 50 && t > 0.01 && t < 0.99) {
                    const edgeLength = Math.sqrt(
                        (nodeB.x - nodeA.x) ** 2 + (nodeB.y - nodeA.y) ** 2
                    );
                    const halfWidth = asset.width / 2;
                    const widthT = halfWidth / edgeLength;

                    openings.push({
                        type: 'asset',
                        startT: Math.max(0, t - widthT),
                        endT: Math.min(1, t + widthT)
                    });
                }
            });

            // 2. Find wall intersection openings (professional blending)
            // Check if other walls cross this edge
            const { walls: allWalls } = useProjectStore.getState();
            const otherWalls = allWalls.filter(w => w.id !== wall.id);

            otherWalls.forEach(otherWall => {
                const otherNodeMap = new Map(otherWall.nodes.map(n => [n.id, n]));

                otherWall.edges.forEach(otherEdge => {
                    const otherNodeA = otherNodeMap.get(otherEdge.nodeA);
                    const otherNodeB = otherNodeMap.get(otherEdge.nodeB);
                    if (!otherNodeA || !otherNodeB) return;

                    // Calculate intersection between this edge and other edge
                    const intersection = getLineLineIntersection(
                        nodeA, nodeB,
                        otherNodeA, otherNodeB
                    );

                    if (intersection &&
                        intersection.t1 > 0.05 && intersection.t1 < 0.95 &&
                        intersection.t2 > 0.05 && intersection.t2 < 0.95) {

                        // Professional opening calculation based on intersection angle
                        const edgeLength = Math.sqrt(
                            (nodeB.x - nodeA.x) ** 2 + (nodeB.y - nodeA.y) ** 2
                        );

                        // Calculate angle between the two edges
                        const dx1 = nodeB.x - nodeA.x;
                        const dy1 = nodeB.y - nodeA.y;
                        const dx2 = otherNodeB.x - otherNodeA.x;
                        const dy2 = otherNodeB.y - otherNodeA.y;

                        const angle1 = Math.atan2(dy1, dx1);
                        const angle2 = Math.atan2(dy2, dx2);
                        let angleDiff = Math.abs(angle1 - angle2);

                        // Normalize to [0, π]
                        if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;

                        // Calculate effective opening width based on angle
                        // For perpendicular intersections (90°), use wall thickness
                        // For acute/obtuse angles, adjust width to maintain clean miter
                        const edgeThickness = edge.thickness || 25; // Thickness in mm
                        const sinAngle = Math.abs(Math.sin(angleDiff));

                        // Avoid division by zero for parallel walls (shouldn't happen due to intersection check)
                        const effectiveWidth = sinAngle > 0.1
                            ? edgeThickness / sinAngle
                            : edgeThickness * 2;

                        // Clamp to reasonable limits (prevent extremely wide openings at shallow angles)
                        const maxWidth = edgeThickness * 3;
                        const clampedWidth = Math.min(effectiveWidth, maxWidth);

                        const widthT = clampedWidth / edgeLength;

                        openings.push({
                            type: 'wall',
                            startT: Math.max(0, intersection.t1 - widthT),
                            endT: Math.min(1, intersection.t1 + widthT)
                        });
                    }
                });
            });

            // Add door/window cutouts as openings
            const edgeCutouts = getCutoutsForEdge(wall.id, edge.id, wallCutouts);
            edgeCutouts.forEach(cutout => {
                openings.push({
                    type: 'door-window',
                    startT: cutout.startParam,
                    endT: cutout.endParam
                });
            });

            // Sort openings by position and merge overlapping ones
            openings.sort((a, b) => a.startT - b.startT);

            // Merge overlapping openings
            const mergedOpenings: typeof openings = [];
            for (const opening of openings) {
                if (mergedOpenings.length === 0) {
                    mergedOpenings.push(opening);
                } else {
                    const last = mergedOpenings[mergedOpenings.length - 1];
                    if (opening.startT <= last.endT) {
                        // Overlapping - merge
                        last.endT = Math.max(last.endT, opening.endT);
                    } else {
                        mergedOpenings.push(opening);
                    }
                }
            }

            openingsMap.set(edge.id, mergedOpenings);
        });

        return openingsMap;
    }, [edges, nodeMap, assets, wall.id, getLineLineIntersection]);

    // Helper function to interpolate junction points
    const interpolateJunction = useCallback((
        junctionA: { left: Point; right: Point },
        junctionB: { left: Point; right: Point },
        t: number
    ) => {
        return {
            left: {
                x: junctionA.left.x + (junctionB.left.x - junctionA.left.x) * t,
                y: junctionA.left.y + (junctionB.left.y - junctionA.left.y) * t
            },
            right: {
                x: junctionA.right.x + (junctionB.right.x - junctionA.right.x) * t,
                y: junctionA.right.y + (junctionB.right.y - junctionA.right.y) * t
            }
        };
    }, []);

    // Helper function to create rounded corner arc
    const createRoundedCorner = useCallback((
        p1: Point,
        p2: Point,
        p3: Point,
        radius: number
    ): string => {
        // Calculate vectors
        const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
        const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };

        // Normalize
        const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
        const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
        if (len1 === 0 || len2 === 0) return `L ${p2.x} ${p2.y}`;

        const n1 = { x: v1.x / len1, y: v1.y / len1 };
        const n2 = { x: v2.x / len2, y: v2.y / len2 };

        // Calculate angle bisector
        const bisector = { x: n1.x + n2.x, y: n1.y + n2.y };
        const bisectorLen = Math.sqrt(bisector.x * bisector.x + bisector.y * bisector.y);
        if (bisectorLen === 0) return `L ${p2.x} ${p2.y}`;

        const bisectorNorm = { x: bisector.x / bisectorLen, y: bisector.y / bisectorLen };

        // Calculate distance from corner to arc center
        const angle = Math.acos(Math.max(-1, Math.min(1, n1.x * n2.x + n1.y * n2.y)));
        if (angle === 0 || angle === Math.PI) return `L ${p2.x} ${p2.y}`;
        const dist = radius / Math.sin(angle / 2);

        // Arc center
        const center = { x: p2.x + bisectorNorm.x * dist, y: p2.y + bisectorNorm.y * dist };

        // Start and end points of arc
        const startVec = { x: p1.x - center.x, y: p1.y - center.y };
        const endVec = { x: p3.x - center.x, y: p3.y - center.y };

        // Calculate angles
        const startAngle = Math.atan2(startVec.y, startVec.x);
        const endAngle = Math.atan2(endVec.y, endVec.x);

        // Determine sweep flag (large arc if angle > 180°)
        let sweepFlag = 0;
        let angleDiff = endAngle - startAngle;
        if (angleDiff < 0) angleDiff += 2 * Math.PI;
        if (angleDiff > Math.PI) sweepFlag = 1;

        // Create arc command
        return `A ${radius} ${radius} 0 ${sweepFlag} 1 ${p3.x} ${p3.y}`;
    }, []);

    // Handle edge double-click for selection
    const handleEdgeDoubleClick = useCallback((edgeId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedEdgeId(edgeId);
    }, [setSelectedEdgeId]);

    return (
        <g className="wall" data-wall-id={wall.id}>
            {/* Render wall segments with openings */}
            {edges.map((edge) => {
                const nodeA = nodeMap.get(edge.nodeA);
                const nodeB = nodeMap.get(edge.nodeB);

                if (!nodeA || !nodeB) return null;

                // Get junction points for this edge at both nodes
                const junctionA = junctions.get(edge.nodeA)?.[edge.id];
                let junctionB = junctions.get(edge.nodeB)?.[edge.id];

                if (!junctionA || !junctionB) return null;

                // CRITICAL FIX: junctionB is calculated from nodeB looking towards nodeA,
                // so left/right are swapped relative to the edge direction A->B
                junctionB = { left: junctionB.right, right: junctionB.left };

                // Check if nodes are shared with other walls to prevent overlapping inner lines
                const { walls: allWalls } = useProjectStore.getState();

                // Find other walls that share nodeA
                const otherWallsAtNodeA = allWalls.filter(otherWall =>
                    otherWall.id !== wall.id &&
                    otherWall.nodes.some(n => Math.abs(n.x - nodeA.x) < 0.1 && Math.abs(n.y - nodeA.y) < 0.1)
                );

                // Find other walls that share nodeB
                const otherWallsAtNodeB = allWalls.filter(otherWall =>
                    otherWall.id !== wall.id &&
                    otherWall.nodes.some(n => Math.abs(n.x - nodeB.x) < 0.1 && Math.abs(n.y - nodeB.y) < 0.1)
                );

                // At shared junctions, only the wall with the "smaller" ID draws the inner line
                // This ensures consistent assignment and prevents overlap
                const shouldDrawInnerAtNodeA = otherWallsAtNodeA.length === 0 ||
                    otherWallsAtNodeA.every(otherWall => wall.id < otherWall.id);

                const shouldDrawInnerAtNodeB = otherWallsAtNodeB.length === 0 ||
                    otherWallsAtNodeB.every(otherWall => wall.id < otherWall.id);

                const openings = edgeOpenings.get(edge.id) || [];
                const lineStrokeWidth = 2;
                const isEdgeSelected = selectedEdgeId === edge.id;

                // Build segments (parts of the edge between openings)
                const segments: Array<{ startT: number; endT: number }> = [];
                let currentT = 0;

                for (const opening of openings) {
                    if (opening.startT > currentT) {
                        segments.push({ startT: currentT, endT: opening.startT });
                    }
                    currentT = opening.endT;
                }

                // Add final segment
                if (currentT < 1) {
                    segments.push({ startT: currentT, endT: 1 });
                }

                return (
                    <g key={edge.id} onDoubleClick={(e) => handleEdgeDoubleClick(edge.id, e)}>
                        {/* Render each segment */}
                        {segments.map((segment, idx) => {
                            // Interpolate junction points for segment
                            const startJunction = interpolateJunction(junctionA, junctionB, segment.startT);
                            const endJunction = interpolateJunction(junctionA, junctionB, segment.endT);

                            const p1 = startJunction.left;
                            const p2 = endJunction.left;
                            const p3 = endJunction.right;
                            const p4 = startJunction.right;

                            // Determine if we should draw inner line based on junction sharing
                            // Don't draw inner line if segment touches a shared junction where we're not responsible
                            const isAtStartJunction = segment.startT === 0;
                            const isAtEndJunction = segment.endT === 1;

                            // If segment starts at a shared junction and we're not responsible, don't draw inner line
                            const canDrawAtStart = !isAtStartJunction || shouldDrawInnerAtNodeA;
                            // If segment ends at a shared junction and we're not responsible, don't draw inner line
                            const canDrawAtEnd = !isAtEndJunction || shouldDrawInnerAtNodeB;

                            // Only draw inner line if we can draw at both ends
                            const shouldDrawInnerLine = canDrawAtStart && canDrawAtEnd;

                            // Calculate corner radius (proportional to wall thickness)
                            const wallThickness = edge.thickness || 75;
                            const cornerRadius = Math.min(wallThickness * 0.25, 12); // 25% of thickness, max 12mm

                            // For rounded corners, we'll use quadratic bezier curves at junction points
                            // This creates smooth transitions without needing to look at adjacent segments

                            // Build fill path with rounded corners using quadratic curves
                            let fillPath = `M ${p1.x} ${p1.y}`;

                            // Outer edge (left side) - add rounded corner at end if at junction
                            if (isAtEndJunction) {
                                // Use quadratic curve for smooth corner
                                const midX = p2.x;
                                const midY = p2.y;
                                fillPath += ` Q ${midX} ${midY} ${p2.x} ${p2.y}`;
                            } else {
                                fillPath += ` L ${p2.x} ${p2.y}`;
                            }

                            // Inner edge (right side)
                            if (shouldDrawInnerLine) {
                                fillPath += ` L ${p3.x} ${p3.y}`;

                                // Start corner with rounded transition
                                if (isAtStartJunction) {
                                    const midX = p4.x;
                                    const midY = p4.y;
                                    fillPath += ` Q ${midX} ${midY} ${p4.x} ${p4.y}`;
                                } else {
                                    fillPath += ` L ${p4.x} ${p4.y}`;
                                }
                            } else {
                                fillPath += ` L ${p3.x} ${p3.y} L ${p4.x} ${p4.y}`;
                            }

                            fillPath += ' Z';

                            // Build outer edge path with rounded corners using strokeLinejoin
                            let outerPath = `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`;

                            // Build inner edge path
                            let innerPath = '';
                            if (shouldDrawInnerLine) {
                                innerPath = `M ${p4.x} ${p4.y} L ${p3.x} ${p3.y}`;
                            }

                            return (
                                <g key={`segment-${idx}`}>
                                    {/* Wall Fill with rounded corners */}
                                    <path
                                        d={fillPath}
                                        fill={isEdgeSelected ? '#dbeafe' : isSelected ? '#e0f2fe' : isHovered ? '#f0f9ff' : '#ffffff'}
                                        stroke="none"
                                    />

                                    {/* Outer edge (left side) with rounded corners - always draw */}
                                    <path
                                        d={outerPath}
                                        fill="none"
                                        stroke={isEdgeSelected ? '#2563eb' : isSelected ? '#3b82f6' : isHovered ? '#60a5fa' : '#1f2937'}
                                        strokeWidth={isEdgeSelected ? lineStrokeWidth * 2 : lineStrokeWidth}
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeMiterlimit={cornerRadius}
                                        vectorEffect="non-scaling-stroke"
                                    />
                                    {/* Inner edge (right side) with rounded corners - only draw if not at a shared junction or we're responsible */}
                                    {shouldDrawInnerLine && innerPath && (
                                        <path
                                            d={innerPath}
                                            fill="none"
                                            stroke={isEdgeSelected ? '#2563eb' : isSelected ? '#3b82f6' : isHovered ? '#60a5fa' : '#1f2937'}
                                            strokeWidth={isEdgeSelected ? lineStrokeWidth * 2 : lineStrokeWidth}
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeMiterlimit={cornerRadius}
                                            vectorEffect="non-scaling-stroke"
                                        />
                                    )}
                                </g>
                            );
                        })}

                        {/* Invisible hitbox for the entire edge */}
                        <line
                            x1={nodeA.x} y1={nodeA.y}
                            x2={nodeB.x} y2={nodeB.y}
                            stroke="transparent"
                            strokeWidth={20}
                            style={{ cursor: 'pointer' }}
                        />
                    </g>
                );
            })}

            {/* Control points - show nodes for selected walls */}
            {isSelected && nodes.map((node) => (
                <g key={`control-${node.id}`}>
                    <circle
                        cx={node.x}
                        cy={node.y}
                        r={4}
                        fill="#ffffff"
                        stroke="#3b82f6"
                        strokeWidth={1.5}
                        vectorEffect="non-scaling-stroke"
                        className="cursor-move"
                        data-node-id={node.id}
                        data-wall-id={wall.id}
                    />
                    <circle
                        cx={node.x}
                        cy={node.y}
                        r={2}
                        fill="#3b82f6"
                        vectorEffect="non-scaling-stroke"
                        pointerEvents="none"
                    />
                </g>
            ))}

            {/* End caps - close wall ends for nodes with only one edge */}
            {edges.map((edge) => {
                const nodeA = nodeMap.get(edge.nodeA);
                const nodeB = nodeMap.get(edge.nodeB);
                if (!nodeA || !nodeB) return null;

                const junctionA = junctions.get(edge.nodeA)?.[edge.id];
                const junctionB = junctions.get(edge.nodeB)?.[edge.id];
                if (!junctionA || !junctionB) return null;

                // Check if nodeA is an endpoint (only has this one edge in THIS wall)
                const nodeAEdges = edges.filter(e => e.nodeA === edge.nodeA || e.nodeB === edge.nodeA);
                // AND check if it's shared with any other wall
                const { walls: allWalls } = useProjectStore.getState();
                const isNodeAShared = allWalls.some(w =>
                    w.id !== wall.id &&
                    w.nodes.some(n => Math.abs(n.x - nodeA.x) < 0.1 && Math.abs(n.y - nodeA.y) < 0.1)
                );
                const nodeAIsEndpoint = nodeAEdges.length === 1 && !isNodeAShared;

                // Check if nodeB is an endpoint
                const nodeBEdges = edges.filter(e => e.nodeA === edge.nodeB || e.nodeB === edge.nodeB);
                const isNodeBShared = allWalls.some(w =>
                    w.id !== wall.id &&
                    w.nodes.some(n => Math.abs(n.x - nodeB.x) < 0.1 && Math.abs(n.y - nodeB.y) < 0.1)
                );
                const nodeBIsEndpoint = nodeBEdges.length === 1 && !isNodeBShared;

                return (
                    <g key={`cap-${edge.id}`}>
                        {/* Cap at nodeA if it's an endpoint */}
                        {nodeAIsEndpoint && (
                            <line
                                x1={junctionA.left.x}
                                y1={junctionA.left.y}
                                x2={junctionA.right.x}
                                y2={junctionA.right.y}
                                stroke={isSelected ? '#3b82f6' : '#1f2937'}
                                strokeWidth={2}
                                strokeLinecap="round"
                                vectorEffect="non-scaling-stroke"
                            />
                        )}

                        {/* Cap at nodeB if it's an endpoint */}
                        {nodeBIsEndpoint && (
                            <line
                                x1={junctionB.left.x}
                                y1={junctionB.left.y}
                                x2={junctionB.right.x}
                                y2={junctionB.right.y}
                                stroke={isSelected ? '#3b82f6' : '#1f2937'}
                                strokeWidth={2}
                                strokeLinecap="round"
                                vectorEffect="non-scaling-stroke"
                            />
                        )}
                    </g>
                );
            })}
        </g>
    );
}
