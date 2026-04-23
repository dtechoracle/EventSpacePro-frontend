"use client";

import React, { useMemo, useCallback } from 'react';
import { Wall } from '@/store/projectStore';
import { calculateNodeJunctions, Point } from '@/utils/geometry';
import { useEditorStore } from '@/store/editorStore';
import { useProjectStore } from '@/store/projectStore';
import { calculateAllCutouts, getCutoutsForEdge, isCutoutAsset } from '@/utils/wallCutouts';
import * as polygonClipping from 'polygon-clipping';

interface WallRendererProps {
    wall: Wall;
    isSelected?: boolean;
    isHovered?: boolean;
    isHighlightOnly?: boolean;
}

type Ring = polygonClipping.Ring;
type MultiPolygon = polygonClipping.MultiPolygon;

const POSITION_TOLERANCE = 1;

const closeRing = (ring: Ring): Ring => {
    if (ring.length === 0) return ring;
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] === last[0] && first[1] === last[1]) return ring;
    return [...ring, [first[0], first[1]]];
};

const pointToPair = (point: Point): polygonClipping.Pair => [point.x, point.y];

const multiPolygonToPath = (multiPolygon: MultiPolygon): string => {
    return multiPolygon
        .map((polygon) => polygon
            .map((ring) => {
                if (ring.length === 0) return '';
                const [first, ...rest] = ring;
                return `M ${first[0]} ${first[1]} ${rest.map(([x, y]) => `L ${x} ${y}`).join(' ')} Z`;
            })
            .join(' '))
        .join(' ');
};

const getEdgeNodes = (wall: Wall, edge: Wall['edges'][number]) => {
    const nodeA = wall.nodes.find((node) => node.id === edge.nodeA);
    const nodeB = wall.nodes.find((node) => node.id === edge.nodeB);
    return nodeA && nodeB ? { nodeA, nodeB } : null;
};

const lineIntersection = (
    p1: Point,
    p2: Point,
    p3: Point,
    p4: Point
): { point: Point; t1: number; t2: number } | null => {
    const x1 = p1.x, y1 = p1.y;
    const x2 = p2.x, y2 = p2.y;
    const x3 = p3.x, y3 = p3.y;
    const x4 = p4.x, y4 = p4.y;
    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(denom) < 0.0001) return null;

    const t1 = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const t2 = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
    if (t1 < -0.001 || t1 > 1.001 || t2 < -0.001 || t2 > 1.001) return null;

    return {
        point: { x: x1 + t1 * (x2 - x1), y: y1 + t1 * (y2 - y1) },
        t1,
        t2,
    };
};

const collinearOverlap = (aStart: Point, aEnd: Point, bStart: Point, bEnd: Point) => {
    const dx = aEnd.x - aStart.x;
    const dy = aEnd.y - aStart.y;
    const lengthSq = dx * dx + dy * dy;
    const length = Math.sqrt(lengthSq);
    if (lengthSq < 0.0001) return null;

    const cross1 = Math.abs((bStart.x - aStart.x) * dy - (bStart.y - aStart.y) * dx) / length;
    const cross2 = Math.abs((bEnd.x - aStart.x) * dy - (bEnd.y - aStart.y) * dx) / length;
    if (cross1 > 0.5 || cross2 > 0.5) return null;

    const proj1 = ((bStart.x - aStart.x) * dx + (bStart.y - aStart.y) * dy) / lengthSq;
    const proj2 = ((bEnd.x - aStart.x) * dx + (bEnd.y - aStart.y) * dy) / lengthSq;
    const overlapStart = Math.max(0, Math.min(proj1, proj2));
    const overlapEnd = Math.min(1, Math.max(proj1, proj2));

    return overlapEnd - overlapStart > 0.01 ? { startT: overlapStart, endT: overlapEnd } : null;
};

const pointToSegmentDistance = (point: Point, start: Point, end: Point) => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq < 0.0001) return Math.hypot(point.x - start.x, point.y - start.y);

    const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq));
    const projected = {
        x: start.x + t * dx,
        y: start.y + t * dy,
    };

    return Math.hypot(point.x - projected.x, point.y - projected.y);
};

const segmentDistance = (aStart: Point, aEnd: Point, bStart: Point, bEnd: Point) => {
    if (lineIntersection(aStart, aEnd, bStart, bEnd)) return 0;

    return Math.min(
        pointToSegmentDistance(aStart, bStart, bEnd),
        pointToSegmentDistance(aEnd, bStart, bEnd),
        pointToSegmentDistance(bStart, aStart, aEnd),
        pointToSegmentDistance(bEnd, aStart, aEnd)
    );
};

