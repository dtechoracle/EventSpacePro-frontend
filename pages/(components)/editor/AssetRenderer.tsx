import React from "react";
import Image from "next/image";
import { AssetInstance } from "@/store/sceneStore";
import { ASSET_LIBRARY } from "@/lib/assets";
import AssetHandlesRenderer from "./AssetHandlesRenderer";
import WallRendering from "./WallRendering";

type AssetRendererProps = {
  asset: AssetInstance;
  isSelected: boolean;
  isMultiSelected: boolean;
  isCopied: boolean;
  leftPx: number;
  topPx: number;
  totalRotation: number;
  editingTextId: string | null;
  editingText: string;
  onAssetMouseDown: (e: React.MouseEvent, assetId: string) => void;
  onTextDoubleClick: (e: React.MouseEvent, assetId: string) => void;
  onTextEditKeyDown: (e: React.KeyboardEvent, assetId: string) => void;
  onTextEditBlur: (assetId: string) => void;
  onTextEditChange: (text: string) => void;
  onScaleHandleMouseDown: (
    e: React.MouseEvent,
    assetId: string,
    handleType: "top-left" | "top-right" | "bottom-left" | "bottom-right"
  ) => void;
  onRotationHandleMouseDown: (e: React.MouseEvent, assetId: string) => void;
};

