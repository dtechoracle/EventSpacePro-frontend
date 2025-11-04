"use client";
import React from "react";
import { AssetInstance } from "@/store/sceneStore";
import { calculateWallBoundingBox } from "@/lib/wallGeometry";

interface AssetHandlesRendererProps {
  asset?: AssetInstance | null;
  leftPx: number;
  topPx: number;
  onScaleHandleMouseDown: (
    e: React.MouseEvent,
    assetId: string,
    handleType: "top-left" | "top-right" | "bottom-left" | "bottom-right"
  ) => void;
  onRotationHandleMouseDown: (e: React.MouseEvent, assetId: string) => void;
}

const HANDLE_TYPES = ["top-left", "top-right", "bottom-left", "bottom-right"] as const;
type HandleType = (typeof HANDLE_TYPES)[number];

export default function AssetHandlesRenderer({
  asset,
  leftPx,
  topPx,
  onScaleHandleMouseDown,
  onRotationHandleMouseDown
}: AssetHandlesRendererProps) {
  if (!asset) return null;

  const handleSize = 14;
  const padding = 6;
  const rotationHandleDistance = 30;
  const rotationDeg = asset.rotation ?? 0;
  const scale = asset.scale ?? 1;

  let w = (asset.width ?? 50) * scale;
  let h = (asset.height ?? 50) * scale;

  // Default: handles centered on the provided asset center
  let offsetCenterPx = { x: 0, y: 0 };

  // ---- SPECIAL CASE: DRAWN FREE LINE / PATH ---- //
  if (asset.type === "drawn-line") {
    const path = asset.path ?? [];

    if (path.length > 0) {
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;

      for (const p of path) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }

      // actual width/height of drawn region
      w = (maxX - minX) * scale;
      h = (maxY - minY) * scale;

      // ✅ local center of drawing
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;

      // ✅ offset container relative to asset center like other asset types
      offsetCenterPx = {
        x: (cx - asset.x) * scale,
        y: (cy - asset.y) * scale
      };
    }
  }

  // ---- OTHER ASSET TYPES ---- //

  if (asset.type === "line") {
    w = (asset.width ?? 100) * scale;
    h = Math.max((asset.strokeWidth ?? 2) * scale, 6);
  }

  if (asset.type === "double-line") {
    const gap = (asset.lineGap ?? 8) * scale;
    const isHorizontal = asset.isHorizontal ?? true;
    const thickness = 2;

    w = isHorizontal ? (asset.width ?? 100) * scale : thickness + gap;
    h = isHorizontal ? thickness + gap : (asset.height ?? 100) * scale;
  }

  if (asset.type === "text") {
    const font = (asset.fontSize ?? 16) * scale;
    const len = (asset.text ?? "").length;
    w = Math.max(len * font * 0.6, 50);
    h = font * 1.2;
  }

  if (asset.type === "wall-segments") {
    const bb = calculateWallBoundingBox(asset);
    w = bb.width * scale;
    h = bb.height * scale;
  }

  // Half size for corner handles
  const halfW = w / 2;
  const halfH = h / 2;

  const corners: Record<HandleType, { x: number; y: number; cursor: string }> = {
    "top-left": { x: -halfW - padding, y: -halfH - padding, cursor: "nw-resize" },
    "top-right": { x: halfW + padding, y: -halfH - padding, cursor: "ne-resize" },
    "bottom-left": { x: -halfW - padding, y: halfH + padding, cursor: "sw-resize" },
    "bottom-right": { x: halfW + padding, y: halfH + padding, cursor: "se-resize" }
  };

  const rotationHandle = { x: 0, y: -halfH - rotationHandleDistance };

  const containerStyle: React.CSSProperties = {
    position: "absolute",
    left: leftPx + offsetCenterPx.x,
    top: topPx + offsetCenterPx.y,
    transform: `translate(-50%, -50%) rotate(${rotationDeg}deg)`,
    pointerEvents: "none",
    zIndex: 9999
  };

  const cornerBaseStyle: React.CSSProperties = {
    position: "absolute",
    width: handleSize,
    height: handleSize,
    backgroundColor: "#3B82F6",
    border: "2px solid #FFFFFF",
    borderRadius: 3,
    transform: "translate(-50%, -50%)",
    zIndex: 10000
  };

  const rotationBaseStyle: React.CSSProperties = {
    position: "absolute",
    width: handleSize,
    height: handleSize,
    backgroundColor: "#10B981",
    border: "2px solid #FFFFFF",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transform: "translate(-50%, -50%)",
    cursor: "grab",
    zIndex: 10000
  };

  return (
    <div style={containerStyle}>
      {Object.entries(corners).map(([id, pos]) => (
        <div
          key={id}
          onMouseDown={(e) => {
            e.stopPropagation();
            onScaleHandleMouseDown(e, asset.id, id as HandleType);
          }}
          style={{
            ...cornerBaseStyle,
            left: pos.x,
            top: pos.y,
            cursor: pos.cursor,
            pointerEvents: "auto"
          }}
        />
      ))}

      <div
        style={{
          position: "absolute",
          left: rotationHandle.x,
          top: rotationHandle.y + handleSize / 2,
          width: 2,
          height: rotationHandleDistance + handleSize / 2,
          transform: "translate(-50%, -100%)",
          backgroundColor: "#10B981",
          pointerEvents: "none",
          zIndex: 9998
        }}
      />

      <div
        onMouseDown={(e) => {
          e.stopPropagation();
          onRotationHandleMouseDown(e, asset.id);
        }}
        style={{
          ...rotationBaseStyle,
          left: rotationHandle.x,
          top: rotationHandle.y,
          pointerEvents: "auto"
        }}
      >
        <svg width="10" height="10" viewBox="0 0 16 16" fill="white">
          <path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z" />
          <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z" />
        </svg>
      </div>
    </div>
  );
}

