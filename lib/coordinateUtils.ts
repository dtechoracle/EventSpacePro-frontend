import { AssetInstance } from "@/store/sceneStore";
import { calculateWallBoundingBox } from "@/lib/wallGeometry";

export function createClientToCanvasMM(
    canvasRef: React.RefObject<HTMLDivElement | null>,
    effectiveWidthMm: number,
    effectiveHeightMm: number,
    canvasPxW: number,
    canvasPxH: number,
    workspaceZoom: number,
    mmToPx: number,
    rotation: number
) {
    return (clientX: number, clientY: number) => {
        if (!canvasRef.current || !effectiveWidthMm || !effectiveHeightMm) return { x: 0, y: 0 };
        const rect = canvasRef.current.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = clientX - cx;
        const dy = clientY - cy;
        const theta = (-rotation * Math.PI) / 180;
        const ux = dx * Math.cos(theta) - dy * Math.sin(theta);
        const uy = dx * Math.sin(theta) + dy * Math.cos(theta);
        const halfWscreen = (canvasPxW * workspaceZoom) / 2;
        const halfHscreen = (canvasPxH * workspaceZoom) / 2;
        const xMm = (ux + halfWscreen) / (mmToPx * workspaceZoom);
        const yMm = (uy + halfHscreen) / (mmToPx * workspaceZoom);
        return { x: xMm, y: yMm };
    };
}

export function getAssetCornerPosition(asset: AssetInstance, handleType: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right') {
    const handleSize = 12;

    if (asset.type === "square" || asset.type === "circle") {
        const width = (asset.width ?? 50) * asset.scale;
        const height = (asset.height ?? 50) * asset.scale;

        switch (handleType) {
            case 'top-left':
                return { x: asset.x - width / 2 - 6, y: asset.y - height / 2 - 6 };
            case 'top-right':
                return { x: asset.x + width / 2 + 6, y: asset.y - height / 2 - 6 };
            case 'bottom-left':
                return { x: asset.x - width / 2 - 6, y: asset.y + height / 2 + 6 };
            case 'bottom-right':
                return { x: asset.x + width / 2 + 6, y: asset.y + height / 2 + 6 };
        }
    } else if (asset.type === "line") {
        const width = (asset.width ?? 100) * asset.scale;
        const height = (asset.strokeWidth ?? 2) * asset.scale;

        switch (handleType) {
            case 'top-left':
                return { x: asset.x - width / 2 - 6, y: asset.y - height / 2 - 6 };
            case 'top-right':
                return { x: asset.x + width / 2 + 6, y: asset.y - height / 2 - 6 };
            case 'bottom-left':
                return { x: asset.x - width / 2 - 6, y: asset.y + height / 2 + 6 };
            case 'bottom-right':
                return { x: asset.x + width / 2 + 6, y: asset.y + height / 2 + 6 };
        }
    } else if (asset.type === "double-line") {
        const lineGap = (asset.lineGap ?? 8) * asset.scale;
        const isHorizontal = asset.isHorizontal ?? true;
        const lineThickness = 2;

        const totalWidth = isHorizontal ? (asset.width ?? 100) * asset.scale : (lineThickness + lineGap);
        const totalHeight = isHorizontal ? (lineThickness + lineGap) : (asset.height ?? 100) * asset.scale;

        switch (handleType) {
            case 'top-left':
                return { x: asset.x - totalWidth / 2 - 6, y: asset.y - totalHeight / 2 - 6 };
            case 'top-right':
                return { x: asset.x + totalWidth / 2 + 6, y: asset.y - totalHeight / 2 - 6 };
            case 'bottom-left':
                return { x: asset.x - totalWidth / 2 - 6, y: asset.y + totalHeight / 2 + 6 };
            case 'bottom-right':
                return { x: asset.x + totalWidth / 2 + 6, y: asset.y + totalHeight / 2 + 6 };
        }
    } else if (asset.type === "wall-segments") {
        // For wall segments, compute actual bounding box from geometry
        const { width, height } = calculateWallBoundingBox(asset);
        const w = width * asset.scale;
        const h = height * asset.scale;

        switch (handleType) {
            case 'top-left':
                return { x: asset.x - w / 2 - 6, y: asset.y - h / 2 - 6 };
            case 'top-right':
                return { x: asset.x + w / 2 + 6, y: asset.y - h / 2 - 6 };
            case 'bottom-left':
                return { x: asset.x - w / 2 - 6, y: asset.y + h / 2 + 6 };
            case 'bottom-right':
                return { x: asset.x + w / 2 + 6, y: asset.y + h / 2 + 6 };
        }
    } else if (asset.type === "text") {
        // For text, estimate size based on text content and font size
        const fontSize = (asset.fontSize ?? 16) * asset.scale;
        const textLength = (asset.text ?? "Enter text").length;
        const estimatedWidth = Math.max(textLength * fontSize * 0.6, 50); // Rough estimation
        const estimatedHeight = fontSize * 1.2;

        switch (handleType) {
            case 'top-left':
                return { x: asset.x - estimatedWidth / 2 - handleSize / 2, y: asset.y - estimatedHeight / 2 - handleSize / 2 };
            case 'top-right':
                return { x: asset.x + estimatedWidth / 2 + handleSize / 2, y: asset.y - estimatedHeight / 2 - handleSize / 2 };
            case 'bottom-left':
                return { x: asset.x - estimatedWidth / 2 - handleSize / 2, y: asset.y + estimatedHeight / 2 + handleSize / 2 };
            case 'bottom-right':
                return { x: asset.x + estimatedWidth / 2 + handleSize / 2, y: asset.y + estimatedHeight / 2 + handleSize / 2 };
        }
    } else {
        // For all other assets (icons, custom SVGs), use width and height
        const width = (asset.width ?? 24) * asset.scale;
        const height = (asset.height ?? 24) * asset.scale;

        switch (handleType) {
            case 'top-left':
                return { x: asset.x - width / 2 - 6, y: asset.y - height / 2 - 6 };
            case 'top-right':
                return { x: asset.x + width / 2 + 6, y: asset.y - height / 2 - 6 };
            case 'bottom-left':
                return { x: asset.x - width / 2 - 6, y: asset.y + height / 2 + 6 };
            case 'bottom-right':
                return { x: asset.x + width / 2 + 6, y: asset.y + height / 2 + 6 };
        }
    }
    return { x: asset.x, y: asset.y };
}

