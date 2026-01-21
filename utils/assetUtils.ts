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
