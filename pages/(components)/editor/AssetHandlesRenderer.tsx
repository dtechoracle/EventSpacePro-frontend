import { AssetInstance } from "@/store/sceneStore";
import React, { useMemo } from "react";
import { calculateWallBoundingBox } from "@/lib/wallGeometry"; // should return BoundingBox-like object

interface AssetHandlesRendererProps {
  asset: AssetInstance;
  leftPx: number;
  topPx: number;
  onScaleHandleMouseDown: (
    e: React.MouseEvent,
    assetId: string,
    handleType: "top-left" | "top-right" | "bottom-left" | "bottom-right",
  ) => void;
  onRotationHandleMouseDown: (e: React.MouseEvent, assetId: string) => void;
}

/** Ensure this matches whatever calculateWallBoundingBox returns */
type BoundingBox = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

type CornerKey = "topLeft" | "topRight" | "bottomLeft" | "bottomRight";

export default function AssetHandlesRenderer({
  asset,
  leftPx,
  topPx,
  onScaleHandleMouseDown,
  onRotationHandleMouseDown,
}: AssetHandlesRendererProps) {
  const handleSize = 14;
  const halfHandle = handleSize / 2;

  const baseHandleStyle: React.CSSProperties = {
    position: "absolute",
    width: handleSize,
    height: handleSize,
    borderRadius: "3px",
    background: "#000000",
    border: "2px solid #fff",
    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
    cursor: "grab",
    zIndex: 10,
    userSelect: "none",
    pointerEvents: "auto",
    transform: "translate(-50%, -50%)",
  };

  const rotationStyle: React.CSSProperties = {
    ...baseHandleStyle,
    background: "#000000",
    borderRadius: "50%",
    cursor: "crosshair",
  };

  const boundingBox: BoundingBox = useMemo(() => {
    if (asset.type === "wall" || asset.type === "line") {
      // No longer need the type assertion
      return calculateWallBoundingBox(asset);
    }

    // fallback for images or simple assets (centered on 0,0)
    const w = (asset.width ?? 100) * (asset.scale ?? 1);
    const h = (asset.height ?? 100) * (asset.scale ?? 1);

    return {
      minX: -w / 2,
      minY: -h / 2,
      maxX: w / 2,
      maxY: h / 2,
    };
  }, [asset]);

  if (!asset) return null;

  const w = boundingBox.maxX - boundingBox.minX;
  const h = boundingBox.maxY - boundingBox.minY;
  const centerX = (boundingBox.maxX + boundingBox.minX) / 2;
  const centerY = (boundingBox.maxY + boundingBox.minY) / 2;

  // typed box object
  const box: Record<CornerKey, { x: number; y: number }> & {
    rot: { x: number; y: number };
  } = {
    topLeft: { x: boundingBox.minX, y: boundingBox.minY },
    topRight: { x: boundingBox.maxX, y: boundingBox.minY },
    bottomLeft: { x: boundingBox.minX, y: boundingBox.maxY },
    bottomRight: { x: boundingBox.maxX, y: boundingBox.maxY },
    rot: { x: centerX, y: boundingBox.minY - 30 },
  };

  // map keys to the dashed handle types your handler expects
  const handleKeyToHandleType: Record<
    CornerKey,
    "top-left" | "top-right" | "bottom-left" | "bottom-right"
  > = {
    topLeft: "top-left",
    topRight: "top-right",
    bottomLeft: "bottom-left",
    bottomRight: "bottom-right",
  };

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        pointerEvents: "none",
        transform: `translate3d(${leftPx}px, ${topPx}px, 0) rotate(${asset.rotation ?? 0}rad)`,
        transformOrigin: "center center",
      }}
    >
      {/* selection rectangle using the true bounding box */}
      <div
        style={{
          position: "absolute",
          left: boundingBox.minX,
          top: boundingBox.minY,
          width: w,
          height: h,
          border: "1.5px solid #3B82F6",
          borderRadius: "4px",
          boxSizing: "border-box",
        }}
      />

      {/* resize handles */}
      {(
        ["topLeft", "topRight", "bottomLeft", "bottomRight"] as CornerKey[]
      ).map((key) => (
        <div
          key={key}
          onMouseDown={(e) => {
            // re-enable pointer events only for the mousedown target
            e.stopPropagation();
            onScaleHandleMouseDown(e, asset.id, handleKeyToHandleType[key]);
          }}
          style={{
            ...baseHandleStyle,
            // use left/top instead of transform translate to avoid stacking transform orders
            left: box[key].x,
            top: box[key].y,
            position: "absolute",
            pointerEvents: "auto", // allow interaction on the handles
            transform: "translate(-50%, -50%)",
          }}
        />
      ))}

      {/* rotation handle */}
      <div
        onMouseDown={(e) => {
          e.stopPropagation();
          onRotationHandleMouseDown(e, asset.id);
        }}
        style={{
          ...rotationStyle,
          left: box.rot.x,
          top: box.rot.y,
          position: "absolute",
          pointerEvents: "auto",
          transform: "translate(-50%, -50%)",
        }}
      />
    </div>
  );
}
