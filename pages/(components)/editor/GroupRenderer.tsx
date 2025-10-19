import React from 'react';
import { AssetInstance } from '../../../store/sceneStore';
import AssetRenderer from './AssetRenderer';
import AssetHandlesRenderer from './AssetHandlesRenderer';

interface GroupRendererProps {
  group: AssetInstance;
  leftPx: number;
  topPx: number;
  mmToPx: number;
  isSelected: boolean;
  isMultiSelected: boolean;
  onAssetClick: (id: string) => void;
  onAssetDoubleClick: (id: string) => void;
  onAssetMouseDown: (e: React.MouseEvent, id: string) => void;
  onAssetMouseMove: (e: React.MouseEvent, id: string) => void;
  onAssetMouseUp: (e: React.MouseEvent, id: string) => void;
  onAssetMouseLeave: (e: React.MouseEvent, id: string) => void;
  onAssetMouseEnter: (e: React.MouseEvent, id: string) => void;
  onAssetMouseOver: (e: React.MouseEvent, id: string) => void;
  onAssetMouseOut: (e: React.MouseEvent, id: string) => void;
  onAssetContextMenu: (e: React.MouseEvent, id: string) => void;
  onScaleHandleMouseDown: (e: React.MouseEvent, assetId: string, handleType: "top-left" | "top-right" | "bottom-left" | "bottom-right") => void;
  onRotationHandleMouseDown: (e: React.MouseEvent, assetId: string) => void;
  selectedAssetId: string | null;
  selectedAssetIds: string[];
}

const GroupRenderer: React.FC<GroupRendererProps> = ({
  group,
  leftPx,
  topPx,
  mmToPx,
  isSelected,
  isMultiSelected,
  onAssetClick,
  onAssetDoubleClick,
  onAssetMouseDown,
  onAssetMouseMove,
  onAssetMouseUp,
  onAssetMouseLeave,
  onAssetMouseEnter,
  onAssetMouseOver,
  onAssetMouseOut,
  onAssetContextMenu,
  onScaleHandleMouseDown,
  onRotationHandleMouseDown,
  selectedAssetId,
  selectedAssetIds,
}) => {
  if (!group || !group.isGroup || !group.groupAssets) return null;

  // Only show group container when group itself is selected
  const showGroupContainer = isSelected || isMultiSelected;
  
  return (
    <>
      {/* Group container - only show when group is selected */}
      {showGroupContainer && (
        <div
          style={{
            position: 'absolute',
            left: leftPx,
            top: topPx,
            width: (group.width || 100) * mmToPx,
            height: (group.height || 100) * mmToPx,
            transform: `translate(-50%, -50%) rotate(${group.rotation}deg)`,
            transformOrigin: 'center center',
            border: isSelected ? '2px solid #3B82F6' : isMultiSelected ? '2px dashed #3B82F6' : '1px solid #E5E7EB',
            borderRadius: '4px',
            backgroundColor: 'rgba(59, 130, 246, 0.05)',
            pointerEvents: 'all',
            zIndex: group.zIndex || 0,
          }}
          onClick={(e) => {
            e.stopPropagation();
            onAssetClick(group.id);
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            onAssetDoubleClick(group.id);
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            onAssetMouseDown(e, group.id);
          }}
          onMouseMove={(e) => onAssetMouseMove(e, group.id)}
          onMouseUp={(e) => onAssetMouseUp(e, group.id)}
          onMouseLeave={(e) => onAssetMouseLeave(e, group.id)}
          onMouseEnter={(e) => onAssetMouseEnter(e, group.id)}
          onMouseOver={(e) => onAssetMouseOver(e, group.id)}
          onMouseOut={(e) => onAssetMouseOut(e, group.id)}
          onContextMenu={(e) => onAssetContextMenu(e, group.id)}
        >
          {/* Group label */}
          <div
            style={{
              position: 'absolute',
              top: -20,
              left: 0,
              right: 0,
              textAlign: 'center',
              fontSize: '12px',
              color: '#6B7280',
              fontWeight: '500',
            }}
          >
            Group ({group.groupAssets.length} items)
          </div>
        </div>
      )}

      {/* Render group assets - always visible, with individual controls */}
      <div
        style={{
          position: 'absolute',
          left: leftPx,
          top: topPx,
          transform: `translate(-50%, -50%) rotate(${group.rotation}deg)`,
          transformOrigin: 'center center',
        }}
      >
        {group.groupAssets.map((asset) => (
          <AssetRenderer
            key={asset.id}
            asset={asset}
            leftPx={asset.x * mmToPx}
            topPx={asset.y * mmToPx}
            isSelected={asset.id === selectedAssetId}
            isMultiSelected={selectedAssetIds.includes(asset.id)}
            isCopied={false}
            totalRotation={asset.rotation}
            editingTextId={null}
            editingText=""
            onAssetMouseDown={onAssetMouseDown}
            onTextDoubleClick={(_e, id) => onAssetDoubleClick(id)}
            onTextEditKeyDown={(_e, _id) => {}}
            onTextEditBlur={(_id) => {}}
            onTextEditChange={(_text) => {}}
            onScaleHandleMouseDown={onScaleHandleMouseDown}
            onRotationHandleMouseDown={onRotationHandleMouseDown}
          />
        ))}
      </div>

      {/* Group handles - only show when group is selected */}
      {showGroupContainer && (
        <AssetHandlesRenderer
          asset={group}
          leftPx={leftPx}
          topPx={topPx}
          onScaleHandleMouseDown={onScaleHandleMouseDown}
          onRotationHandleMouseDown={onRotationHandleMouseDown}
        />
      )}
    </>
  );
};

export default GroupRenderer;
