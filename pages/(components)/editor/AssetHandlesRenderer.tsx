import { AssetInstance } from "@/store/sceneStore";
import React from "react";

interface AssetHandlesRendererProps {
  asset: AssetInstance;
  leftPx: number;
  topPx: number;
  onScaleHandleMouseDown: (
    e: React.MouseEvent,
    assetId: string,
    handleType: "top-left" | "top-right" | "bottom-left" | "bottom-right"
  ) => void;
  onRotationHandleMouseDown: (e: React.MouseEvent, assetId: string) => void;
}

export default function AssetHandlesRenderer({
  asset,
  leftPx,
  topPx,
  onScaleHandleMouseDown,
  onRotationHandleMouseDown,
}: AssetHandlesRendererProps) {
  if (!asset) return null;

  const handleSize = 14;
  const halfHandle = handleSize / 2;

  // Shared handle base style
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

  // Compute scaled dimensions
  const w = (asset.width ?? 100) * asset.scale;
  const h = (asset.height ?? 100) * asset.scale;

  // Compute handle positions relative to asset center
  const box = {
    topLeft: { x: -w / 2, y: -h / 2 },
    topRight: { x: w / 2, y: -h / 2 },
    bottomLeft: { x: -w / 2, y: h / 2 },
    bottomRight: { x: w / 2, y: h / 2 },
    rot: { x: 0, y: -h / 2 - 30 },
  };

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        pointerEvents: "none",
        transform: `translate3d(${leftPx}px, ${topPx}px, 0)`,
      }}
    >
      {/* Resize Handles */}
      <div
        onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, "top-left")}
        style={{
          ...baseHandleStyle,
          transform: `translate(${box.topLeft.x}px, ${box.topLeft.y}px)`,
        }}
      />
      <div
        onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, "top-right")}
        style={{
          ...baseHandleStyle,
          transform: `translate(${box.topRight.x}px, ${box.topRight.y}px)`,
        }}
      />
      <div
        onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, "bottom-left")}
        style={{
          ...baseHandleStyle,
          transform: `translate(${box.bottomLeft.x}px, ${box.bottomLeft.y}px)`,
        }}
      />
      <div
        onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, "bottom-right")}
        style={{
          ...baseHandleStyle,
          transform: `translate(${box.bottomRight.x}px, ${box.bottomRight.y}px)`,
        }}
      />

      {/* Rotation Handle */}
      <div
        onMouseDown={(e) => onRotationHandleMouseDown(e, asset.id)}
        style={{
          ...rotationStyle,
          transform: `translate(${box.rot.x}px, ${box.rot.y}px)`,
        }}
      />
    </div>
  );
}