const wallsTouchOrIntersect = (wallA: Wall, wallB: Wall) => {
    if (wallA.nodes.some((a) => wallB.nodes.some((b) => Math.hypot(a.x - b.x, a.y - b.y) <= POSITION_TOLERANCE))) {
        return true;
    }

    for (const edgeA of wallA.edges) {
        const pointsA = getEdgeNodes(wallA, edgeA);
        if (!pointsA) continue;
        for (const edgeB of wallB.edges) {
            const pointsB = getEdgeNodes(wallB, edgeB);
            if (!pointsB) continue;
            if (collinearOverlap(pointsA.nodeA, pointsA.nodeB, pointsB.nodeA, pointsB.nodeB)) return true;
            if (lineIntersection(pointsA.nodeA, pointsA.nodeB, pointsB.nodeA, pointsB.nodeB)) return true;

            const edgeSurfaceDistance = segmentDistance(pointsA.nodeA, pointsA.nodeB, pointsB.nodeA, pointsB.nodeB);
            const combinedHalfThickness = ((edgeA.thickness || 150) + (edgeB.thickness || 150)) / 2;
            if (edgeSurfaceDistance <= combinedHalfThickness + POSITION_TOLERANCE) return true;
        }
    }

    return false;
};

const getConnectedWallGroup = (seedWall: Wall, walls: Wall[]) => {
    const visited = new Set<string>([seedWall.id]);
    const queue = [seedWall];

    while (queue.length > 0) {
        const current = queue.shift()!;
        walls.forEach((candidate) => {
            if (visited.has(candidate.id)) return;
            if (!wallsTouchOrIntersect(current, candidate)) return;
            visited.add(candidate.id);
            queue.push(candidate);
        });
    }

    return walls.filter((entry) => visited.has(entry.id));
};

const getWallEdgePolygons = (targetWall: Wall, groupWalls: Wall[]) => {
    const localNodeMap = new Map(targetWall.nodes.map((node) => [node.id, node]));
    const nodeEdges = new Map<string, Array<{ id: string; otherNode: Point; thickness: number }>>();

    const processEdges = (sourceWall: Wall) => {
        const sourceNodeMap = new Map(sourceWall.nodes.map((node) => [node.id, node]));

        sourceWall.edges.forEach((edge) => {
            const nodeA = sourceNodeMap.get(edge.nodeA);
            const nodeB = sourceNodeMap.get(edge.nodeB);
            if (!nodeA || !nodeB) return;

            const localA = targetWall.nodes.find((node) => Math.hypot(node.x - nodeA.x, node.y - nodeA.y) <= POSITION_TOLERANCE);
            const localB = targetWall.nodes.find((node) => Math.hypot(node.x - nodeB.x, node.y - nodeB.y) <= POSITION_TOLERANCE);
            if (!localA && !localB) return;

            const thickness = edge.thickness || 150;
            if (localA) {
                if (!nodeEdges.has(localA.id)) nodeEdges.set(localA.id, []);
                if (!nodeEdges.get(localA.id)!.some((entry) => entry.id === edge.id)) {
                    nodeEdges.get(localA.id)!.push({ id: edge.id, otherNode: nodeB, thickness });
                }
            }
            if (localB) {
                if (!nodeEdges.has(localB.id)) nodeEdges.set(localB.id, []);
                if (!nodeEdges.get(localB.id)!.some((entry) => entry.id === edge.id)) {
                    nodeEdges.get(localB.id)!.push({ id: edge.id, otherNode: nodeA, thickness });
                }
            }
        });
    };

    groupWalls.forEach(processEdges);

    const junctions = new Map<string, Record<string, { left: Point; right: Point }>>();
    nodeEdges.forEach((connectedEdges, nodeId) => {
        const node = localNodeMap.get(nodeId);
        if (!node) return;
        junctions.set(nodeId, calculateNodeJunctions(node, connectedEdges));
    });

    return targetWall.edges
        .map((edge) => {
            const nodeA = localNodeMap.get(edge.nodeA);
            const nodeB = localNodeMap.get(edge.nodeB);
            if (!nodeA || !nodeB) return null;

            const junctionA = junctions.get(edge.nodeA)?.[edge.id];
            let junctionB = junctions.get(edge.nodeB)?.[edge.id];
            if (!junctionA || !junctionB) return null;
            junctionB = { left: junctionB.right, right: junctionB.left };

            const ring = closeRing([
                pointToPair(junctionA.left),
                pointToPair(junctionB.left),
                pointToPair(junctionB.right),
                pointToPair(junctionA.right),
            ]);

            return { wall: targetWall, edge, ring };
        })
        .filter((entry): entry is { wall: Wall; edge: Wall['edges'][number]; ring: Ring } => Boolean(entry));
};

