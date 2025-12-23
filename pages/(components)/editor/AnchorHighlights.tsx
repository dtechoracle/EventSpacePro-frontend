"use client";

import React from "react";
import { useSceneStore, AssetInstance } from "@/store/sceneStore";
import { calculateShapeAnchors, calculateAssetAnchors, AnchorPoint } from "@/utils/snapAnchors";

interface AnchorHighlightsProps {
  mmToPx: number;
}

export default function AnchorHighlights({ mmToPx }: AnchorHighlightsProps) {
  const snapToAnchorMode = useSceneStore((s) => s.snapToAnchorMode);
  const snapTargetAssetId = useSceneStore((s) => s.snapTargetAssetId);
  const snapTargetAnchor = useSceneStore((s) => s.snapTargetAnchor);
  const snapSourceAssetId = useSceneStore((s) => s.snapSourceAssetId);
  const snapSourceAnchor = useSceneStore((s) => s.snapSourceAnchor);
  const assets = useSceneStore((s) => s.assets);

  if (!snapToAnchorMode) return null;

  const targetAsset = snapTargetAssetId ? assets.find((a) => a.id === snapTargetAssetId) : null;
  const sourceAsset = snapSourceAssetId ? assets.find((a) => a.id === snapSourceAssetId) : null;
  
  // Debug logging
  if (snapToAnchorMode) {
    console.log('AnchorHighlights render:', {
      snapSourceAssetId,
      snapSourceAnchor,
      snapTargetAssetId,
      snapTargetAnchor,
      sourceAsset: sourceAsset ? { id: sourceAsset.id, type: sourceAsset.type } : null,
      targetAsset: targetAsset ? { id: targetAsset.id, type: targetAsset.type } : null
    });
  }

  const renderAnchors = (asset: AssetInstance, isTarget: boolean) => {
    const isShape = asset.type === "square" || asset.type === "circle";
    const anchors: AnchorPoint[] = isShape
      ? calculateShapeAnchors({
          x: asset.x,
          y: asset.y,
          width: asset.width || 0,
          height: asset.height || 0,
        } as any)
      : calculateAssetAnchors({
          x: asset.x,
          y: asset.y,
          width: asset.width || 0,
          height: asset.height || 0,
          scale: asset.scale || 1,
        } as any);

    const highlightColor = isTarget ? "#3B82F6" : "#22C55E"; // Blue for target, green for source
    const selectedAnchorId = isTarget ? snapTargetAnchor : snapSourceAnchor;

    // Calculate bounding box correctly
    const halfW = isShape 
      ? (asset.width || 0) / 2
      : ((asset.width || 0) * (asset.scale || 1)) / 2;
    const halfH = isShape
      ? (asset.height || 0) / 2
      : ((asset.height || 0) * (asset.scale || 1)) / 2;

    return (
      <g key={asset.id}>
        {/* Highlight the asset bounding box */}
        <rect
          x={(asset.x - halfW) * mmToPx}
          y={(asset.y - halfH) * mmToPx}
          width={halfW * 2 * mmToPx}
          height={halfH * 2 * mmToPx}
          fill="none"
          stroke={highlightColor}
          strokeWidth={2}
          strokeDasharray="4,4"
          opacity={0.6}
          style={{ pointerEvents: "none" }}
        />
        {/* Render all anchor points */}
        {anchors.map((anchor) => {
          const isSelected = anchor.id === selectedAnchorId;
          return (
            <g key={anchor.id}>
              {/* Anchor point circle - larger for easier clicking */}
              <circle
                cx={anchor.x * mmToPx}
                cy={anchor.y * mmToPx}
                r={isSelected ? 8 : 6}
                fill={isSelected ? highlightColor : "#FFFFFF"}
                stroke={highlightColor}
                strokeWidth={isSelected ? 3 : 2}
                opacity={isSelected ? 1 : 0.9}
              />
              {/* Invisible larger circle for easier clicking */}
              <circle
                cx={anchor.x * mmToPx}
                cy={anchor.y * mmToPx}
                r={12}
                fill="transparent"
                stroke="none"
                pointerEvents="all"
                style={{ cursor: "pointer" }}
              />
              {/* Anchor label */}
              <text
                x={anchor.x * mmToPx}
                y={anchor.y * mmToPx - 12}
                fill={highlightColor}
                fontSize="10"
                fontWeight={isSelected ? "bold" : "normal"}
                textAnchor="middle"
                style={{ pointerEvents: "none" }}
              >
                {anchor.label}
              </text>
            </g>
          );
        })}
      </g>
    );
  };

  return (
    <svg
      className="absolute inset-0"
      style={{ zIndex: 10, pointerEvents: "auto" }}
    >
      {targetAsset && renderAnchors(targetAsset, true)}
      {sourceAsset && renderAnchors(sourceAsset, false)}
    </svg>
  );
}