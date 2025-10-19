import { useEffect, useState } from "react";
import { useSceneStore } from "@/store/sceneStore";

export function useCanvasKeyboardHandlers() {
  const selectedAssetId = useSceneStore((s) => s.selectedAssetId);
  const clipboard = useSceneStore((s) => s.clipboard);
  const copyAsset = useSceneStore((s) => s.copyAsset);
  const pasteAsset = useSceneStore((s) => s.pasteAsset);
  const removeAsset = useSceneStore((s) => s.removeAsset);
  const assets = useSceneStore((s) => s.assets);
  const wallDrawingMode = useSceneStore((s) => s.wallDrawingMode);
  const currentWallSegments = useSceneStore((s) => s.currentWallSegments);
  const finishWallDrawing = useSceneStore((s) => s.finishWallDrawing);
  const cancelWallDrawing = useSceneStore((s) => s.cancelWallDrawing);
  const undo = useSceneStore((s) => s.undo);
  const redo = useSceneStore((s) => s.redo);
  const history = useSceneStore((s) => s.history);
  const historyIndex = useSceneStore((s) => s.historyIndex);
  const smartDuplicate = useSceneStore((s) => s.smartDuplicate);
  const detectDuplicationPattern = useSceneStore((s) => s.detectDuplicationPattern);
  const lastDuplicatedAsset = useSceneStore((s) => s.lastDuplicatedAsset);
  const selectedAssetIds = useSceneStore((s) => s.selectedAssetIds);
  const duplicateSelectedAssets = useSceneStore((s) => s.duplicateSelectedAssets);
  const deleteSelectedAssets = useSceneStore((s) => s.deleteSelectedAssets);
  const clearSelection = useSceneStore((s) => s.clearSelection);

  const [copiedAssetId, setCopiedAssetId] = useState<string | null>(null);

  // Detect pattern when assets are moved
  useEffect(() => {
    if (lastDuplicatedAsset && selectedAssetId) {
      const currentAsset = assets.find(a => a.id === selectedAssetId);
      if (currentAsset && currentAsset.id !== lastDuplicatedAsset.id) {
        // Check if this is the same type as the last duplicated asset
        if (currentAsset.type === lastDuplicatedAsset.type) {
          // Find the original asset that was duplicated
          const originalAsset = assets.find(a => 
            a.type === currentAsset.type && 
            a.id !== currentAsset.id && 
            a.id !== lastDuplicatedAsset.id
          );
          
          if (originalAsset) {
            // Detect pattern between original and current position
            detectDuplicationPattern(originalAsset, currentAsset);
          }
        }
      }
    }
  }, [selectedAssetId, assets, lastDuplicatedAsset, detectDuplicationPattern]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle copy/paste if we're not in a text input or textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      // Handle wall drawing mode
      if (wallDrawingMode && e.key === 'Escape') {
        e.preventDefault();
        if (currentWallSegments.length > 0) {
          finishWallDrawing();
        } else {
          cancelWallDrawing();
        }
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'c' && selectedAssetId) {
          e.preventDefault();
          copyAsset(selectedAssetId);
          // Show visual feedback
          setCopiedAssetId(selectedAssetId);
          setTimeout(() => setCopiedAssetId(null), 500);
        } else if (e.key === 'v' && clipboard) {
          e.preventDefault();
          pasteAsset();
        } else if (e.key === 'x' && selectedAssetId) {
          e.preventDefault();
          copyAsset(selectedAssetId);
          removeAsset(selectedAssetId);
        } else if (e.key === 'd') {
          // Smart Duplicate (Ctrl/⌘+D)
          e.preventDefault();
          if (selectedAssetIds.length > 0) {
            // Multi-select duplication
            duplicateSelectedAssets();
          } else if (selectedAssetId) {
            // Single asset duplication
            smartDuplicate(selectedAssetId);
          }
        } else if (e.key === 'z') {
          // Undo (Ctrl/⌘+Z)
          e.preventDefault();
          if (historyIndex > 0) {
            undo();
          }
        } else if (e.key === 'y') {
          // Redo (Ctrl/⌘+Y)
          e.preventDefault();
          if (historyIndex < history.length - 1) {
            redo();
          }
        } else if (e.key === 'a') {
          // Select All (Ctrl/⌘+A)
          e.preventDefault();
          // TODO: Implement select all functionality
          console.log('Select All requested');
        }
      }

      // Delete/Backspace to remove selected assets
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (selectedAssetIds.length > 0) {
          // Multi-select deletion
          deleteSelectedAssets();
        } else if (selectedAssetId) {
          // Single asset deletion
          removeAsset(selectedAssetId);
        }
      }

      // Escape to deselect or cancel operations
      if (e.key === 'Escape') {
        if (selectedAssetIds.length > 0 || selectedAssetId) {
          // Clear all selections
          clearSelection();
        }
      }

      // Arrow keys for fine movement (when assets are selected)
      if ((selectedAssetId || selectedAssetIds.length > 0) && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const moveDistance = e.shiftKey ? 10 : 1; // Shift for larger steps
        
        if (selectedAssetIds.length > 0) {
          // Multi-select movement
          let deltaX = 0;
          let deltaY = 0;
          
          switch (e.key) {
            case 'ArrowUp':
              deltaY = -moveDistance;
              break;
            case 'ArrowDown':
              deltaY = moveDistance;
              break;
            case 'ArrowLeft':
              deltaX = -moveDistance;
              break;
            case 'ArrowRight':
              deltaX = moveDistance;
              break;
          }
          
          useSceneStore.getState().moveSelectedAssets(deltaX, deltaY);
        } else if (selectedAssetId) {
          // Single asset movement
          const asset = assets.find(a => a.id === selectedAssetId);
          if (asset) {
            let newX = asset.x;
            let newY = asset.y;
            
            switch (e.key) {
              case 'ArrowUp':
                newY -= moveDistance;
                break;
              case 'ArrowDown':
                newY += moveDistance;
                break;
              case 'ArrowLeft':
                newX -= moveDistance;
                break;
              case 'ArrowRight':
                newX += moveDistance;
                break;
            }
            
            useSceneStore.getState().updateAsset(selectedAssetId, { x: newX, y: newY });
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedAssetId,
    clipboard,
    copyAsset,
    pasteAsset,
    removeAsset,
    assets,
    wallDrawingMode,
    currentWallSegments,
    finishWallDrawing,
    cancelWallDrawing,
    undo,
    redo,
    history,
    historyIndex,
    smartDuplicate,
    detectDuplicationPattern,
    lastDuplicatedAsset,
    selectedAssetIds,
    duplicateSelectedAssets,
    deleteSelectedAssets,
    clearSelection,
  ]);

  return { copiedAssetId };
}
