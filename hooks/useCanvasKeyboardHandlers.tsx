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

  const [copiedAssetId, setCopiedAssetId] = useState<string | null>(null);

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
        } else if (e.key === 'd' && selectedAssetId) {
          // Duplicate (Ctrl/⌘+D)
          e.preventDefault();
          copyAsset(selectedAssetId);
          pasteAsset(10, 10);
        } else if (e.key === 'z') {
          // Undo/Redo placeholders (wire to history if available)
          e.preventDefault();
          console.debug('Undo requested - integrate with history stack');
        } else if (e.key === 'y') {
          e.preventDefault();
          console.debug('Redo requested - integrate with history stack');
        }
      }

      // Delete/Backspace to remove selected asset
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedAssetId) {
        e.preventDefault();
        removeAsset(selectedAssetId);
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
  ]);

  return { copiedAssetId };
}