export default function AssetRenderer({
  asset,
  isSelected,
  isMultiSelected,
  isCopied,
  leftPx,
  topPx,
  totalRotation,
  editingTextId,
  editingText,
  onAssetMouseDown,
  onTextDoubleClick,
  onTextEditKeyDown,
  onTextEditBlur,
  onTextEditChange,
  onScaleHandleMouseDown,
  onRotationHandleMouseDown,
}: AssetRendererProps) {
  // Early return if asset is undefined (prevents SSR errors)
  if (!asset) {
    return null;
  }

  const def = ASSET_LIBRARY.find((a) => a.id === asset.type);

  // Handle square and circle assets
  if (asset.type === "square" || asset.type === "circle") {
    const isCircle = asset.type === "circle";
    const borderRadius = isCircle ? "50%" : "0%";
    
    return (
      <div className="relative">
        {/* Background layer */}
        {asset.backgroundColor && asset.backgroundColor !== "transparent" && (
          <div
            style={{
              position: "absolute",
              left: leftPx,
              top: topPx,
              width: (asset.width ?? 50) * asset.scale,
              height: (asset.height ?? 50) * asset.scale,
              backgroundColor: asset.backgroundColor,
              borderRadius: borderRadius,
              transform: `translate(-50%, -50%) rotate(${totalRotation}deg)`,
              zIndex: (asset.zIndex || 0) - 1,
            }}
          />
        )}

        {/* Main shape */}
        <div
          onMouseDown={(e) => onAssetMouseDown(e, asset.id)}
          style={{
            position: "absolute",
            left: leftPx,
            top: topPx,
            width: (asset.width ?? 50) * asset.scale,
            height: (asset.height ?? 50) * asset.scale,
            backgroundColor: asset.fillColor ?? "transparent",
            border: `${asset.strokeWidth ?? 2}px solid ${
              asset.strokeColor ?? "#000000"
            }`,
            borderRadius: borderRadius,
            transform: `translate(-50%, -50%) rotate(${totalRotation}deg)`,
            cursor: "move",
            zIndex: asset.zIndex || 0,
            boxShadow: isCopied ? "0 0 10px rgba(34, 197, 94, 0.8)" : undefined,
            transition: isCopied ? "box-shadow 0.3s ease" : undefined,
          }}
        />


        {/* Multi-select indicator */}
        {isMultiSelected && !isSelected && (
          <div
            style={{
              position: "absolute",
              left: leftPx,
              top: topPx,
              width: (asset.width ?? 50) * asset.scale,
              height: (asset.height ?? 50) * asset.scale,
              border: "2px dashed #3B82F6",
              borderRadius: borderRadius,
              transform: `translate(-50%, -50%) rotate(${totalRotation}deg)`,
              pointerEvents: "none",
              zIndex: (asset.zIndex || 0) + 1,
            }}
          />
        )}

        {/* Handles */}
        {(isSelected || isMultiSelected) && (
          <AssetHandlesRenderer
            asset={asset}
            leftPx={leftPx}
            topPx={topPx}
            onScaleHandleMouseDown={onScaleHandleMouseDown}
            onRotationHandleMouseDown={onRotationHandleMouseDown}
          />
        )}
      </div>
    );
  }

  // Handle line assets
  if (asset.type === "line") {
    return (
      <div className="relative">
        {/* Background layer */}
        {asset.backgroundColor && asset.backgroundColor !== "transparent" && (
          <div
            style={{
              position: "absolute",
              left: leftPx,
              top: topPx,
              width: (asset.width ?? 100) * asset.scale,
              height: (asset.strokeWidth ?? 2) * asset.scale,
              backgroundColor: asset.backgroundColor,
              transform: `translate(-50%, -50%) rotate(${totalRotation}deg)`,
              zIndex: (asset.zIndex || 0) - 1,
            }}
          />
        )}

        {/* Main line */}
        <div
          onMouseDown={(e) => onAssetMouseDown(e, asset.id)}
          style={{
            position: "absolute",
            left: leftPx,
            top: topPx,
            width: (asset.width ?? 100) * asset.scale,
            height: (asset.strokeWidth ?? 2) * asset.scale,
            backgroundColor: asset.strokeColor,
            transform: `translate(-50%, -50%) rotate(${totalRotation}deg)`,
            cursor: "move",
            zIndex: asset.zIndex || 0,
            boxShadow: isCopied ? "0 0 10px rgba(34, 197, 94, 0.8)" : undefined,
            transition: isCopied ? "box-shadow 0.3s ease" : undefined,
          }}
        />

        {/* Multi-select indicator */}
        {isMultiSelected && !isSelected && (
          <div
            style={{
              position: "absolute",
              left: leftPx,
              top: topPx,
              width: (asset.width ?? 100) * asset.scale,
              height: (asset.strokeWidth ?? 2) * asset.scale,
              border: "2px dashed #3B82F6",
              borderRadius: "0px",
              transform: `translate(-50%, -50%) rotate(${totalRotation}deg)`,
              pointerEvents: "none",
              zIndex: (asset.zIndex || 0) + 1,
            }}
          />
        )}

        {/* Handles */}
        {(isSelected || isMultiSelected) && (
          <AssetHandlesRenderer
            asset={asset}
            leftPx={leftPx}
            topPx={topPx}
            onScaleHandleMouseDown={onScaleHandleMouseDown}
            onRotationHandleMouseDown={onRotationHandleMouseDown}
          />
        )}
      </div>
    );
  }

  // Handle double-line assets
  if (asset.type === "double-line") {
    const lineGap = (asset.lineGap ?? 8) * asset.scale;
    const isHorizontal = asset.isHorizontal ?? true;

    // Get the line thickness and length
    const lineThickness = 2; // Fixed thickness for now
    const lineLength = isHorizontal ? asset.width ?? 100 : asset.height ?? 100;

    const containerWidth = isHorizontal
      ? lineLength * asset.scale
      : lineThickness + lineGap;
    const containerHeight = isHorizontal
      ? lineThickness + lineGap
      : lineLength * asset.scale;

    return (
      <div className="relative">
        {/* Background layer */}
        {asset.backgroundColor && asset.backgroundColor !== "transparent" && (
          <div
            style={{
              position: "absolute",
              left: leftPx,
              top: topPx,
              width: containerWidth,
              height: containerHeight,
              backgroundColor: asset.backgroundColor,
              transform: `translate(-50%, -50%) rotate(${totalRotation}deg)`,
              zIndex: (asset.zIndex || 0) - 1,
            }}
          />
        )}

        {/* Main double-line container */}
        <div
          onMouseDown={(e) => onAssetMouseDown(e, asset.id)}
          style={{
            position: "absolute",
            left: leftPx,
            top: topPx,
            width: containerWidth,
            height: containerHeight,
            transform: `translate(-50%, -50%) rotate(${totalRotation}deg)`,
            cursor: "move",
            zIndex: asset.zIndex || 0,
            boxShadow: isCopied ? "0 0 10px rgba(34, 197, 94, 0.8)" : undefined,
            transition: isCopied ? "box-shadow 0.3s ease" : undefined,
          }}
        >
          {isHorizontal ? (
            <>
              {/* First line - horizontal */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: lineThickness,
                  backgroundColor: asset.lineColor ?? "#000000",
                }}
              />
              {/* Second line - horizontal */}
              <div
                style={{
                  position: "absolute",
                  top: lineThickness + lineGap,
                  left: 0,
                  width: "100%",
                  height: lineThickness,
                  backgroundColor: asset.lineColor ?? "#000000",
                }}
              />
            </>
          ) : (
            <>
              {/* First line - vertical */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: lineThickness,
                  height: "100%",
                  backgroundColor: asset.lineColor ?? "#000000",
                }}
              />
              {/* Second line - vertical */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: lineThickness + lineGap,
                  width: lineThickness,
                  height: "100%",
                  backgroundColor: asset.lineColor ?? "#000000",
                }}
              />
            </>
          )}
        </div>

        {/* Multi-select indicator */}
        {isMultiSelected && !isSelected && (
          <div
            style={{
              position: "absolute",
              left: leftPx,
              top: topPx,
              width: (asset.width ?? 50) * asset.scale,
              height: (asset.height ?? 50) * asset.scale,
              border: "2px dashed #3B82F6",
              borderRadius: "0px",
              transform: `translate(-50%, -50%) rotate(${totalRotation}deg)`,
              pointerEvents: "none",
              zIndex: (asset.zIndex || 0) + 1,
            }}
          />
        )}

        {/* Handles */}
        {(isSelected || isMultiSelected) && (
          <AssetHandlesRenderer
            asset={asset}
            leftPx={leftPx}
            topPx={topPx}
            onScaleHandleMouseDown={onScaleHandleMouseDown}
            onRotationHandleMouseDown={onRotationHandleMouseDown}
          />
        )}
      </div>
    );
  }

  // Handle drawn-line assets
  if (asset.type === "drawn-line") {
    return (
      <div className="relative">
        {/* Background layer */}
        {asset.backgroundColor && asset.backgroundColor !== "transparent" && (
          <div
            style={{
              position: "absolute",
              left: leftPx,
              top: topPx,
              width: 100,
              height: 100,
              backgroundColor: asset.backgroundColor,
              transform: `translate(-50%, -50%) rotate(${totalRotation}deg)`,
              zIndex: (asset.zIndex || 0) - 1,
            }}
          />
        )}

        {/* Main drawn line */}
        <div
          onMouseDown={(e) => onAssetMouseDown(e, asset.id)}
          style={{
            position: "absolute",
            left: leftPx,
            top: topPx,
            transform: `translate(-50%, -50%) rotate(${totalRotation}deg)`,
            cursor: "move",
            zIndex: asset.zIndex || 0,
            boxShadow: isCopied ? "0 0 10px rgba(34, 197, 94, 0.8)" : undefined,
            transition: isCopied ? "box-shadow 0.3s ease" : undefined,
          }}
        >
          <svg
            width="200"
            height="200"
            viewBox="-100 -100 200 200"
            style={{ overflow: "visible" }}
          >
            {asset.path && asset.path.length > 1 && (
              <path
                d={`M ${asset.path[0].x} ${asset.path[0].y} ${asset.path
                  .slice(1)
                  .map((point) => `L ${point.x} ${point.y}`)
                  .join(" ")}`}
                stroke={asset.strokeColor ?? "#000000"}
                strokeWidth={(asset.strokeWidth ?? 2) * asset.scale}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </svg>
        </div>

        {/* Multi-select indicator */}
        {isMultiSelected && !isSelected && (
          <div
            style={{
              position: "absolute",
              left: leftPx,
              top: topPx,
              width: (asset.width ?? 50) * asset.scale,
              height: (asset.height ?? 50) * asset.scale,
              border: "2px dashed #3B82F6",
              borderRadius: "0px",
              transform: `translate(-50%, -50%) rotate(${totalRotation}deg)`,
              pointerEvents: "none",
              zIndex: (asset.zIndex || 0) + 1,
            }}
          />
        )}

        {/* Handles */}
        {(isSelected || isMultiSelected) && (
          <AssetHandlesRenderer
            asset={asset}
            leftPx={leftPx}
            topPx={topPx}
            onScaleHandleMouseDown={onScaleHandleMouseDown}
            onRotationHandleMouseDown={onRotationHandleMouseDown}
          />
        )}
      </div>
    );
  }

  // Handle wall-segments assets
  if (asset.type === "wall-segments") {
    return (
      <div className="relative">
        {/* Background layer */}
        {asset.backgroundColor && asset.backgroundColor !== "transparent" && (
          <div
            style={{
              position: "absolute",
              left: leftPx,
              top: topPx,
              width: 200,
              height: 200,
              backgroundColor: asset.backgroundColor,
              transform: `translate(-50%, -50%) rotate(${totalRotation}deg)`,
              zIndex: (asset.zIndex || 0) - 1,
            }}
          />
        )}

        {/* Main wall segments */}
        <div
          onMouseDown={(e) => onAssetMouseDown(e, asset.id)}
          style={{
            position: "absolute",
            left: leftPx,
            top: topPx,
            transform: `translate(-50%, -50%) rotate(${totalRotation}deg)`,
            cursor: "move",
            zIndex: asset.zIndex || 0,
            boxShadow: isCopied ? "0 0 10px rgba(34, 197, 94, 0.8)" : undefined,
            transition: isCopied ? "box-shadow 0.3s ease" : undefined,
          }}
        >
          <WallRendering asset={asset} leftPx={0} topPx={0} totalRotation={0} />
        </div>

        {/* Multi-select indicator */}
        {isMultiSelected && !isSelected && (
          <div
            style={{
              position: "absolute",
              left: leftPx,
              top: topPx,
              width: (asset.width ?? 50) * asset.scale,
              height: (asset.height ?? 50) * asset.scale,
              border: "2px dashed #3B82F6",
              borderRadius: "0px",
              transform: `translate(-50%, -50%) rotate(${totalRotation}deg)`,
              pointerEvents: "none",
              zIndex: (asset.zIndex || 0) + 1,
            }}
          />
        )}

        {/* Handles */}
        {(isSelected || isMultiSelected) && (
          <AssetHandlesRenderer
            asset={asset}
            leftPx={leftPx}
            topPx={topPx}
            onScaleHandleMouseDown={onScaleHandleMouseDown}
            onRotationHandleMouseDown={onRotationHandleMouseDown}
          />
        )}
      </div>
    );
  }

  // Handle text assets
  if (asset.type === "text") {
    const isEditing = editingTextId === asset.id;

    return (
      <div className="relative">
        {/* Background layer */}
        {asset.backgroundColor && asset.backgroundColor !== "transparent" && (
          <div
            style={{
              position: "absolute",
              left: leftPx,
              top: topPx,
              transform: `translate(-50%, -50%) rotate(${totalRotation}deg) scale(${asset.scale})`,
              backgroundColor: asset.backgroundColor,
              padding: "4px 8px",
              borderRadius: "4px",
              zIndex: (asset.zIndex || 0) - 1,
            }}
          />
        )}

        {isEditing ? (
          <input
            type="text"
            value={editingText}
            onChange={(e) => onTextEditChange(e.target.value)}
            onKeyDown={(e) => onTextEditKeyDown(e, asset.id)}
            onBlur={() => onTextEditBlur(asset.id)}
            autoFocus
            style={{
              position: "absolute",
              left: leftPx,
              top: topPx,
              transform: `translate(-50%, -50%) rotate(${totalRotation}deg) scale(${asset.scale})`,
              fontSize: `${asset.fontSize ?? 16}px`,
              color: asset.textColor ?? "#000000",
              fontFamily: asset.fontFamily ?? "Arial",
              background:
                asset.backgroundColor && asset.backgroundColor !== "transparent"
                  ? asset.backgroundColor
                  : "transparent",
              border: "none",
              outline: "none",
              padding:
                asset.backgroundColor && asset.backgroundColor !== "transparent"
                  ? "4px 8px"
                  : "0",
              margin: 0,
              minWidth: "100px",
              borderRadius: "4px",
              zIndex: asset.zIndex || 0,
            }}
            className="text-center"
          />
        ) : (
          <div
            onMouseDown={(e) => onAssetMouseDown(e, asset.id)}
            onDoubleClick={(e) => onTextDoubleClick(e, asset.id)}
            style={{
              position: "absolute",
              left: leftPx,
              top: topPx,
              transform: `translate(-50%, -50%) rotate(${totalRotation}deg) scale(${asset.scale})`,
              fontSize: `${asset.fontSize ?? 16}px`,
              color: asset.textColor ?? "#000000",
              fontFamily: asset.fontFamily ?? "Arial",
              backgroundColor:
                asset.backgroundColor && asset.backgroundColor !== "transparent"
                  ? asset.backgroundColor
                  : "transparent",
              padding:
                asset.backgroundColor && asset.backgroundColor !== "transparent"
                  ? "4px 8px"
                  : "0",
              borderRadius: "4px",
              whiteSpace: "nowrap",
              userSelect: "none",
              cursor: "move",
              zIndex: asset.zIndex || 0,
              boxShadow: isCopied
                ? "0 0 10px rgba(34, 197, 94, 0.8)"
                : undefined,
              transition: isCopied ? "box-shadow 0.3s ease" : undefined,
            }}
          >
            {asset.text ?? "Enter text"}
          </div>
        )}

        {/* Handles */}
        {(isSelected || isMultiSelected) && !isEditing && (
          <AssetHandlesRenderer
            asset={asset}
            leftPx={leftPx}
            topPx={topPx}
            onScaleHandleMouseDown={onScaleHandleMouseDown}
            onRotationHandleMouseDown={onRotationHandleMouseDown}
          />
        )}
      </div>
    );
  }

  if (!def) return null;

  // Handle custom SVG assets
  if (def.isCustom && def.path) {
    return (
      <div className="relative">
        {/* Background layer */}
        {asset.backgroundColor && asset.backgroundColor !== "transparent" && (
          <div
            style={{
              position: "absolute",
              left: leftPx,
              top: topPx,
              width: (asset.width ?? 24) * asset.scale,
              height: (asset.height ?? 24) * asset.scale,
              backgroundColor: asset.backgroundColor,
              transform: `translate(-50%, -50%) rotate(${totalRotation}deg)`,
              zIndex: (asset.zIndex || 0) - 1,
            }}
          />
        )}

        <div
          onMouseDown={(e) => onAssetMouseDown(e, asset.id)}
          style={{
            position: "absolute",
            left: leftPx,
            top: topPx,
            width: (asset.width ?? 24) * asset.scale,
            height: (asset.height ?? 24) * asset.scale,
            transform: `translate(-50%, -50%) rotate(${totalRotation}deg)`,
            cursor: "move",
            zIndex: asset.zIndex || 0,
            boxShadow: isCopied ? "0 0 10px rgba(34, 197, 94, 0.8)" : undefined,
            transition: isCopied ? "box-shadow 0.3s ease" : undefined,
          }}
        >
          <Image
            src={def.path}
            alt={def.label}
            fill
            style={{ objectFit: "contain" }}
          />
        </div>

        {/* Multi-select indicator */}
        {isMultiSelected && !isSelected && (
          <div
            style={{
              position: "absolute",
              left: leftPx,
              top: topPx,
              width: (asset.width ?? 50) * asset.scale,
              height: (asset.height ?? 50) * asset.scale,
              border: "2px dashed #3B82F6",
              borderRadius: "0px",
              transform: `translate(-50%, -50%) rotate(${totalRotation}deg)`,
              pointerEvents: "none",
              zIndex: (asset.zIndex || 0) + 1,
            }}
          />
        )}

        {/* Handles */}
        {(isSelected || isMultiSelected) && (
          <AssetHandlesRenderer
            asset={asset}
            leftPx={leftPx}
            topPx={topPx}
            onScaleHandleMouseDown={onScaleHandleMouseDown}
            onRotationHandleMouseDown={onRotationHandleMouseDown}
          />
        )}
      </div>
    );
  }

  // Handle regular icon assets
  const Icon = def.icon;
  if (!Icon) return null;

  return (
    <div className="relative">
      {/* Background layer */}
      {asset.backgroundColor && asset.backgroundColor !== "transparent" && (
        <div
          style={{
            position: "absolute",
            left: leftPx,
            top: topPx,
            width: (asset.width ?? 24) * asset.scale,
            height: (asset.height ?? 24) * asset.scale,
            backgroundColor: asset.backgroundColor,
            transform: `translate(-50%, -50%) rotate(${totalRotation}deg)`,
            zIndex: (asset.zIndex || 0) - 1,
          }}
        />
      )}

      <div
        onMouseDown={(e) => onAssetMouseDown(e, asset.id)}
        style={{
          position: "absolute",
          left: leftPx,
          top: topPx,
          width: (asset.width ?? 24) * asset.scale,
          height: (asset.height ?? 24) * asset.scale,
          transform: `translate(-50%, -50%) rotate(${totalRotation}deg)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "move",
          zIndex: asset.zIndex,
          boxShadow: isCopied ? "0 0 10px rgba(34, 197, 94, 0.8)" : undefined,
          transition: isCopied ? "box-shadow 0.3s ease" : undefined,
        }}
        className="text-[var(--accent)]"
      >
        <Icon
          size={Math.min(
            (asset.width ?? 24) * asset.scale,
            (asset.height ?? 24) * asset.scale
          )}
        />
      </div>

      {/* Handles */}
      {(isSelected || isMultiSelected) && (
        <AssetHandlesRenderer
          asset={asset}
          leftPx={leftPx}
          topPx={topPx}
          onScaleHandleMouseDown={onScaleHandleMouseDown}
          onRotationHandleMouseDown={onRotationHandleMouseDown}
        />
      )}
    </div>
  );
}