const getWallEdgeRectPolygons = (targetWall: Wall) => {
    return targetWall.edges
        .map((edge) => {
            const points = getEdgeNodes(targetWall, edge);
            if (!points) return null;

            const dx = points.nodeB.x - points.nodeA.x;
            const dy = points.nodeB.y - points.nodeA.y;
            const length = Math.hypot(dx, dy);
            if (length < 0.0001) return null;

            const nx = -dy / length;
            const ny = dx / length;
            const halfThickness = (edge.thickness || 150) / 2;

            const ring = closeRing([
                [points.nodeA.x + nx * halfThickness, points.nodeA.y + ny * halfThickness],
                [points.nodeB.x + nx * halfThickness, points.nodeB.y + ny * halfThickness],
                [points.nodeB.x - nx * halfThickness, points.nodeB.y - ny * halfThickness],
                [points.nodeA.x - nx * halfThickness, points.nodeA.y - ny * halfThickness],
            ]);

            return { wall: targetWall, edge, ring };
        })
        .filter((entry): entry is { wall: Wall; edge: Wall['edges'][number]; ring: Ring } => Boolean(entry));
};

const getCutoutPolygonsForGroup = (groupWalls: Wall[], wallCutouts: ReturnType<typeof calculateAllCutouts>) => {
    const polygons: polygonClipping.Polygon[] = [];

    groupWalls.forEach((targetWall) => {
        targetWall.edges.forEach((edge) => {
            const points = getEdgeNodes(targetWall, edge);
            if (!points) return;

            const dx = points.nodeB.x - points.nodeA.x;
            const dy = points.nodeB.y - points.nodeA.y;
            const length = Math.hypot(dx, dy);
            if (length < 0.0001) return;

            const ux = dx / length;
            const uy = dy / length;
            const nx = -uy;
            const ny = ux;
            const halfThickness = (edge.thickness || 150) / 2 + 2;

            getCutoutsForEdge(targetWall.id, edge.id, wallCutouts).forEach((cutout) => {
                const startT = Math.max(0, cutout.startParam);
                const endT = Math.min(1, cutout.endParam);
                if (endT <= startT) return;

                const start = {
                    x: points.nodeA.x + ux * length * startT,
                    y: points.nodeA.y + uy * length * startT,
                };
                const end = {
                    x: points.nodeA.x + ux * length * endT,
                    y: points.nodeA.y + uy * length * endT,
                };

                polygons.push([closeRing([
                    [start.x + nx * halfThickness, start.y + ny * halfThickness],
                    [end.x + nx * halfThickness, end.y + ny * halfThickness],
                    [end.x - nx * halfThickness, end.y - ny * halfThickness],
                    [start.x - nx * halfThickness, start.y - ny * halfThickness],
                ])]);
            });
        });
    });

    return polygons;
};

