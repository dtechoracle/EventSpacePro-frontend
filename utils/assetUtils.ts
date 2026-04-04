import { Asset, Shape } from "@/store/projectStore";
import { ASSET_LIBRARY } from "@/lib/assets";

export async function convertAssetToShapes(asset: Asset): Promise<Shape[]> {
    const def = ASSET_LIBRARY.find(a => a.id === asset.type);
    if (!def) return [];

    if (typeof window === 'undefined') return [];

    try {
        const response = await fetch(def.path);
        const text = await response.text();

        if (typeof DOMParser === 'undefined') return [];
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, "image/svg+xml");
        const svg = doc.querySelector("svg");
        if (!svg) return [];

        const shapes: Shape[] = [];
        const viewBox = svg.getAttribute("viewBox")?.split(/\s+/).map(Number) || [0, 0, 100, 100];
        const [vbX, vbY, vbW, vbH] = viewBox;

        // Scale factors
        const scaleX = (asset.width * asset.scale) / vbW;
        const scaleY = (asset.height * asset.scale) / vbH;

        // Center of the asset in world coordinates
        const cx = asset.x;
        const cy = asset.y;

        // Rotation
        const rad = (asset.rotation * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        const transformPoint = (x: number, y: number) => {
            // 1. Normalize to 0-based (remove viewBox offset)
            const nx = (x - vbX) * scaleX;
            const ny = (y - vbY) * scaleY;

            // 2. Center relative to asset center (asset is drawn from center usually? No, SVG is usually 0,0 top-left)
            // But our Asset object has x,y as center.
            // So we need to offset by half width/height
            const ox = nx - (asset.width * asset.scale) / 2;
            const oy = ny - (asset.height * asset.scale) / 2;

            // 3. Rotate
            const rx = ox * cos - oy * sin;
            const ry = ox * sin + oy * cos;

            // 4. Translate to asset position
            return {
                x: cx + rx,
                y: cy + ry
            };
        };

        const processElement = (el: Element) => {
            const type = el.tagName.toLowerCase();
            const id = `shape-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const stroke = el.getAttribute("stroke") || asset.strokeColor || "#000000";
            const strokeWidth = parseFloat(el.getAttribute("stroke-width") || "1");
            const fill = el.getAttribute("fill") || asset.fillColor || "transparent";

            if (type === "rect") {
                const x = parseFloat(el.getAttribute("x") || "0");
                const y = parseFloat(el.getAttribute("y") || "0");
                const w = parseFloat(el.getAttribute("width") || "0");
                const h = parseFloat(el.getAttribute("height") || "0");

                // Transform center
                const center = transformPoint(x + w / 2, y + h / 2);

                shapes.push({
                    id,
                    type: "rectangle",
                    x: center.x,
                    y: center.y,
                    width: w * scaleX,
                    height: h * scaleY,
                    rotation: asset.rotation, // Inherit rotation + any local rotation (ignored for now)
                    fill,
                    stroke,
                    strokeWidth,
                    zIndex: asset.zIndex,
                    sourceAssetId: asset.id
                });
            } else if (type === "circle" || type === "ellipse") {
                const cxVal = parseFloat(el.getAttribute("cx") || "0");
                const cyVal = parseFloat(el.getAttribute("cy") || "0");
                const rx = parseFloat(el.getAttribute("r") || el.getAttribute("rx") || "0");
                const ry = parseFloat(el.getAttribute("r") || el.getAttribute("ry") || "0");

                const center = transformPoint(cxVal, cyVal);

                shapes.push({
                    id,
                    type: "ellipse",
                    x: center.x,
                    y: center.y,
                    width: rx * 2 * scaleX,
                    height: ry * 2 * scaleY,
                    rotation: asset.rotation,
                    fill,
                    stroke,
                    strokeWidth,
                    zIndex: asset.zIndex,
                    sourceAssetId: asset.id
                });
            } else if (type === "line") {
                const x1 = parseFloat(el.getAttribute("x1") || "0");
                const y1 = parseFloat(el.getAttribute("y1") || "0");
                const x2 = parseFloat(el.getAttribute("x2") || "0");
                const y2 = parseFloat(el.getAttribute("y2") || "0");

                const p1 = transformPoint(x1, y1);
                const p2 = transformPoint(x2, y2);

                // Create line shape
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const len = Math.sqrt(dx * dx + dy * dy);
                const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                const midX = (p1.x + p2.x) / 2;
                const midY = (p1.y + p2.y) / 2;

                shapes.push({
                    id,
                    type: "line",
                    x: midX,
                    y: midY,
                    width: len,
                    height: 2,
                    rotation: angle,
                    fill: "transparent",
                    stroke,
                    strokeWidth,
                    zIndex: asset.zIndex,
                    sourceAssetId: asset.id
                });
            } else if (type === "polyline" || type === "polygon") {
                const pointsStr = el.getAttribute("points") || "";
                const rawPoints = pointsStr.trim().split(/\s+|,/).map(Number);
                const points: { x: number; y: number }[] = [];
                for (let i = 0; i < rawPoints.length; i += 2) {
                    points.push(transformPoint(rawPoints[i], rawPoints[i + 1]));
                }

                if (points.length < 2) return;

                // Calculate bounding box of transformed points
                const xs = points.map(p => p.x);
                const ys = points.map(p => p.y);
                const minX = Math.min(...xs);
                const maxX = Math.max(...xs);
                const minY = Math.min(...ys);
                const maxY = Math.max(...ys);
                const cX = (minX + maxX) / 2;
                const cY = (minY + maxY) / 2;
                const w = maxX - minX;
                const h = maxY - minY;

                // Relative points
                const relPoints = points.map(p => ({ x: p.x - cX, y: p.y - cY }));

                shapes.push({
                    id,
                    type: type === "polygon" ? "polygon" : "line", // polyline becomes line with points
                    x: cX,
                    y: cY,
                    width: w,
                    height: h,
                    rotation: 0, // Points are already rotated
                    fill: type === "polygon" ? fill : "transparent",
                    stroke,
                    strokeWidth,
                    points: relPoints,
                    zIndex: asset.zIndex,
                    sourceAssetId: asset.id
                });
            }

            if (type === "path") {
                const d = el.getAttribute("d");
                if (d) {
                    try {
                        const tempPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
                        tempPath.setAttribute("d", d);

                        const len = tempPath.getTotalLength();
                        // Adaptive sampling: more points for longer paths, but capped
                        const numPoints = Math.min(Math.max(Math.floor(len / 5), 20), 100);
                        const points: { x: number; y: number }[] = [];

                        for (let i = 0; i < numPoints; i++) {
                            const pt = tempPath.getPointAtLength((i / numPoints) * len);
                            points.push(transformPoint(pt.x, pt.y));
                        }
                        // Close the loop
                        const start = points[0];
                        const end = points[points.length - 1];
                        if (Math.hypot(start.x - end.x, start.y - end.y) > 1) {
                            points.push(start);
                        }

                        // Calculate bounding box
                        const xs = points.map(p => p.x);
                        const ys = points.map(p => p.y);
                        const minX = Math.min(...xs);
                        const maxX = Math.max(...xs);
                        const minY = Math.min(...ys);
                        const maxY = Math.max(...ys);
                        const cX = (minX + maxX) / 2;
                        const cY = (minY + maxY) / 2;
                        const w = maxX - minX;
                        const h = maxY - minY;

                        const relPoints = points.map(p => ({ x: p.x - cX, y: p.y - cY }));

                        shapes.push({
                            id,
                            type: "polygon",
                            x: cX,
                            y: cY,
                            width: w,
                            height: h,
                            rotation: 0,
                            fill,
                            stroke,
                            strokeWidth,
                            points: relPoints,
                            zIndex: asset.zIndex,
                            sourceAssetId: asset.id
                        });
                    } catch (err) {
                        console.warn("Failed to parse path", err);
                    }
                }
            }
        };

        // Process direct children
        Array.from(svg.children).forEach(processElement);

        // Also check groups <g>
        svg.querySelectorAll("g").forEach(g => {
            Array.from(g.children).forEach(processElement);
        });

        return shapes;
    } catch (e) {
        console.error("Failed to convert asset", e);
        return [];
    }
}

/**
 * Extract vertices from an SVG path string 'd'.
 * This only handles simple L (LineTo) and M (MoveTo) commands which are common in these marquee SVGs.
 */
function extractPathPoints(d: string): { x: number; y: number }[] {
    const points: { x: number; y: number }[] = [];
    const segments = d.match(/[a-zA-Z][^a-zA-Z]*/g) || [];
    
    let lastX = 0;
    let lastY = 0;
    let startX = 0;
    let startY = 0;

    segments.forEach(seg => {
        const cmd = seg[0];
        let argsStr = seg.slice(1).trim();
        let args = argsStr ? argsStr.split(/[\s,]+/).map(Number).filter(n => !isNaN(n)) : [];

        const isRelative = cmd === cmd.toLowerCase();
        const type = cmd.toUpperCase();

        switch (type) {
            case 'M':
                for (let i = 0; i < args.length; i += 2) {
                    lastX = isRelative ? lastX + args[i] : args[i];
                    lastY = isRelative ? lastY + args[i+1] : args[i+1];
                    points.push({ x: lastX, y: lastY });
                    if (i === 0) { startX = lastX; startY = lastY; }
                }
                break;
            case 'L':
            case 'T':
                for (let i = 0; i < args.length; i += 2) {
                    lastX = isRelative ? lastX + args[i] : args[i];
                    lastY = isRelative ? lastY + args[i+1] : args[i+1];
                    points.push({ x: lastX, y: lastY });
                }
                break;
            case 'H':
                args.forEach(x => {
                    lastX = isRelative ? lastX + x : x;
                    points.push({ x: lastX, y: lastY });
                });
                break;
            case 'V':
                args.forEach(y => {
                    lastY = isRelative ? lastY + y : y;
                    points.push({ x: lastX, y: lastY });
                });
                break;
            case 'Z':
                lastX = startX;
                lastY = startY;
                points.push({ x: lastX, y: lastY });
                break;
            case 'C':
            case 'S':
                for (let i = 0; i < args.length; i += 6) {
                    lastX = isRelative ? lastX + (args[i+4] || 0) : (args[i+4] || 0);
                    lastY = isRelative ? lastY + (args[i+5] || 0) : (args[i+5] || 0);
                    points.push({ x: lastX, y: lastY });
                }
                break;
            case 'Q':
                for (let i = 0; i < args.length; i += 4) {
                    lastX = isRelative ? lastX + (args[i+2] || 0) : (args[i+2] || 0);
                    lastY = isRelative ? lastY + (args[i+3] || 0) : (args[i+3] || 0);
                    points.push({ x: lastX, y: lastY });
                }
                break;
        }
    });

    return points;
}
/**
 * Get all vertices from an asset's SVG for snapping
 */
export async function getAssetVertices(asset: Asset): Promise<{ x: number; y: number }[]> {
    const def = ASSET_LIBRARY.find(a => a.id === asset.type);
    if (!def) return [];

    if (typeof window === 'undefined') return [];

    try {
        const response = await fetch(def.path);
        const text = await response.text();

        const parser = new DOMParser();
        const doc = parser.parseFromString(text, "image/svg+xml");
        const svg = doc.querySelector("svg");
        if (!svg) return [];

        const viewBox = svg.getAttribute("viewBox")?.split(/\s+/).map(Number) || [0, 0, 100, 100];
        const [vbX, vbY, vbW, vbH] = viewBox;

        const scaleX = (asset.width * asset.scale) / vbW;
        const scaleY = (asset.height * asset.scale) / vbH;
        const cx = asset.x;
        const cy = asset.y;
        const rad = (asset.rotation * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        const transformPoint = (x: number, y: number) => {
            const nx = (x - vbX) * scaleX;
            const ny = (y - vbY) * scaleY;
            const ox = nx - (asset.width * asset.scale) / 2;
            const oy = ny - (asset.height * asset.scale) / 2;
            const rx = ox * cos - oy * sin;
            const ry = ox * sin + oy * cos;
            return { x: cx + rx, y: cy + ry };
        };

        const vertices: { x: number; y: number }[] = [];
        const OFFSET = 100; // 100mm offset for inner/outer snap points

        const transformWithOffset = (x: number, y: number, offsetX: number = 0, offsetY: number = 0) => {
            const nx = (x - vbX) * scaleX + offsetX;
            const ny = (y - vbY) * scaleY + offsetY;
            const ox = nx - (asset.width * asset.scale) / 2;
            const oy = ny - (asset.height * asset.scale) / 2;
            const rx = ox * cos - oy * sin;
            const ry = ox * sin + oy * cos;
            return { x: cx + rx, y: cy + ry };
        };

        const processEl = (el: Element) => {
            if (el.closest('defs') || el.closest('clipPath')) return;

            const type = el.tagName.toLowerCase();
            
            // Helper to add a base point and its offsets if it's a Marquee
            const addPointAndOffsets = (x: number, y: number) => {
                vertices.push(transformWithOffset(x, y));
                if (def.category === 'Marquee') {
                    vertices.push(transformWithOffset(x, y, OFFSET, 0));
                    vertices.push(transformWithOffset(x, y, -OFFSET, 0));
                    vertices.push(transformWithOffset(x, y, 0, OFFSET));
                    vertices.push(transformWithOffset(x, y, 0, -OFFSET));
                }
            };
            
            // Helper to interpolate midpoints and quarter-points for segments
            const addInterpolatedSegments = (p1: {x: number, y: number}, p2: {x: number, y: number}) => {
                // Calculate physical distance on the canvas by applying SVG-to-world scales
                const physicalDist = Math.hypot((p2.x - p1.x) * scaleX, (p2.y - p1.y) * scaleY);
                
                // Only divide the segment if it's visually meaningful (e.g. > 50mm)
                if (physicalDist > 50) {
                    // 25% point (quarter)
                    addPointAndOffsets((p1.x * 0.75) + (p2.x * 0.25), (p1.y * 0.75) + (p2.y * 0.25));
                    // 50% point (half)
                    addPointAndOffsets((p1.x * 0.50) + (p2.x * 0.50), (p1.y * 0.50) + (p2.y * 0.50));
                    // 75% point (three-quarters)
                    addPointAndOffsets((p1.x * 0.25) + (p2.x * 0.75), (p1.y * 0.25) + (p2.y * 0.75));
                }
            };

            const interpolatePoints = (pts: {x: number, y: number}[], closed = false) => {
                for (let i = 0; i < pts.length; i++) {
                    addPointAndOffsets(pts[i].x, pts[i].y);
                    if (i > 0) {
                        addInterpolatedSegments(pts[i-1], pts[i]);
                    }
                }
                if (closed && pts.length > 2) {
                    addInterpolatedSegments(pts[pts.length - 1], pts[0]);
                }
            };

            if (type === "path") {
                const d = el.getAttribute("d");
                if (d) {
                    const rawPts = extractPathPoints(d);
                    interpolatePoints(rawPts);
                }
            } else if (type === "rect") {
                const x = parseFloat(el.getAttribute("x") || "0");
                const y = parseFloat(el.getAttribute("y") || "0");
                const w = parseFloat(el.getAttribute("width") || "0");
                const h = parseFloat(el.getAttribute("height") || "0");
                
                const corners = [
                    { x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }
                ];
                interpolatePoints(corners, true);
            } else if (type === "polyline" || type === "polygon") {
                const pointsStr = el.getAttribute("points") || "";
                const rawPoints = pointsStr.trim().split(/\s+|,/).map(Number);
                const pts = [];
                for (let i = 0; i < rawPoints.length; i += 2) {
                    pts.push({ x: rawPoints[i], y: rawPoints[i + 1] });
                }
                interpolatePoints(pts, type === "polygon");
            } else if (type === "circle" || type === "ellipse") {
                const cxVal = parseFloat(el.getAttribute("cx") || "0");
                const cyVal = parseFloat(el.getAttribute("cy") || "0");
                addPointAndOffsets(cxVal, cyVal);
            }
        };

        // Query standard shape elements instead of universally '*' to avoid noise
        svg.querySelectorAll("path, rect, polyline, polygon, circle, ellipse").forEach(processEl);
        
        // Optimize O(N^2) duplication check into O(N) using a spatial grid map
        const uniqueVertices: { x: number; y: number }[] = [];
        const seenGrid = new Set<string>();
        
        for (const pt of vertices) {
            // Group by 1mm grid cells to de-duplicate effectively
            const gridKey = `${Math.round(pt.x)},${Math.round(pt.y)}`;
            if (!seenGrid.has(gridKey)) {
                seenGrid.add(gridKey);
                uniqueVertices.push(pt);
            }
        }

        return uniqueVertices;

    } catch (e) {
        console.error("Failed to extract vertices", e);
        return [];
    }
}