export function getRotationHandlePosition(asset: AssetInstance) {
    const handleOffset = 30; // Distance from asset edge

    if (asset.type === "square" || asset.type === "circle") {
        const height = (asset.height ?? 50) * asset.scale;
        return {
            x: asset.x,
            y: asset.y - height / 2 - handleOffset
        };
    } else if (asset.type === "line") {
        const height = (asset.strokeWidth ?? 2) * asset.scale;
        return {
            x: asset.x,
            y: asset.y - height / 2 - handleOffset
        };
    } else if (asset.type === "double-line") {
        const isHorizontal = asset.isHorizontal ?? true;
        const lineThickness = 2;
        const lineGap = (asset.lineGap ?? 8) * asset.scale;

        const totalHeight = isHorizontal ? (lineThickness + lineGap) : (asset.height ?? 100) * asset.scale;

        return {
            x: asset.x,
            y: asset.y - totalHeight / 2 - handleOffset
        };
    } else if (asset.type === "wall-segments") {
        // Use actual wall bounding box height for rotation handle position
        const { height } = calculateWallBoundingBox(asset);
        const h = height * asset.scale;

        return {
            x: asset.x,
            y: asset.y - h / 2 - handleOffset
        };
    } else if (asset.type === "text") {
        const fontSize = (asset.fontSize ?? 16) * asset.scale;
        const estimatedHeight = fontSize * 1.2;
        return {
            x: asset.x,
            y: asset.y - estimatedHeight / 2 - handleOffset
        };
    } else {
        // For icons and other assets
        const height = (asset.height ?? 24) * asset.scale;
        return {
            x: asset.x,
            y: asset.y - height / 2 - handleOffset
        };
    }
}