const WallRenderer = ({ wall, isSelected = false, isHovered = false, isHighlightOnly = false }: WallRendererProps) => {
    const { nodes, edges } = wall;
    const selectedEdgeId = useEditorStore(s => s.selectedEdgeId);
    const setSelectedEdgeId = useEditorStore(s => s.setSelectedEdgeId);
    const selectedIds = useEditorStore(s => s.selectedIds);
    const hoveredId = useEditorStore(s => s.hoveredId);
    const currentDrawingWallId = useEditorStore(s => s.currentDrawingWallId);
    
    // Keep the store selector cheap; filtering every store update gets expensive with large asset counts.
    const assets = useProjectStore(s => s.assets);
    const cutoutAssets = useMemo(() => assets.filter(isCutoutAsset), [assets]);
    const allWalls = useProjectStore(s => s.walls);

    // Calculate all cutouts for doors/windows
    const wallCutouts = useMemo(() => {
        return calculateAllCutouts(cutoutAssets, allWalls);
    }, [cutoutAssets, allWalls]);

    const nodeMap = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

    const connectedWalls = useMemo(
        () => getConnectedWallGroup(wall, allWalls),
        [allWalls, wall]
    );
    const primaryWallId = useMemo(
        () => [...connectedWalls].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0) || a.id.localeCompare(b.id))[0]?.id,
        [connectedWalls]
    );
    const isPrimaryRenderer = wall.id === primaryWallId;

    const unionedWallSurface = useMemo(() => {
        if (!isPrimaryRenderer) return null;

        const stableWalls = currentDrawingWallId
            ? connectedWalls.filter((entry) => entry.id !== currentDrawingWallId)
            : connectedWalls;

        const wallPolygons = connectedWalls
            .flatMap((entry) => (
                entry.id === currentDrawingWallId
                    ? getWallEdgeRectPolygons(entry)
                    : getWallEdgePolygons(entry, stableWalls.length > 0 ? stableWalls : [entry])
            ))
            .map((entry) => [entry.ring] as polygonClipping.Polygon);

        if (wallPolygons.length === 0) return null;

        let surface = polygonClipping.union(wallPolygons[0], ...wallPolygons.slice(1));
        const cutoutPolygons = getCutoutPolygonsForGroup(connectedWalls, wallCutouts);
        if (cutoutPolygons.length > 0) {
            surface = polygonClipping.difference(surface, ...cutoutPolygons);
        }

        return surface;
    }, [connectedWalls, currentDrawingWallId, isPrimaryRenderer, wallCutouts]);

    // Handle edge double-click for selection
    const handleEdgeDoubleClick = useCallback((edgeId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedEdgeId(edgeId);
    }, [setSelectedEdgeId]);

    const groupSelected = isSelected || connectedWalls.some((entry) => selectedIds.includes(entry.id));
    const groupHovered = isHovered || connectedWalls.some((entry) => hoveredId === entry.id);
    const styleSource = connectedWalls.find((entry) => selectedIds.includes(entry.id))
        || connectedWalls.find((entry) => hoveredId === entry.id)
        || wall;
    const wallFill = (styleSource.fillType === 'texture' || styleSource.fillType === 'hatch' || styleSource.fillType === 'hash') && styleSource.fillTexture
        ? `url(#${styleSource.fillTexture}-scale-${styleSource.fillTextureScale || 1}-thick-${styleSource.fillTextureThickness || 1})`
        : (styleSource.fill || '#ffffff');
    const groupStrokeColor = styleSource.stroke || '#1f2937';
    const groupStrokeWidth = styleSource.strokeWidth !== undefined ? styleSource.strokeWidth : 2;

    return (
        <g className="wall" data-wall-id={wall.id} data-id={wall.id}>
            {isPrimaryRenderer && unionedWallSurface && (
                isHighlightOnly ? (
                    (groupSelected || groupHovered) && (
                        <path
                            d={multiPolygonToPath(unionedWallSurface)}
                            fill="#3b82f6"
                            fillOpacity={groupSelected ? 0.2 : 0.1}
                            stroke="none"
                            fillRule="evenodd"
                            pointerEvents="none"
                        />
                    )
                ) : (
                    <path
                        d={multiPolygonToPath(unionedWallSurface)}
                        fill={wallFill}
                        stroke={groupStrokeColor}
                        strokeWidth={groupStrokeWidth}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        vectorEffect="non-scaling-stroke"
                        fillRule="evenodd"
                    />
                )
            )}

            {/* Transparent per-wall hit lines remain separate so drawing/selection logic is untouched. */}
            {edges.map((edge) => {
                const nodeA = nodeMap.get(edge.nodeA);
                const nodeB = nodeMap.get(edge.nodeB);
                if (!nodeA || !nodeB) return null;
                const isEdgeSelected = selectedEdgeId === edge.id;

                return (
                    <g key={edge.id} onDoubleClick={(e) => handleEdgeDoubleClick(edge.id, e)}>
                        {isHighlightOnly && isEdgeSelected && (
                            <line
                                x1={nodeA.x}
                                y1={nodeA.y}
                                x2={nodeB.x}
                                y2={nodeB.y}
                                stroke="#3b82f6"
                                strokeWidth={(edge.thickness || 150)}
                                strokeOpacity={0.22}
                                strokeLinecap="round"
                                pointerEvents="none"
                            />
                        )}

                        {/* Rendering interaction lines (transparent but wide for clicking) */}
                        {!isHighlightOnly && <line x1={nodeA.x} y1={nodeA.y} x2={nodeB.x} y2={nodeB.y} stroke="transparent" strokeWidth={20} style={{ cursor: 'pointer' }} />}
                    </g>
                );
            })}
        </g>
    );
};

export default React.memo(WallRenderer);
