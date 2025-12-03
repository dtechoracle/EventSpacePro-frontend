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

  const handleSize = 18; // Increased from 14 to 18 for better visibility
  
  // Professional handle styling
  const cornerHandleStyle = {
    position: "absolute" as const,
    width: handleSize,
    height: handleSize,
    backgroundColor: "#3B82F6", // Professional blue
    border: "2px solid #FFFFFF",
    borderRadius: "3px",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(59, 130, 246, 0.2)",
    cursor: "pointer",
    zIndex: 10,
    transition: "all 0.2s ease",
    transform: "translate(-50%, -50%)",
  };

  const rotationHandleStyle = {
    position: "absolute" as const,
    width: handleSize,
    height: handleSize,
    backgroundColor: "#10B981", // Professional green
    border: "2px solid #FFFFFF",
    borderRadius: "50%",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(16, 185, 129, 0.2)",
    cursor: "grab",
    zIndex: 10,
    transform: "translate(-50%, -50%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.2s ease",
  };

  const rotationLineStyle = {
    position: "absolute" as const,
    width: "2px",
    height: "32px",
    backgroundColor: "#6B7280", // Professional gray
    transformOrigin: "bottom center",
    transform: "translate(-50%, -50%)",
    zIndex: 9,
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
  };
  
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
            ...cornerHandleStyle,
            left: topLeftPx.x,
            top: topLeftPx.y,
            cursor: "nw-resize",
          }}
          className="hover:scale-110 hover:shadow-lg"
          title="Resize"
        />
        <div
          onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'top-right')}
          style={{
            ...cornerHandleStyle,
            left: topRightPx.x,
            top: topRightPx.y,
            cursor: "ne-resize",
          }}
          className="hover:scale-110 hover:shadow-lg"
          title="Resize"
        />
        <div
          onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'bottom-left')}
          style={{
            ...cornerHandleStyle,
            left: bottomLeftPx.x,
            top: bottomLeftPx.y,
            cursor: "sw-resize",
          }}
          className="hover:scale-110 hover:shadow-lg"
          title="Resize"
        />
        <div
          onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'bottom-right')}
          style={{
            ...cornerHandleStyle,
            left: bottomRightPx.x,
            top: bottomRightPx.y,
            cursor: "se-resize",
          }}
          className="hover:scale-110 hover:shadow-lg"
          title="Resize"
        />
        
        {/* Rotation line and handle */}
        <div
          style={{
            ...rotationLineStyle,
            left: assetCenterPx.x,
            top: assetCenterPx.y,
          }}
        />
        <div
          onMouseDown={(e) => onRotationHandleMouseDown(e, asset.id)}
          style={{
            ...rotationHandleStyle,
            left: rotationHandlePx.x,
            top: rotationHandlePx.y,
          }}
          className="hover:scale-110 hover:shadow-lg"
          title="Rotate"
        >
          {/* Professional rotation icon */}
          <svg
            width="10"
            height="10"
            viewBox="0 0 16 16"
            fill="white"
            style={{ pointerEvents: "none" }}
          >
            <path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
            <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
          </svg>
        </div>
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
            backgroundColor: "#3B82F6",
            border: "2px solid #FFFFFF",
            borderRadius: "3px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(59, 130, 246, 0.2)",
            transition: "all 0.2s ease",
            transform: "translate(-50%, -50%)",
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
            backgroundColor: "#3B82F6",
            border: "2px solid #FFFFFF",
            borderRadius: "3px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(59, 130, 246, 0.2)",
            transition: "all 0.2s ease",
            transform: "translate(-50%, -50%)",
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
            backgroundColor: "#3B82F6",
            border: "2px solid #FFFFFF",
            borderRadius: "3px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(59, 130, 246, 0.2)",
            transition: "all 0.2s ease",
            transform: "translate(-50%, -50%)",
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
            backgroundColor: "#3B82F6",
            border: "2px solid #FFFFFF",
            borderRadius: "3px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(59, 130, 246, 0.2)",
            transition: "all 0.2s ease",
            transform: "translate(-50%, -50%)",
            cursor: "se-resize",
            zIndex: 10,
          }}
          className="hover:bg-blue-600 transition-colors"
          title="Scale"
        />
        
