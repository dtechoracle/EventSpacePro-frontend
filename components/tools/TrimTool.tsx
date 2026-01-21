import React, { useState, useCallback, useEffect } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { useProjectStore, Shape } from '@/store/projectStore';
import toast from 'react-hot-toast';

interface TrimToolProps {
    isActive: boolean;
}

export default function TrimTool({ isActive }: TrimToolProps) {
    const { canvasOffset, zoom, panX, panY } = useEditorStore();
    const { shapes, walls, updateShape, addShape, removeShape, saveToHistory, getNextZIndex } = useProjectStore();

    const [cuttingLine, setCuttingLine] = useState<{ start: { x: number; y: number }, end: { x: number; y: number } } | null>(null);
    const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
    const [currentPoint, setCurrentPoint] = useState<{ x: number; y: number } | null>(null);

    // Screen to world conversion
    const screenToWorld = useCallback((screenX: number, screenY: number) => {
        const x = screenX - canvasOffset.left;
        const y = screenY - canvasOffset.top;
        return {
            x: (x - panX) / zoom,
            y: (y - panY) / zoom,
        };
    }, [canvasOffset, zoom, panX, panY]);

    const handleMouseDown = useCallback((e: MouseEvent) => {
        if (!isActive || e.button !== 0) return;

        const target = e.target as Element | null;
        if (!target || !target.closest('svg[data-workspace-root="true"]')) return;

        const worldPos = screenToWorld(e.clientX, e.clientY);
        setStartPoint(worldPos);
        setCurrentPoint(worldPos);
    }, [isActive, screenToWorld]);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isActive || !startPoint) return;

        const worldPos = screenToWorld(e.clientX, e.clientY);
        setCurrentPoint(worldPos);
    }, [isActive, startPoint, screenToWorld]);

    const handleMouseUp = useCallback((e: MouseEvent) => {
        if (!isActive || !startPoint || !currentPoint) return;

        const target = e.target as Element | null;
        if (!target || !target.closest('svg[data-workspace-root="true"]')) {
            setStartPoint(null);
            setCurrentPoint(null);
            return;
        }

        // Find shapes that intersect with the cutting line
        const cutLine = { start: startPoint, end: currentPoint };
        const shapesToCut = shapes.filter(shape => {
            // Check if shape intersects with cutting line
            return doesLineIntersectShape(cutLine, shape);
        });

        // Check for walls (not yet supported but notify user)
        const wallsToCut = walls.filter(wall => {
            // Simple check if line intersects any wall edge
            return wall.edges.some(edge => {
                const n1 = wall.nodes.find(n => n.id === edge.nodeA);
                const n2 = wall.nodes.find(n => n.id === edge.nodeB);
                if (!n1 || !n2) return false;
                return lineSegmentsIntersect(cutLine.start, cutLine.end, n1, n2);
            });
        });

        if (wallsToCut.length > 0) {
            saveToHistory();

            wallsToCut.forEach(wall => {
                // Find the edge that intersects
                const edgeToSplit = wall.edges.find(edge => {
                    const n1 = wall.nodes.find(n => n.id === edge.nodeA);
                    const n2 = wall.nodes.find(n => n.id === edge.nodeB);
                    if (!n1 || !n2) return false;
                    return lineSegmentsIntersect(cutLine.start, cutLine.end, n1, n2);
                });

                if (edgeToSplit) {
                    const n1 = wall.nodes.find(n => n.id === edgeToSplit.nodeA)!;
                    const n2 = wall.nodes.find(n => n.id === edgeToSplit.nodeB)!;

                    // Calculate intersection point
                    const intersection = getLineIntersection(cutLine.start, cutLine.end, n1, n2);

                    if (intersection) {
                        // Create TWO new nodes at intersection to physically separate the graph
                        const newNodeId1 = `node-${Date.now()}-1-${Math.random().toString(36).substr(2, 9)}`;
                        const newNodeId2 = `node-${Date.now()}-2-${Math.random().toString(36).substr(2, 9)}`;

                        const newNode1 = { id: newNodeId1, x: intersection.x, y: intersection.y };
                        const newNode2 = { id: newNodeId2, x: intersection.x, y: intersection.y };

                        // Create two new edges connecting to the separate nodes
                        const edge1 = {
                            id: `edge-${Date.now()}-1`,
                            nodeA: edgeToSplit.nodeA,
                            nodeB: newNodeId1,
                            thickness: edgeToSplit.thickness
                        };

                        const edge2 = {
                            id: `edge-${Date.now()}-2`,
                            nodeA: newNodeId2,
                            nodeB: edgeToSplit.nodeB,
                            thickness: edgeToSplit.thickness
                        };

                        // Update wall structure: remove old edge, add new nodes and edges
                        // We remove the old edge connecting A-B.
                        // We add A-M1 and M2-B.
                        // Now A and B are disconnected (unless there's another path).

                        const updatedNodes = [...wall.nodes, newNode1, newNode2];
                        const updatedEdges = wall.edges.filter(e => e.id !== edgeToSplit.id).concat([edge1, edge2]);

                        // Now we need to check if the graph is disconnected.
                        // Run BFS/DFS from one of the nodes (e.g. edgeToSplit.nodeA)

                        const visited = new Set<string>();
                        const queue = [edgeToSplit.nodeA];
                        visited.add(edgeToSplit.nodeA);

                        const componentNodes = new Set<string>();
                        const componentEdges = new Set<string>();

                        while (queue.length > 0) {
                            const nodeId = queue.shift()!;
                            componentNodes.add(nodeId);

                            // Find connected edges
                            const connectedEdges = updatedEdges.filter(e => e.nodeA === nodeId || e.nodeB === nodeId);
                            connectedEdges.forEach(e => {
                                componentEdges.add(e.id);
                                const neighbor = e.nodeA === nodeId ? e.nodeB : e.nodeA;
                                if (!visited.has(neighbor)) {
                                    visited.add(neighbor);
                                    queue.push(neighbor);
                                }
                            });
                        }

                        // If we didn't visit all nodes, we have a split!
                        const allNodeIds = updatedNodes.map(n => n.id);
                        const unvisitedNodes = allNodeIds.filter(id => !visited.has(id));

                        if (unvisitedNodes.length > 0) {
                            // SPLIT DETECTED: Create two walls

                            // Wall 1: Visited component
                            const wall1Nodes = updatedNodes.filter(n => visited.has(n.id));
                            const wall1Edges = updatedEdges.filter(e => componentEdges.has(e.id));

                            // Wall 2: Unvisited component
                            const wall2Nodes = updatedNodes.filter(n => !visited.has(n.id));
                            const wall2Edges = updatedEdges.filter(e => !componentEdges.has(e.id));

                            // Update original wall to become Wall 1
                            useProjectStore.getState().updateWall(wall.id, {
                                nodes: wall1Nodes,
                                edges: wall1Edges,
                                isClosed: false // Splitting always opens a closed loop if it was one, or keeps it open
                            });

                            // Create new Wall 2
                            const newWallId = `wall-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                            useProjectStore.getState().addWall({
                                id: newWallId,
                                nodes: wall2Nodes,
                                edges: wall2Edges,
                                // We don't have a wall-level thickness, so we can't set it here if addWall expects it.
                                // However, addWall in projectStore might expect it if the store handles it.
                                // Looking at projectStore, addWall takes a Wall object.
                                // But wait, Wall type definition doesn't have thickness.
                                // Let's check addWall implementation.
                                // If Wall doesn't have thickness, we shouldn't pass it.
                                // But edges have thickness.
                                // So we just pass the edges which already have thickness.
                                // Wait, the error was: "Object literal may only specify known properties, and 'thickness' does not exist in type 'Wall'".
                                // So we should just REMOVE 'thickness' from here.
                                isClosed: false,
                                zIndex: getNextZIndex(),
                                fill: wall.fill // Preserve fill
                            });

                            toast.success('Wall separated!', { icon: '✂️' });
                        } else {
                            // NO SPLIT (Loop opened): Just update the single wall
                            // If it was closed, it's now open because we introduced a gap (M1 != M2)
                            // Actually, if we want to just "cut" a loop, we probably want M1 and M2 to be the SAME node if we want to keep it connected but add a joint.
                            // BUT the user asked for "split".
                            // If I cut a closed loop ring, it becomes a 'C' shape. It is still one component.
                            // But physically it should be open at the cut point.
                            // My logic created M1 and M2. So there is a gap at M.
                            // So it is now an open chain.

                            useProjectStore.getState().updateWall(wall.id, {
                                nodes: updatedNodes,
                                edges: updatedEdges,
                                isClosed: false
                            });

                            toast.success('Wall cut (loop opened)!', { icon: 'Cx' });
                        }
                    }
                }
            });
        }

        if (shapesToCut.length > 0) {
            saveToHistory();

            shapesToCut.forEach(shape => {
                // Convert shape to polygon points if needed
                let shapePoints: Array<{ x: number; y: number }> = [];

                if (shape.points && shape.points.length >= 2) {
                    // Already has points (polyline/polygon)
                    shapePoints = shape.points.map(p => ({ x: shape.x + p.x, y: shape.y + p.y }));
                } else if (shape.type === 'rectangle') {
                    // Convert rectangle to 4 points
                    const halfW = shape.width / 2;
                    const halfH = shape.height / 2;
                    const rot = (shape.rotation || 0) * (Math.PI / 180);
                    const cosR = Math.cos(rot);
                    const sinR = Math.sin(rot);
                    shapePoints = [
                        { x: shape.x - halfW * cosR + halfH * sinR, y: shape.y - halfW * sinR - halfH * cosR },
                        { x: shape.x + halfW * cosR + halfH * sinR, y: shape.y + halfW * sinR - halfH * cosR },
                        { x: shape.x + halfW * cosR - halfH * sinR, y: shape.y + halfW * sinR + halfH * cosR },
                        { x: shape.x - halfW * cosR - halfH * sinR, y: shape.y - halfW * sinR + halfH * cosR },
                    ];
                } else if (shape.type === 'ellipse') {
                    // Convert ellipse to polygon (approximate with 32 points)
                    const halfW = shape.width / 2;
                    const halfH = shape.height / 2;
                    const rot = (shape.rotation || 0) * (Math.PI / 180);
                    const cosR = Math.cos(rot);
                    const sinR = Math.sin(rot);
                    for (let i = 0; i < 32; i++) {
                        const angle = (i / 32) * Math.PI * 2;
                        const localX = Math.cos(angle) * halfW;
                        const localY = Math.sin(angle) * halfH;
                        shapePoints.push({
                            x: shape.x + localX * cosR - localY * sinR,
                            y: shape.y + localX * sinR + localY * cosR,
                        });
                    }
                } else {
                    // For other types, skip
                    return;
                }

                // Find intersection points
                const intersections: Array<{ point: { x: number; y: number }, segmentIndex: number }> = [];
                for (let i = 0; i < shapePoints.length; i++) {
                    const p1 = shapePoints[i];
                    const p2 = shapePoints[(i + 1) % shapePoints.length];
                    const intersection = getLineIntersection(cutLine.start, cutLine.end, p1, p2);
                    if (intersection) {
                        intersections.push({ point: intersection, segmentIndex: i });
                    }
                }

                // Need at least 2 intersection points to split
                if (intersections.length >= 2) {
                    // Sort intersections by segment index and position along segment
                    const sorted = [...intersections].sort((a, b) => {
                        if (a.segmentIndex !== b.segmentIndex) return a.segmentIndex - b.segmentIndex;
                        const segStart = shapePoints[a.segmentIndex];
                        const segEnd = shapePoints[(a.segmentIndex + 1) % shapePoints.length];
                        const distA = Math.hypot(a.point.x - segStart.x, a.point.y - segStart.y);
                        const distB = Math.hypot(b.point.x - segStart.x, b.point.y - segStart.y);
                        return distA - distB;
                    });

                    // Use first 2 intersections to split
                    const int1 = sorted[0];
                    const int2 = sorted[1];

                    // Create two new shapes from the split
                    const shape1Points: Array<{ x: number; y: number }> = [];
                    const shape2Points: Array<{ x: number; y: number }> = [];

                    // Build first shape: from int1, around to int2
                    shape1Points.push({ x: int1.point.x - shape.x, y: int1.point.y - shape.y });
                    let i = int1.segmentIndex;
                    while (true) {
                        i = (i + 1) % shapePoints.length;
                        const p = shapePoints[i];
                        shape1Points.push({ x: p.x - shape.x, y: p.y - shape.y });
                        if (i === int2.segmentIndex) break;
                    }
                    shape1Points.push({ x: int2.point.x - shape.x, y: int2.point.y - shape.y });

                    // Build second shape: from int2, around to int1
                    shape2Points.push({ x: int2.point.x - shape.x, y: int2.point.y - shape.y });
                    i = int2.segmentIndex;
                    while (true) {
                        i = (i + 1) % shapePoints.length;
                        const p = shapePoints[i];
                        shape2Points.push({ x: p.x - shape.x, y: p.y - shape.y });
                        if (i === int1.segmentIndex) break;
                    }
                    shape2Points.push({ x: int1.point.x - shape.x, y: int1.point.y - shape.y });

                    // Calculate centers and bounds for new shapes
                    const calcCenter = (pts: Array<{ x: number; y: number }>) => {
                        const xs = pts.map(p => p.x);
                        const ys = pts.map(p => p.y);
                        return {
                            x: (Math.min(...xs) + Math.max(...xs)) / 2,
                            y: (Math.min(...ys) + Math.max(...ys)) / 2,
                            width: Math.max(...xs) - Math.min(...xs),
                            height: Math.max(...ys) - Math.min(...ys),
                        };
                    };

                    const center1 = calcCenter(shape1Points.map(p => ({ x: shape.x + p.x, y: shape.y + p.y })));
                    const center2 = calcCenter(shape2Points.map(p => ({ x: shape.x + p.x, y: shape.y + p.y })));

                    const relPoints1 = shape1Points.map(p => ({ x: p.x - (center1.x - shape.x), y: p.y - (center1.y - shape.y) }));
                    const relPoints2 = shape2Points.map(p => ({ x: p.x - (center2.x - shape.x), y: p.y - (center2.y - shape.y) }));

                    // Keep original shape and add sliced parts as separate polygons
                    const newShape1: Shape = {
                        ...shape,
                        id: crypto.randomUUID(),
                        type: 'polygon',
                        x: center1.x,
                        y: center1.y,
                        width: center1.width,
                        height: center1.height,
                        points: relPoints1,
                        rotation: 0,
                        zIndex: getNextZIndex(),
                    };

                    const newShape2: Shape = {
                        ...shape,
                        id: crypto.randomUUID(),
                        type: 'polygon',
                        x: center2.x,
                        y: center2.y,
                        width: center2.width,
                        height: center2.height,
                        points: relPoints2,
                        rotation: 0,
                        zIndex: getNextZIndex(),
                    };

                    // Keep the original shape and add the sliced parts
                    addShape(newShape1);
                    addShape(newShape2);
                    removeShape(shape.id); // Remove the original shape

                    toast.success(`Sliced shape into 2 parts`);
                } else if (intersections.length === 1) {
                    toast.error('Slice line must intersect shape at 2 points');
                }
            });
        }

        setStartPoint(null);
        setCurrentPoint(null);
    }, [isActive, startPoint, currentPoint, shapes, saveToHistory, removeShape, addShape, getNextZIndex]);

    useEffect(() => {
        if (isActive) {
            window.addEventListener('mousedown', handleMouseDown);
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            // Set a knife-like cursor (crosshair) while trim tool is active
            document.body.style.cursor = 'crosshair';
        }
        return () => {
            window.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
        };
    }, [isActive, handleMouseDown, handleMouseMove, handleMouseUp]);

    // Render cutting line preview
    if (!isActive || !startPoint || !currentPoint) return null;

    return (
        <g className="trim-tool-overlay" style={{ pointerEvents: 'none' }}>
            <line
                x1={startPoint.x}
                y1={startPoint.y}
                x2={currentPoint.x}
                y2={currentPoint.y}
                stroke="#ff0000"
                strokeWidth={3}
                strokeDasharray="10,5"
                opacity={0.8}
                vectorEffect="non-scaling-stroke"
            />
        </g>
    );
}

// Helper functions for intersection detection and splitting
function doesLineIntersectShape(line: { start: { x: number; y: number }, end: { x: number; y: number } }, shape: Shape): boolean {
    // Get shape points (convert if needed)
    let worldPoints: Array<{ x: number; y: number }> = [];

    if (shape.points && shape.points.length >= 2) {
        worldPoints = shape.points.map(p => ({ x: p.x + shape.x, y: p.y + shape.y }));
    } else if (shape.type === 'rectangle') {
        const halfW = shape.width / 2;
        const halfH = shape.height / 2;
        const rot = (shape.rotation || 0) * (Math.PI / 180);
        const cosR = Math.cos(rot);
        const sinR = Math.sin(rot);
        worldPoints = [
            { x: shape.x - halfW * cosR + halfH * sinR, y: shape.y - halfW * sinR - halfH * cosR },
            { x: shape.x + halfW * cosR + halfH * sinR, y: shape.y + halfW * sinR - halfH * cosR },
            { x: shape.x + halfW * cosR - halfH * sinR, y: shape.y + halfW * sinR + halfH * cosR },
            { x: shape.x - halfW * cosR - halfH * sinR, y: shape.y - halfW * sinR + halfH * cosR },
        ];
    } else if (shape.type === 'ellipse') {
        const halfW = shape.width / 2;
        const halfH = shape.height / 2;
        const rot = (shape.rotation || 0) * (Math.PI / 180);
        const cosR = Math.cos(rot);
        const sinR = Math.sin(rot);
        for (let i = 0; i < 32; i++) {
            const angle = (i / 32) * Math.PI * 2;
            const localX = Math.cos(angle) * halfW;
            const localY = Math.sin(angle) * halfH;
            worldPoints.push({
                x: shape.x + localX * cosR - localY * sinR,
                y: shape.y + localX * sinR + localY * cosR,
            });
        }
    } else {
        return false;
    }

    if (worldPoints.length < 2) return false;

    // Check if line intersects any edge of the shape
    for (let i = 0; i < worldPoints.length; i++) {
        const p1 = worldPoints[i];
        const p2 = worldPoints[(i + 1) % worldPoints.length];

        if (lineSegmentsIntersect(line.start, line.end, p1, p2)) {
            return true;
        }
    }

    return false;
}

function findIntersectionPoints(line: { start: { x: number; y: number }, end: { x: number; y: number } }, shape: Shape): Array<{ point: { x: number; y: number }, segmentIndex: number }> {
    const intersections: Array<{ point: { x: number; y: number }, segmentIndex: number }> = [];

    if (!shape.points || shape.points.length < 2) return intersections;

    const worldPoints = shape.points.map(p => ({ x: p.x + shape.x, y: p.y + shape.y }));

    for (let i = 0; i < worldPoints.length; i++) {
        const p1 = worldPoints[i];
        const p2 = worldPoints[(i + 1) % worldPoints.length];

        const intersection = getLineIntersection(line.start, line.end, p1, p2);
        if (intersection) {
            intersections.push({ point: intersection, segmentIndex: i });
        }
    }

    return intersections;
}

function splitShapeAtPoints(shape: Shape, intersections: Array<{ point: { x: number; y: number }, segmentIndex: number }>): Shape[] {
    if (!shape.points || intersections.length < 2) return [shape];

    // Sort intersections by segment index
    const sorted = [...intersections].sort((a, b) => a.segmentIndex - b.segmentIndex);

    // Create two new shapes from the split
    const shape1Points: Array<{ x: number; y: number }> = [];
    const shape2Points: Array<{ x: number; y: number }> = [];

    // Add points for first shape (from first intersection to second)
    for (let i = 0; i <= sorted[0].segmentIndex; i++) {
        shape1Points.push(shape.points[i]);
    }
    shape1Points.push({ x: sorted[0].point.x - shape.x, y: sorted[0].point.y - shape.y });
    shape1Points.push({ x: sorted[1].point.x - shape.x, y: sorted[1].point.y - shape.y });
    for (let i = sorted[1].segmentIndex + 1; i < shape.points.length; i++) {
        shape1Points.push(shape.points[i]);
    }

    // Add points for second shape (between intersections)
    shape2Points.push({ x: sorted[0].point.x - shape.x, y: sorted[0].point.y - shape.y });
    for (let i = sorted[0].segmentIndex + 1; i <= sorted[1].segmentIndex; i++) {
        shape2Points.push(shape.points[i]);
    }
    shape2Points.push({ x: sorted[1].point.x - shape.x, y: sorted[1].point.y - shape.y });

    return [
        { ...shape, points: shape1Points },
        { ...shape, points: shape2Points }
    ];
}

function lineSegmentsIntersect(p1: { x: number; y: number }, p2: { x: number; y: number }, p3: { x: number; y: number }, p4: { x: number; y: number }): boolean {
    const det = (p2.x - p1.x) * (p4.y - p3.y) - (p4.x - p3.x) * (p2.y - p1.y);
    if (Math.abs(det) < 1e-10) return false; // Parallel lines

    const t = ((p3.x - p1.x) * (p4.y - p3.y) - (p4.x - p3.x) * (p3.y - p1.y)) / det;
    const u = -((p1.x - p2.x) * (p1.y - p3.y) - (p1.y - p2.y) * (p1.x - p3.x)) / det;

    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

function getLineIntersection(p1: { x: number; y: number }, p2: { x: number; y: number }, p3: { x: number; y: number }, p4: { x: number; y: number }): { x: number; y: number } | null {
    const det = (p2.x - p1.x) * (p4.y - p3.y) - (p4.x - p3.x) * (p2.y - p1.y);
    if (Math.abs(det) < 1e-10) return null;

    const t = ((p3.x - p1.x) * (p4.y - p3.y) - (p4.x - p3.x) * (p3.y - p1.y)) / det;
    const u = -((p1.x - p2.x) * (p1.y - p3.y) - (p1.y - p2.y) * (p1.x - p3.x)) / det;

    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
        return {
            x: p1.x + t * (p2.x - p1.x),
            y: p1.y + t * (p2.y - p1.y)
        };
    }

    return null;
}
