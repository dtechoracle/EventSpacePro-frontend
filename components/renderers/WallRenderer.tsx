"use client";

import React, { useMemo, useCallback } from 'react';
import { Wall } from '@/store/projectStore';
import { calculateNodeJunctions, Point } from '@/utils/geometry';
import { useEditorStore } from '@/store/editorStore';
import { useProjectStore } from '@/store/projectStore';
import { calculateAllCutouts, getCutoutsForEdge } from '@/utils/wallCutouts';

interface WallRendererProps {
    wall: Wall;
    isSelected: boolean;
    isHovered: boolean;
}

const WallRenderer = ({ wall, isSelected, isHovered }: WallRendererProps) => {
    const { nodes, edges } = wall;
    const selectedEdgeId = useEditorStore(s => s.selectedEdgeId);
    const setSelectedEdgeId = useEditorStore(s => s.setSelectedEdgeId);
    const zoom = useEditorStore(s => s.zoom);
    
    // Use target selectors for ProjectStore
    const assets = useProjectStore(s => s.assets);
    const allWalls = useProjectStore(s => s.walls);

    // Calculate all cutouts for doors/windows
    const wallCutouts = useMemo(() => {
        return calculateAllCutouts(assets, allWalls);
    }, [assets, allWalls]);

    // Create a map of node IDs to nodes for quick lookup
    const nodeMap = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

    // Calculate junctions for all nodes
    const junctions = useMemo(() => {
        const nodeEdges = new Map<string, Array<{ id: string; otherNode: Point; thickness: number }>>();

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
    }, [nodes, edges, nodeMap, allWalls, wall.id]);

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
            const cutoutsForThisEdge = getCutoutsForEdge(wall.id, edge.id, wallCutouts);
            cutoutsForThisEdge.forEach(cutout => {
                if (cutout.startParam > 0.01 && cutout.endParam < 0.99) {
                    openings.push({
                        type: 'asset',
                        startT: cutout.startParam,
                        endT: cutout.endParam
                    });
                }
            });

            // 2. Find wall intersection openings
            otherWallsFilter: {
                const otherWalls = allWalls.filter(w => w.id !== wall.id);
                otherWalls.forEach(otherWall => {
                    const otherNodeMap = new Map(otherWall.nodes.map(n => [n.id, n]));
                    otherWall.edges.forEach(otherEdge => {
                        const otherNodeA = otherNodeMap.get(otherEdge.nodeA);
                        const otherNodeB = otherNodeMap.get(otherEdge.nodeB);
                        if (!otherNodeA || !otherNodeB) return;

                        const intersection = getLineLineIntersection(nodeA, nodeB, otherNodeA, otherNodeB);
                        if (intersection && intersection.t1 > 0.05 && intersection.t1 < 0.95 && intersection.t2 > 0.05 && intersection.t2 < 0.95) {
                            const edgeLength = Math.sqrt((nodeB.x - nodeA.x) ** 2 + (nodeB.y - nodeA.y) ** 2);
                            const dx1 = nodeB.x - nodeA.x;
                            const dy1 = nodeB.y - nodeA.y;
                            const dx2 = otherNodeB.x - otherNodeA.x;
                            const dy2 = otherNodeB.y - otherNodeA.y;
                            const angle1 = Math.atan2(dy1, dx1);
                            const angle2 = Math.atan2(dy2, dx2);
                            let angleDiff = Math.abs(angle1 - angle2);
                            if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
                            const edgeThickness = edge.thickness || 25;
                            const sinAngle = Math.abs(Math.sin(angleDiff));
                            const effectiveWidth = sinAngle > 0.1 ? edgeThickness / sinAngle : edgeThickness * 2;
                            const widthT = Math.min(effectiveWidth, edgeThickness * 3) / edgeLength;

                            openings.push({
                                type: 'wall',
                                startT: Math.max(0, intersection.t1 - widthT),
                                endT: Math.min(1, intersection.t1 + widthT)
                            });
                        }
                    });
                });
            }

            // 3. Merge overlapping openings
            openings.sort((a, b) => a.startT - b.startT);
            const mergedOpenings: typeof openings = [];
            for (const opening of openings) {
                if (mergedOpenings.length === 0) mergedOpenings.push(opening);
                else {
                    const last = mergedOpenings[mergedOpenings.length - 1];
                    if (opening.startT <= last.endT) last.endT = Math.max(last.endT, opening.endT);
                    else mergedOpenings.push(opening);
                }
            }
            openingsMap.set(edge.id, mergedOpenings);
        });

        return openingsMap;
    }, [edges, nodeMap, wallCutouts, allWalls, wall.id, getLineLineIntersection]);

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

    // Handle edge double-click for selection
    const handleEdgeDoubleClick = useCallback((edgeId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedEdgeId(edgeId);
    }, [setSelectedEdgeId]);

    return (
        <g className="wall" data-wall-id={wall.id} data-id={wall.id}>
            {/* Render wall segments with openings */}
            {edges.map((edge) => {
                const nodeA = nodeMap.get(edge.nodeA);
                const nodeB = nodeMap.get(edge.nodeB);

                if (!nodeA || !nodeB) return null;

                // Get junction points for this edge at both nodes
                const junctionA = junctions.get(edge.nodeA)?.[edge.id];
                let junctionB = junctions.get(edge.nodeB)?.[edge.id];

                if (!junctionA || !junctionB) return null;

                // junctionB calculated from nodeB looking towards nodeA, swap left/right
                junctionB = { left: junctionB.right, right: junctionB.left };

                // Shared junctions logic - only wall with smaller ID draws inner line
                const otherWallsAtNodeA = allWalls.filter(otherWall =>
                    otherWall.id !== wall.id &&
                    otherWall.nodes.some(n => Math.abs(n.x - nodeA.x) < 0.1 && Math.abs(n.y - nodeA.y) < 0.1)
                );
                const otherWallsAtNodeB = allWalls.filter(otherWall =>
                    otherWall.id !== wall.id &&
                    otherWall.nodes.some(n => Math.abs(n.x - nodeB.x) < 0.1 && Math.abs(n.y - nodeB.y) < 0.1)
                );

                const shouldDrawInnerAtNodeA = otherWallsAtNodeA.length === 0 ||
                    otherWallsAtNodeA.every(otherWall => wall.id < otherWall.id);

                const shouldDrawInnerAtNodeB = otherWallsAtNodeB.length === 0 ||
                    otherWallsAtNodeB.every(otherWall => wall.id < otherWall.id);

                const openings = edgeOpenings.get(edge.id) || [];
                const isEdgeSelected = selectedEdgeId === edge.id;

                const lineStrokeWidth = wall.strokeWidth !== undefined ? wall.strokeWidth : 2;
                const strokeColor = wall.stroke || (isEdgeSelected ? '#2563eb' : isSelected ? '#3b82f6' : isHovered ? '#60a5fa' : '#1f2937');

                // Build segments
                const segments: Array<{ startT: number; endT: number }> = [];
                let currentT = 0;
                for (const opening of openings) {
                    if (opening.startT > currentT) segments.push({ startT: currentT, endT: opening.startT });
                    currentT = opening.endT;
                }
                if (currentT < 1) segments.push({ startT: currentT, endT: 1 });

                return (
                    <g key={edge.id} onDoubleClick={(e) => handleEdgeDoubleClick(edge.id, e)}>
                        {segments.map((segment, idx) => {
                            const getPointsAtT = (t: number) => {
                                if (t <= 0.001) return junctionA;
                                if (t >= 0.999) return junctionB;
                                const dx = nodeB.x - nodeA.x;
                                const dy = nodeB.y - nodeA.y;
                                const len = Math.sqrt(dx * dx + dy * dy);
                                const px = nodeA.x + dx * t;
                                const py = nodeA.y + dy * t;
                                const nx = -dy / len;
                                const ny = dx / len;
                                const halfThick = (edge.thickness || 150) / 2;
                                return {
                                    left: { x: px + nx * halfThick, y: py + ny * halfThick },
                                    right: { x: px - nx * halfThick, y: py - ny * halfThick }
                                };
                            };

                            const startPoints = getPointsAtT(segment.startT);
                            const endPoints = getPointsAtT(segment.endT);

                            const p1 = startPoints.left;
                            const p2 = endPoints.left;
                            const p3 = endPoints.right;
                            const p4 = startPoints.right;

                            const isAtStartJunction = segment.startT === 0;
                            const isAtEndJunction = segment.endT === 1;
                            const canDrawAtStart = !isAtStartJunction || shouldDrawInnerAtNodeA;
                            const canDrawAtEnd = !isAtEndJunction || shouldDrawInnerAtNodeB;
                            const shouldDrawInnerLine = canDrawAtStart && canDrawAtEnd;

                            let fillPath = `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y} L ${p3.x} ${p3.y} L ${p4.x} ${p4.y} Z`;
                            let outerPath = `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`;
                            let innerPath = shouldDrawInnerLine ? `M ${p4.x} ${p4.y} L ${p3.x} ${p3.y}` : '';

                            return (
                                <g key={`segment-${idx}`}>
                                    <path
                                        d={fillPath}
                                        fill={(wall.fillType === 'texture' || wall.fillType === 'hatch' || wall.fillType === 'hash') && wall.fillTexture
                                            ? `url(#${wall.fillTexture}-scale-${wall.fillTextureScale || 1}-thick-${wall.fillTextureThickness || 1})`
                                            : (wall.fill || '#ffffff')}
                                        stroke="none"
                                    />
                                    {(isSelected || isHovered || isEdgeSelected) && (
                                        <path
                                            d={fillPath}
                                            fill="#3b82f6"
                                            fillOpacity={isEdgeSelected ? 0.15 : (isSelected ? 0.1 : 0.05)}
                                            stroke="none"
                                            style={{ pointerEvents: 'none' }}
                                        />
                                    )}
                                    <path
                                        d={outerPath}
                                        fill="none"
                                        stroke={strokeColor}
                                        strokeWidth={isEdgeSelected ? lineStrokeWidth * 1.5 : lineStrokeWidth}
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        vectorEffect="non-scaling-stroke"
                                    />
                                    {shouldDrawInnerLine && innerPath && (
                                        <path
                                            d={innerPath}
                                            fill="none"
                                            stroke={strokeColor}
                                            strokeWidth={isEdgeSelected ? lineStrokeWidth * 1.5 : lineStrokeWidth}
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            vectorEffect="non-scaling-stroke"
                                        />
                                    )}
                                </g>
                            );
                        })}

                        {openings.map((opening, openingIdx) => {
                            if (opening.type !== 'door-window') return null;
                            const startJunction = interpolateJunction(junctionA, junctionB, opening.startT);
                            const endJunction = interpolateJunction(junctionA, junctionB, opening.endT);
                            let sLeftX = startJunction.left.x, sLeftY = startJunction.left.y;
                            let sRightX = startJunction.right.x, sRightY = startJunction.right.y;
                            let eLeftX = endJunction.left.x, eLeftY = endJunction.left.y;
                            let eRightX = endJunction.right.x, eRightY = endJunction.right.y;

                            const edgeDx = nodeB.x - nodeA.x, edgeDy = nodeB.y - nodeA.y;
                            const absDx = Math.abs(edgeDx), absDy = Math.abs(edgeDy);
                            const isHorizontalLike = absDx > 0 && absDy / absDx < 0.01;
                            const isVerticalLike = absDy > 0 && absDx / absDy < 0.01;

                            if (isHorizontalLike) {
                                const sMidX = (sLeftX + sRightX) / 2; sLeftX = sMidX; sRightX = sMidX;
                                const eMidX = (eLeftX + eRightX) / 2; eLeftX = eMidX; eRightX = eMidX;
                            } else if (isVerticalLike) {
                                const sMidY = (sLeftY + sRightY) / 2; sLeftY = sMidY; sRightY = sMidY;
                                const eMidY = (eLeftY + eRightY) / 2; eLeftY = eMidY; eRightY = eMidY;
                            }

                            return (
                                <g key={`cutout-cap-${openingIdx}`}>
                                    <line x1={sLeftX} y1={sLeftY} x2={sRightX} y2={sRightY} stroke={strokeColor} strokeWidth={isEdgeSelected ? lineStrokeWidth * 1.5 : lineStrokeWidth} strokeLinecap="butt" vectorEffect="non-scaling-stroke" />
                                    <line x1={eLeftX} y1={eLeftY} x2={eRightX} y2={eRightY} stroke={strokeColor} strokeWidth={isEdgeSelected ? lineStrokeWidth * 1.5 : lineStrokeWidth} strokeLinecap="butt" vectorEffect="non-scaling-stroke" />
                                </g>
                            );
                        })}

                        <line x1={nodeA.x} y1={nodeA.y} x2={nodeB.x} y2={nodeB.y} stroke="transparent" strokeWidth={20} style={{ cursor: 'pointer' }} />
                    </g>
                );
            })}

            {edges.map((edge) => {
                const nodeA = nodeMap.get(edge.nodeA);
                const nodeB = nodeMap.get(edge.nodeB);
                if (!nodeA || !nodeB) return null;
                const junctionA = junctions.get(edge.nodeA)?.[edge.id];
                const junctionB = junctions.get(edge.nodeB)?.[edge.id];
                if (!junctionA || !junctionB) return null;

                const nodeAEdges = edges.filter(e => e.nodeA === edge.nodeA || e.nodeB === edge.nodeA);
                const isNodeAShared = allWalls.some(w => w.id !== wall.id && w.nodes.some(n => Math.abs(n.x - nodeA.x) < 0.1 && Math.abs(n.y - nodeA.y) < 0.1));
                const nodeAIsEndpoint = nodeAEdges.length === 1 && !isNodeAShared;

                const nodeBEdges = edges.filter(e => e.nodeA === edge.nodeB || e.nodeB === edge.nodeB);
                const isNodeBShared = allWalls.some(w => w.id !== wall.id && w.nodes.some(n => Math.abs(n.x - nodeB.x) < 0.1 && Math.abs(n.y - nodeB.y) < 0.1));
                const nodeBIsEndpoint = nodeBEdges.length === 1 && !isNodeBShared;

                return (
                    <g key={`cap-${edge.id}`}>
                        {nodeAIsEndpoint && <line x1={junctionA.left.x} y1={junctionA.left.y} x2={junctionA.right.x} y2={junctionA.right.y} stroke={wall.stroke || (isSelected ? '#3b82f6' : '#1f2937')} strokeWidth={wall.strokeWidth || 2} strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
                        {nodeBIsEndpoint && <line x1={junctionB.left.x} y1={junctionB.left.y} x2={junctionB.right.x} y2={junctionB.right.y} stroke={wall.stroke || (isSelected ? '#3b82f6' : '#1f2937')} strokeWidth={wall.strokeWidth || 2} strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
                    </g>
                );
            })}
        </g>
    );
};

export default React.memo(WallRenderer);