W        {/* Rotation line hidden for walls to avoid center box artifact */}
        <div
          style={{
            position: "absolute",
            left: assetCenterPx.x,
            top: assetCenterPx.y,
            width: 0,
            height: 0,
            backgroundColor: "transparent",
            transformOrigin: "bottom center",
            transform: `translate(-50%, -50%)`,
            zIndex: 9,
            pointerEvents: "none",
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
            backgroundColor: "#10B981",
            border: "2px solid #FFFFFF",
            borderRadius: "50%",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(16, 185, 129, 0.2)",
            cursor: "grab",
            zIndex: 10,
            transform: "translate(-50%, -50%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          className="hover:bg-blue-600 transition-colors"
          title="Rotate"
        >
          {/* Rotation icon - curved arrow */}
          <svg
            width="8"
            height="8"
            viewBox="0 0 16 16"
            fill="white"
            style={{ pointerEvents: "none" }}
          >
            <path d="M8 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12zm0 1a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 1.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zm0 1a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z" />
            <path d="M6 4l2-2 2 2" stroke="white" strokeWidth="1" fill="none" />
          </svg>
        </div>
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
            backgroundColor: "#3B82F6",
            border: "2px solid #FFFFFF",
            borderRadius: "3px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(59, 130, 246, 0.2)",
            transition: "all 0.2s ease",
            transform: "translate(-50%, -50%)",
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
            backgroundColor: "#3B82F6",
            border: "2px solid #FFFFFF",
            borderRadius: "3px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(59, 130, 246, 0.2)",
            transition: "all 0.2s ease",
            transform: "translate(-50%, -50%)",
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
            backgroundColor: "#3B82F6",
            border: "2px solid #FFFFFF",
            borderRadius: "3px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(59, 130, 246, 0.2)",
            transition: "all 0.2s ease",
            transform: "translate(-50%, -50%)",
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
            backgroundColor: "#3B82F6",
            border: "2px solid #FFFFFF",
            borderRadius: "3px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(59, 130, 246, 0.2)",
            transition: "all 0.2s ease",
            transform: "translate(-50%, -50%)",
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
            backgroundColor: "#10B981",
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
            backgroundColor: "#10B981",
            border: "2px solid #FFFFFF",
            borderRadius: "50%",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(16, 185, 129, 0.2)",
            cursor: "grab",
            zIndex: 10,
            transform: "translate(-50%, -50%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          className="hover:bg-blue-600 transition-colors"
          title="Rotate"
        >
          {/* Rotation icon - curved arrow */}
          <svg
            width="8"
            height="8"
            viewBox="0 0 16 16"
            fill="white"
            style={{ pointerEvents: "none" }}
          >
            <path d="M8 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12zm0 1a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 1.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zm0 1a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z" />
            <path d="M6 4l2-2 2 2" stroke="white" strokeWidth="1" fill="none" />
          </svg>
        </div>
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
            backgroundColor: "#3B82F6",
            border: "2px solid #FFFFFF",
            borderRadius: "3px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(59, 130, 246, 0.2)",
            transition: "all 0.2s ease",
            transform: "translate(-50%, -50%)",
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
            backgroundColor: "#3B82F6",
            border: "2px solid #FFFFFF",
            borderRadius: "3px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(59, 130, 246, 0.2)",
            transition: "all 0.2s ease",
            transform: "translate(-50%, -50%)",
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
            backgroundColor: "#3B82F6",
            border: "2px solid #FFFFFF",
            borderRadius: "3px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(59, 130, 246, 0.2)",
            transition: "all 0.2s ease",
            transform: "translate(-50%, -50%)",
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
            backgroundColor: "#3B82F6",
            border: "2px solid #FFFFFF",
            borderRadius: "3px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(59, 130, 246, 0.2)",
            transition: "all 0.2s ease",
            transform: "translate(-50%, -50%)",
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
            backgroundColor: "#10B981",
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
            backgroundColor: "#10B981",
            border: "2px solid #FFFFFF",
            borderRadius: "50%",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(16, 185, 129, 0.2)",
            cursor: "grab",
            zIndex: 10,
            transform: "translate(-50%, -50%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          className="hover:bg-blue-600 transition-colors"
          title="Rotate"
        >
          {/* Rotation icon - curved arrow */}
          <svg
            width="8"
            height="8"
            viewBox="0 0 16 16"
            fill="white"
            style={{ pointerEvents: "none" }}
          >
            <path d="M8 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12zm0 1a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 1.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zm0 1a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z" />
            <path d="M6 4l2-2 2 2" stroke="white" strokeWidth="1" fill="none" />
          </svg>
        </div>
      </>
    );
  } else if (asset.type === "wall-segments") {
    // For wall segments, use stored dimensions if available, otherwise calculate from geometry
    let width, height;
    if (asset.width && asset.height) {
      // Use stored dimensions (same approach as shapes)
      width = asset.width * asset.scale;
      height = asset.height * asset.scale;
    } else {
      // Fallback to geometry calculation
      const boundingBox = calculateWallBoundingBox(asset);
      width = boundingBox.width * asset.scale;
      height = boundingBox.height * asset.scale;
    }
    
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
            backgroundColor: "#3B82F6",
            border: "2px solid #FFFFFF",
            borderRadius: "3px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(59, 130, 246, 0.2)",
            transition: "all 0.2s ease",
            transform: "translate(-50%, -50%)",
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
            backgroundColor: "#3B82F6",
            border: "2px solid #FFFFFF",
            borderRadius: "3px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(59, 130, 246, 0.2)",
            transition: "all 0.2s ease",
            transform: "translate(-50%, -50%)",
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
            backgroundColor: "#3B82F6",
            border: "2px solid #FFFFFF",
            borderRadius: "3px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(59, 130, 246, 0.2)",
            transition: "all 0.2s ease",
            transform: "translate(-50%, -50%)",
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
            backgroundColor: "#3B82F6",
            border: "2px solid #FFFFFF",
            borderRadius: "3px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(59, 130, 246, 0.2)",
            transition: "all 0.2s ease",
            transform: "translate(-50%, -50%)",
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
            backgroundColor: "#10B981",
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
            backgroundColor: "#10B981",
            border: "2px solid #FFFFFF",
            borderRadius: "50%",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(16, 185, 129, 0.2)",
            cursor: "grab",
            zIndex: 10,
            transform: "translate(-50%, -50%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          className="hover:bg-blue-600 transition-colors"
          title="Rotate"
        >
          {/* Rotation icon - curved arrow */}
          <svg
            width="8"
            height="8"
            viewBox="0 0 16 16"
            fill="white"
            style={{ pointerEvents: "none" }}
          >
            <path d="M8 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12zm0 1a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 1.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zm0 1a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z" />
            <path d="M6 4l2-2 2 2" stroke="white" strokeWidth="1" fill="none" />
          </svg>
        </div>
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
            backgroundColor: "#3B82F6",
            border: "2px solid #FFFFFF",
            borderRadius: "3px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(59, 130, 246, 0.2)",
            transition: "all 0.2s ease",
            transform: "translate(-50%, -50%)",
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
            backgroundColor: "#3B82F6",
            border: "2px solid #FFFFFF",
            borderRadius: "3px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(59, 130, 246, 0.2)",
            transition: "all 0.2s ease",
            transform: "translate(-50%, -50%)",
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
            backgroundColor: "#3B82F6",
            border: "2px solid #FFFFFF",
            borderRadius: "3px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(59, 130, 246, 0.2)",
            transition: "all 0.2s ease",
            transform: "translate(-50%, -50%)",
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
            backgroundColor: "#3B82F6",
            border: "2px solid #FFFFFF",
            borderRadius: "3px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(59, 130, 246, 0.2)",
            transition: "all 0.2s ease",
            transform: "translate(-50%, -50%)",
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
            backgroundColor: "#10B981",
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
            backgroundColor: "#10B981",
            border: "2px solid #FFFFFF",
            borderRadius: "50%",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(16, 185, 129, 0.2)",
            cursor: "grab",
            zIndex: 10,
            transform: "translate(-50%, -50%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          className="hover:bg-blue-600 transition-colors"
          title="Rotate"
        >
          {/* Rotation icon - curved arrow */}
          <svg
            width="8"
            height="8"
            viewBox="0 0 16 16"
            fill="white"
            style={{ pointerEvents: "none" }}
          >
            <path d="M8 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12zm0 1a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 1.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zm0 1a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z" />
            <path d="M6 4l2-2 2 2" stroke="white" strokeWidth="1" fill="none" />
          </svg>
        </div>
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
            backgroundColor: "#3B82F6",
            border: "2px solid #FFFFFF",
            borderRadius: "3px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(59, 130, 246, 0.2)",
            transition: "all 0.2s ease",
            transform: "translate(-50%, -50%)",
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
            backgroundColor: "#3B82F6",
            border: "2px solid #FFFFFF",
            borderRadius: "3px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(59, 130, 246, 0.2)",
            transition: "all 0.2s ease",
            transform: "translate(-50%, -50%)",
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
            backgroundColor: "#3B82F6",
            border: "2px solid #FFFFFF",
            borderRadius: "3px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(59, 130, 246, 0.2)",
            transition: "all 0.2s ease",
            transform: "translate(-50%, -50%)",
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
            backgroundColor: "#3B82F6",
            border: "2px solid #FFFFFF",
            borderRadius: "3px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(59, 130, 246, 0.2)",
            transition: "all 0.2s ease",
            transform: "translate(-50%, -50%)",
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
            backgroundColor: "#10B981",
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
            backgroundColor: "#10B981",
            border: "2px solid #FFFFFF",
            borderRadius: "50%",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(16, 185, 129, 0.2)",
            cursor: "grab",
            zIndex: 10,
            transform: "translate(-50%, -50%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          className="hover:bg-blue-600 transition-colors"
          title="Rotate"
        >
          {/* Rotation icon - curved arrow */}
          <svg
            width="8"
            height="8"
            viewBox="0 0 16 16"
            fill="white"
            style={{ pointerEvents: "none" }}
          >
            <path d="M8 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12zm0 1a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 1.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zm0 1a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z" />
            <path d="M6 4l2-2 2 2" stroke="white" strokeWidth="1" fill="none" />
          </svg>
        </div>
      </>
    );
  }
}
