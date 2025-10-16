import { AssetInstance } from "@/store/sceneStore";
import { calculateWallBoundingBox } from "@/lib/wallGeometry";

interface AssetHandlesRendererProps {
  asset: AssetInstance;
  leftPx: number;
  topPx: number;
  onScaleHandleMouseDown: (e: React.MouseEvent, assetId: string, handleType: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right') => void;
  onRotationHandleMouseDown: (e: React.MouseEvent, assetId: string) => void;
}

export default function AssetHandlesRenderer({
  asset,
  leftPx,
  topPx,
  onScaleHandleMouseDown,
  onRotationHandleMouseDown,
}: AssetHandlesRendererProps) {
  // Early return if asset is undefined (prevents SSR errors)
  if (!asset) {
    return null;
  }

  const handleSize = 12;
  
  // Calculate handle positions directly in pixel coordinates relative to asset center
  const assetCenterPx = { x: leftPx, y: topPx };
  
  if (asset.type === "square" || asset.type === "circle") {
    const width = (asset.width ?? 50) * asset.scale;
    const height = (asset.height ?? 50) * asset.scale;
    
    const topLeftPx = { 
      x: assetCenterPx.x - width / 2 - 6, 
      y: assetCenterPx.y - height / 2 - 6 
    };
    const topRightPx = { 
      x: assetCenterPx.x + width / 2 + 6, 
      y: assetCenterPx.y - height / 2 - 6 
    };
    const bottomLeftPx = { 
      x: assetCenterPx.x - width / 2 - 6, 
      y: assetCenterPx.y + height / 2 + 6 
    };
    const bottomRightPx = { 
      x: assetCenterPx.x + width / 2 + 6, 
      y: assetCenterPx.y + height / 2 + 6 
    };
    const rotationHandlePx = { 
      x: assetCenterPx.x, 
      y: assetCenterPx.y - height / 2 - 30 
    };

    return (
      <>
        {/* Corner scaling handles */}
        <div
          onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'top-left')}
          style={{
            position: "absolute",
            left: topLeftPx.x,
            top: topLeftPx.y,
            width: handleSize,
            height: handleSize,
            backgroundColor: "#000000",
            border: "2px solid white",
            borderRadius: "2px",
            cursor: "nw-resize",
            zIndex: 10,
          }}
          className="hover:bg-blue-600 transition-colors"
          title="Scale"
        />
        <div
          onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'top-right')}
          style={{
            position: "absolute",
            left: topRightPx.x,
            top: topRightPx.y,
            width: handleSize,
            height: handleSize,
            backgroundColor: "#000000",
            border: "2px solid white",
            borderRadius: "2px",
            cursor: "ne-resize",
            zIndex: 10,
          }}
          className="hover:bg-blue-600 transition-colors"
          title="Scale"
        />
        <div
          onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'bottom-left')}
          style={{
            position: "absolute",
            left: bottomLeftPx.x,
            top: bottomLeftPx.y,
            width: handleSize,
            height: handleSize,
            backgroundColor: "#000000",
            border: "2px solid white",
            borderRadius: "2px",
            cursor: "sw-resize",
            zIndex: 10,
          }}
          className="hover:bg-blue-600 transition-colors"
          title="Scale"
        />
        <div
          onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'bottom-right')}
          style={{
            position: "absolute",
            left: bottomRightPx.x,
            top: bottomRightPx.y,
            width: handleSize,
            height: handleSize,
            backgroundColor: "#000000",
            border: "2px solid white",
            borderRadius: "2px",
            cursor: "se-resize",
            zIndex: 10,
          }}
          className="hover:bg-blue-600 transition-colors"
          title="Scale"
        />
        
        {/* Rotation line and handle */}
        <div
          style={{
            position: "absolute",
            left: assetCenterPx.x,
            top: assetCenterPx.y,
            width: 2,
            height: 30,
            backgroundColor: "#000000",
            transformOrigin: "bottom center",
            transform: `translate(-50%, -50%)`,
            zIndex: 9,
          }}
        />
        <div
          onMouseDown={(e) => onRotationHandleMouseDown(e, asset.id)}
          style={{
            position: "absolute",
            left: rotationHandlePx.x,
            top: rotationHandlePx.y,
            width: handleSize,
            height: handleSize,
            backgroundColor: "#000000",
            border: "2px solid white",
            borderRadius: "50%",
            cursor: "grab",
            zIndex: 10,
            transform: "translate(-50%, -50%)",
          }}
          className="hover:bg-blue-600 transition-colors"
          title="Rotate"
        />
      </>
    );
  } else if (asset.type === "line") {
    const width = (asset.width ?? 100) * asset.scale;
    const height = (asset.strokeWidth ?? 2) * asset.scale;
    
    const topLeftPx = { 
      x: assetCenterPx.x - width / 2 - 6, 
      y: assetCenterPx.y - height / 2 - 6 
    };
    const topRightPx = { 
      x: assetCenterPx.x + width / 2 + 6, 
      y: assetCenterPx.y - height / 2 - 6 
    };
    const bottomLeftPx = { 
      x: assetCenterPx.x - width / 2 - 6, 
      y: assetCenterPx.y + height / 2 + 6 
    };
    const bottomRightPx = { 
      x: assetCenterPx.x + width / 2 + 6, 
      y: assetCenterPx.y + height / 2 + 6 
    };
    const rotationHandlePx = { 
      x: assetCenterPx.x, 
      y: assetCenterPx.y - height / 2 - 30 
    };

    return (
      <>
        {/* Corner scaling handles for line */}
        <div
          onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'top-left')}
          style={{
            position: "absolute",
            left: topLeftPx.x,
            top: topLeftPx.y,
            width: handleSize,
            height: handleSize,
            backgroundColor: "#000000",
            border: "2px solid white",
            borderRadius: "2px",
            cursor: "nw-resize",
            zIndex: 10,
          }}
          className="hover:bg-blue-600 transition-colors"
          title="Scale"
        />
        <div
          onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'top-right')}
          style={{
            position: "absolute",
            left: topRightPx.x,
            top: topRightPx.y,
            width: handleSize,
            height: handleSize,
            backgroundColor: "#000000",
            border: "2px solid white",
            borderRadius: "2px",
            cursor: "ne-resize",
            zIndex: 10,
          }}
          className="hover:bg-blue-600 transition-colors"
          title="Scale"
        />
        <div
          onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'bottom-left')}
          style={{
            position: "absolute",
            left: bottomLeftPx.x,
            top: bottomLeftPx.y,
            width: handleSize,
            height: handleSize,
            backgroundColor: "#000000",
            border: "2px solid white",
            borderRadius: "2px",
            cursor: "sw-resize",
            zIndex: 10,
          }}
          className="hover:bg-blue-600 transition-colors"
          title="Scale"
        />
        <div
          onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'bottom-right')}
          style={{
            position: "absolute",
            left: bottomRightPx.x,
            top: bottomRightPx.y,
            width: handleSize,
            height: handleSize,
            backgroundColor: "#000000",
            border: "2px solid white",
            borderRadius: "2px",
            cursor: "se-resize",
            zIndex: 10,
          }}
          className="hover:bg-blue-600 transition-colors"
          title="Scale"
        />
        
        {/* Rotation line and handle */}
        <div
          style={{
            position: "absolute",
            left: assetCenterPx.x,
            top: assetCenterPx.y,
            width: 2,
            height: 30,
            backgroundColor: "#000000",
            transformOrigin: "bottom center",
            transform: `translate(-50%, -50%)`,
            zIndex: 9,
          }}
        />
        <div
          onMouseDown={(e) => onRotationHandleMouseDown(e, asset.id)}
          style={{
            position: "absolute",
            left: rotationHandlePx.x,
            top: rotationHandlePx.y,
            width: handleSize,
            height: handleSize,
            backgroundColor: "#000000",
            border: "2px solid white",
            borderRadius: "50%",
            cursor: "grab",
            zIndex: 10,
            transform: "translate(-50%, -50%)",
          }}
          className="hover:bg-blue-600 transition-colors"
          title="Rotate"
        />
      </>
    );
  } else if (asset.type === "double-line") {
    const lineGap = (asset.lineGap ?? 8) * asset.scale;
    const isHorizontal = asset.isHorizontal ?? true;
    const lineThickness = 2;
    
    const totalWidth = isHorizontal ? (asset.width ?? 100) * asset.scale : (lineThickness + lineGap);
    const totalHeight = isHorizontal ? (lineThickness + lineGap) : (asset.height ?? 100) * asset.scale;
    
    const topLeftPx = { 
      x: assetCenterPx.x - totalWidth / 2 - 6, 
      y: assetCenterPx.y - totalHeight / 2 - 6 
    };
    const topRightPx = { 
      x: assetCenterPx.x + totalWidth / 2 + 6, 
      y: assetCenterPx.y - totalHeight / 2 - 6 
    };
    const bottomLeftPx = { 
      x: assetCenterPx.x - totalWidth / 2 - 6, 
      y: assetCenterPx.y + totalHeight / 2 + 6 
    };
    const bottomRightPx = { 
      x: assetCenterPx.x + totalWidth / 2 + 6, 
      y: assetCenterPx.y + totalHeight / 2 + 6 
    };
    const rotationHandlePx = { 
      x: assetCenterPx.x, 
      y: assetCenterPx.y - totalHeight / 2 - 30 
    };

    return (
      <>
        {/* Corner scaling handles for double-line */}
        <div
          onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'top-left')}
          style={{
            position: "absolute",
            left: topLeftPx.x,
            top: topLeftPx.y,
            width: handleSize,
            height: handleSize,
            backgroundColor: "#000000",
            border: "2px solid white",
            borderRadius: "2px",
            cursor: "nw-resize",
            zIndex: 10,
          }}
          className="hover:bg-blue-600 transition-colors"
          title="Scale"
        />
        <div
          onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'top-right')}
          style={{
            position: "absolute",
            left: topRightPx.x,
            top: topRightPx.y,
            width: handleSize,
            height: handleSize,
            backgroundColor: "#000000",
            border: "2px solid white",
            borderRadius: "2px",
            cursor: "ne-resize",
            zIndex: 10,
          }}
          className="hover:bg-blue-600 transition-colors"
          title="Scale"
        />
        <div
          onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'bottom-left')}
          style={{
            position: "absolute",
            left: bottomLeftPx.x,
            top: bottomLeftPx.y,
            width: handleSize,
            height: handleSize,
            backgroundColor: "#000000",
            border: "2px solid white",
            borderRadius: "2px",
            cursor: "sw-resize",
            zIndex: 10,
          }}
          className="hover:bg-blue-600 transition-colors"
          title="Scale"
        />
        <div
          onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'bottom-right')}
          style={{
            position: "absolute",
            left: bottomRightPx.x,
            top: bottomRightPx.y,
            width: handleSize,
            height: handleSize,
            backgroundColor: "#000000",
            border: "2px solid white",
            borderRadius: "2px",
            cursor: "se-resize",
            zIndex: 10,
          }}
          className="hover:bg-blue-600 transition-colors"
          title="Scale"
        />
        
        {/* Rotation line and handle */}
        <div
          style={{
            position: "absolute",
            left: assetCenterPx.x,
            top: assetCenterPx.y,
            width: 2,
            height: 30,
            backgroundColor: "#000000",
            transformOrigin: "bottom center",
            transform: `translate(-50%, -50%)`,
            zIndex: 9,
          }}
        />
        <div
          onMouseDown={(e) => onRotationHandleMouseDown(e, asset.id)}
          style={{
            position: "absolute",
            left: rotationHandlePx.x,
            top: rotationHandlePx.y,
            width: handleSize,
            height: handleSize,
            backgroundColor: "#000000",
            border: "2px solid white",
            borderRadius: "50%",
            cursor: "grab",
            zIndex: 10,
            transform: "translate(-50%, -50%)",
          }}
          className="hover:bg-blue-600 transition-colors"
          title="Rotate"
        />
      </>
    );
  } else if (asset.type === "drawn-line") {
    // For drawn lines, use a fixed bounding box since the path can be any shape
    const boundingSize = 100 * asset.scale;
    
    const topLeftPx = { 
      x: assetCenterPx.x - boundingSize / 2 - 6, 
      y: assetCenterPx.y - boundingSize / 2 - 6 
    };
    const topRightPx = { 
      x: assetCenterPx.x + boundingSize / 2 + 6, 
      y: assetCenterPx.y - boundingSize / 2 - 6 
    };
    const bottomLeftPx = { 
      x: assetCenterPx.x - boundingSize / 2 - 6, 
      y: assetCenterPx.y + boundingSize / 2 + 6 
    };
    const bottomRightPx = { 
      x: assetCenterPx.x + boundingSize / 2 + 6, 
      y: assetCenterPx.y + boundingSize / 2 + 6 
    };
    const rotationHandlePx = { 
      x: assetCenterPx.x, 
      y: assetCenterPx.y - boundingSize / 2 - 30 
    };

    return (
      <>
        {/* Corner scaling handles for drawn-line */}
        <div
          onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'top-left')}
          style={{
            position: "absolute",
            left: topLeftPx.x,
            top: topLeftPx.y,
            width: handleSize,
            height: handleSize,
            backgroundColor: "#000000",
            border: "2px solid white",
            borderRadius: "2px",
            cursor: "nw-resize",
            zIndex: 10,
          }}
          className="hover:bg-blue-600 transition-colors"
          title="Scale"
        />
        <div
          onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'top-right')}
          style={{
            position: "absolute",
            left: topRightPx.x,
            top: topRightPx.y,
            width: handleSize,
            height: handleSize,
            backgroundColor: "#000000",
            border: "2px solid white",
            borderRadius: "2px",
            cursor: "ne-resize",
            zIndex: 10,
          }}
          className="hover:bg-blue-600 transition-colors"
          title="Scale"
        />
        <div
          onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'bottom-left')}
          style={{
            position: "absolute",
            left: bottomLeftPx.x,
            top: bottomLeftPx.y,
            width: handleSize,
            height: handleSize,
            backgroundColor: "#000000",
            border: "2px solid white",
            borderRadius: "2px",
            cursor: "sw-resize",
            zIndex: 10,
          }}
          className="hover:bg-blue-600 transition-colors"
          title="Scale"
        />
        <div
          onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'bottom-right')}
          style={{
            position: "absolute",
            left: bottomRightPx.x,
            top: bottomRightPx.y,
            width: handleSize,
            height: handleSize,
            backgroundColor: "#000000",
            border: "2px solid white",
            borderRadius: "2px",
            cursor: "se-resize",
            zIndex: 10,
          }}
          className="hover:bg-blue-600 transition-colors"
          title="Scale"
        />
        
        {/* Rotation line and handle */}
        <div
          style={{
            position: "absolute",
            left: assetCenterPx.x,
            top: assetCenterPx.y,
            width: 2,
            height: 30,
            backgroundColor: "#000000",
            transformOrigin: "bottom center",
            transform: `translate(-50%, -50%)`,
            zIndex: 9,
          }}
        />
        <div
          onMouseDown={(e) => onRotationHandleMouseDown(e, asset.id)}
          style={{
            position: "absolute",
            left: rotationHandlePx.x,
            top: rotationHandlePx.y,
            width: handleSize,
            height: handleSize,
            backgroundColor: "#000000",
            border: "2px solid white",
            borderRadius: "50%",
            cursor: "grab",
            zIndex: 10,
            transform: "translate(-50%, -50%)",
          }}
          className="hover:bg-blue-600 transition-colors"
          title="Rotate"
        />
      </>
    );
  } else if (asset.type === "wall-segments") {
    // For wall segments, calculate actual bounding box from wall geometry
    const boundingBox = calculateWallBoundingBox(asset);
    const width = boundingBox.width * asset.scale;
    const height = boundingBox.height * asset.scale;
    
    const topLeftPx = { 
      x: assetCenterPx.x - width / 2 - 6, 
      y: assetCenterPx.y - height / 2 - 6 
    };
    const topRightPx = { 
      x: assetCenterPx.x + width / 2 + 6, 
      y: assetCenterPx.y - height / 2 - 6 
    };
    const bottomLeftPx = { 
      x: assetCenterPx.x - width / 2 - 6, 
      y: assetCenterPx.y + height / 2 + 6 
    };
    const bottomRightPx = { 
      x: assetCenterPx.x + width / 2 + 6, 
      y: assetCenterPx.y + height / 2 + 6 
    };
    const rotationHandlePx = { 
      x: assetCenterPx.x, 
      y: assetCenterPx.y - height / 2 - 30 
    };

    return (
      <>
        {/* Corner scaling handles for wall-segments */}
        <div
          onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'top-left')}
          style={{
            position: "absolute",
            left: topLeftPx.x,
            top: topLeftPx.y,
            width: handleSize,
            height: handleSize,
            backgroundColor: "#000000",
            border: "2px solid white",
            borderRadius: "2px",
            cursor: "nw-resize",
            zIndex: 10,
          }}
          className="hover:bg-blue-600 transition-colors"
          title="Scale"
        />
        <div
          onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'top-right')}
          style={{
            position: "absolute",
            left: topRightPx.x,
            top: topRightPx.y,
            width: handleSize,
            height: handleSize,
            backgroundColor: "#000000",
            border: "2px solid white",
            borderRadius: "2px",
            cursor: "ne-resize",
            zIndex: 10,
          }}
          className="hover:bg-blue-600 transition-colors"
          title="Scale"
        />
        <div
          onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'bottom-left')}
          style={{
            position: "absolute",
            left: bottomLeftPx.x,
            top: bottomLeftPx.y,
            width: handleSize,
            height: handleSize,
            backgroundColor: "#000000",
            border: "2px solid white",
            borderRadius: "2px",
            cursor: "sw-resize",
            zIndex: 10,
          }}
          className="hover:bg-blue-600 transition-colors"
          title="Scale"
        />
        <div
          onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'bottom-right')}
          style={{
            position: "absolute",
            left: bottomRightPx.x,
            top: bottomRightPx.y,
            width: handleSize,
            height: handleSize,
            backgroundColor: "#000000",
            border: "2px solid white",
            borderRadius: "2px",
            cursor: "se-resize",
            zIndex: 10,
          }}
          className="hover:bg-blue-600 transition-colors"
          title="Scale"
        />
        
        {/* Rotation line and handle */}
        <div
          style={{
            position: "absolute",
            left: assetCenterPx.x,
            top: assetCenterPx.y,
            width: 2,
            height: 30,
            backgroundColor: "#000000",
            transformOrigin: "bottom center",
            transform: `translate(-50%, -50%)`,
            zIndex: 9,
          }}
        />
        <div
          onMouseDown={(e) => onRotationHandleMouseDown(e, asset.id)}
          style={{
            position: "absolute",
            left: rotationHandlePx.x,
            top: rotationHandlePx.y,
            width: handleSize,
            height: handleSize,
            backgroundColor: "#000000",
            border: "2px solid white",
            borderRadius: "50%",
            cursor: "grab",
            zIndex: 10,
            transform: "translate(-50%, -50%)",
          }}
          className="hover:bg-blue-600 transition-colors"
          title="Rotate"
        />
      </>
    );
  } else if (asset.type === "text") {
    // For text, estimate size based on text content and font size
    const fontSize = (asset.fontSize ?? 16) * asset.scale;
    const textLength = (asset.text ?? "Enter text").length;
    const estimatedWidth = Math.max(textLength * fontSize * 0.6, 50); // Rough estimation
    const estimatedHeight = fontSize * 1.2;
    
    const topLeftPx = { 
      x: assetCenterPx.x - estimatedWidth / 2 - handleSize / 2, 
      y: assetCenterPx.y - estimatedHeight / 2 - handleSize / 2 
    };
    const topRightPx = { 
      x: assetCenterPx.x + estimatedWidth / 2 + handleSize / 2, 
      y: assetCenterPx.y - estimatedHeight / 2 - handleSize / 2 
    };
    const bottomLeftPx = { 
      x: assetCenterPx.x - estimatedWidth / 2 - handleSize / 2, 
      y: assetCenterPx.y + estimatedHeight / 2 + handleSize / 2 
    };
    const bottomRightPx = { 
      x: assetCenterPx.x + estimatedWidth / 2 + handleSize / 2, 
      y: assetCenterPx.y + estimatedHeight / 2 + handleSize / 2 
    };
    const rotationHandlePx = { 
      x: assetCenterPx.x, 
      y: assetCenterPx.y - estimatedHeight / 2 - 30 
    };

    return (
      <>
        {/* Corner scaling handles for text */}
        <div
          onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'top-left')}
          style={{
            position: "absolute",
            left: topLeftPx.x,
            top: topLeftPx.y,
            width: handleSize,
            height: handleSize,
            backgroundColor: "#000000",
            border: "2px solid white",
            borderRadius: "2px",
            cursor: "nw-resize",
            zIndex: 10,
          }}
          className="hover:bg-blue-600 transition-colors"
          title="Scale"
        />
        <div
          onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'top-right')}
          style={{
            position: "absolute",
            left: topRightPx.x,
            top: topRightPx.y,
            width: handleSize,
            height: handleSize,
            backgroundColor: "#000000",
            border: "2px solid white",
            borderRadius: "2px",
            cursor: "ne-resize",
            zIndex: 10,
          }}
          className="hover:bg-blue-600 transition-colors"
          title="Scale"
        />
        <div
          onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'bottom-left')}
          style={{
            position: "absolute",
            left: bottomLeftPx.x,
            top: bottomLeftPx.y,
            width: handleSize,
            height: handleSize,
            backgroundColor: "#000000",
            border: "2px solid white",
            borderRadius: "2px",
            cursor: "sw-resize",
            zIndex: 10,
          }}
          className="hover:bg-blue-600 transition-colors"
          title="Scale"
        />
        <div
          onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'bottom-right')}
          style={{
            position: "absolute",
            left: bottomRightPx.x,
            top: bottomRightPx.y,
            width: handleSize,
            height: handleSize,
            backgroundColor: "#000000",
            border: "2px solid white",
            borderRadius: "2px",
            cursor: "se-resize",
            zIndex: 10,
          }}
          className="hover:bg-blue-600 transition-colors"
          title="Scale"
        />
        
        {/* Rotation line and handle */}
        <div
          style={{
            position: "absolute",
            left: assetCenterPx.x,
            top: assetCenterPx.y,
            width: 2,
            height: 30,
            backgroundColor: "#000000",
            transformOrigin: "bottom center",
            transform: `translate(-50%, -50%)`,
            zIndex: 9,
          }}
        />
        <div
          onMouseDown={(e) => onRotationHandleMouseDown(e, asset.id)}
          style={{
            position: "absolute",
            left: rotationHandlePx.x,
            top: rotationHandlePx.y,
            width: handleSize,
            height: handleSize,
            backgroundColor: "#000000",
            border: "2px solid white",
            borderRadius: "50%",
            cursor: "grab",
            zIndex: 10,
            transform: "translate(-50%, -50%)",
          }}
          className="hover:bg-blue-600 transition-colors"
          title="Rotate"
        />
      </>
    );
  } else {
    // For icons and other assets
    const width = (asset.width ?? 24) * asset.scale;
    const height = (asset.height ?? 24) * asset.scale;
    
    const topLeftPx = { 
      x: assetCenterPx.x - width / 2 - 6, 
      y: assetCenterPx.y - height / 2 - 6 
    };
    const topRightPx = { 
      x: assetCenterPx.x + width / 2 + 6, 
      y: assetCenterPx.y - height / 2 - 6 
    };
    const bottomLeftPx = { 
      x: assetCenterPx.x - width / 2 - 6, 
      y: assetCenterPx.y + height / 2 + 6 
    };
    const bottomRightPx = { 
      x: assetCenterPx.x + width / 2 + 6, 
      y: assetCenterPx.y + height / 2 + 6 
    };
    const rotationHandlePx = { 
      x: assetCenterPx.x, 
      y: assetCenterPx.y - height / 2 - 30 
    };

    return (
      <>
        {/* Corner scaling handles for icons */}
        <div
          onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'top-left')}
          style={{
            position: "absolute",
            left: topLeftPx.x,
            top: topLeftPx.y,
            width: handleSize,
            height: handleSize,
            backgroundColor: "#000000",
            border: "2px solid white",
            borderRadius: "2px",
            cursor: "nw-resize",
            zIndex: 10,
          }}
          className="hover:bg-blue-600 transition-colors"
          title="Scale"
        />
        <div
          onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'top-right')}
          style={{
            position: "absolute",
            left: topRightPx.x,
            top: topRightPx.y,
            width: handleSize,
            height: handleSize,
            backgroundColor: "#000000",
            border: "2px solid white",
            borderRadius: "2px",
            cursor: "ne-resize",
            zIndex: 10,
          }}
          className="hover:bg-blue-600 transition-colors"
          title="Scale"
        />
        <div
          onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'bottom-left')}
          style={{
            position: "absolute",
            left: bottomLeftPx.x,
            top: bottomLeftPx.y,
            width: handleSize,
            height: handleSize,
            backgroundColor: "#000000",
            border: "2px solid white",
            borderRadius: "2px",
            cursor: "sw-resize",
            zIndex: 10,
          }}
          className="hover:bg-blue-600 transition-colors"
          title="Scale"
        />
        <div
          onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'bottom-right')}
          style={{
            position: "absolute",
            left: bottomRightPx.x,
            top: bottomRightPx.y,
            width: handleSize,
            height: handleSize,
            backgroundColor: "#000000",
            border: "2px solid white",
            borderRadius: "2px",
            cursor: "se-resize",
            zIndex: 10,
          }}
          className="hover:bg-blue-600 transition-colors"
          title="Scale"
        />
        
        {/* Rotation line and handle */}
        <div
          style={{
            position: "absolute",
            left: assetCenterPx.x,
            top: assetCenterPx.y,
            width: 2,
            height: 30,
            backgroundColor: "#000000",
            transformOrigin: "bottom center",
            transform: `translate(-50%, -50%)`,
            zIndex: 9,
          }}
        />
        <div
          onMouseDown={(e) => onRotationHandleMouseDown(e, asset.id)}
          style={{
            position: "absolute",
            left: rotationHandlePx.x,
            top: rotationHandlePx.y,
            width: handleSize,
            height: handleSize,
            backgroundColor: "#000000",
            border: "2px solid white",
            borderRadius: "50%",
            cursor: "grab",
            zIndex: 10,
            transform: "translate(-50%, -50%)",
          }}
          className="hover:bg-blue-600 transition-colors"
          title="Rotate"
        />
      </>
    );
  }
}
