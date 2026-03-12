import { useEffect } from "react";
import { useSceneStore } from "@/store/sceneStore";

export function useCanvasKeyboardHandlers() {
  const {
    undo,
    redo,
    saveToHistory,
    deleteSelectedAssets,
    clearSelection,
    selectedAssetId,
    selectedAssetIds,
    assets,
    copyAsset,
    pasteAsset,
    duplicateSelectedAssets,
    wallDrawingMode,
    currentWallSegments,
    finishWallDrawing,
    cancelWallDrawing,
    moveSelectedAssets,
  } = useSceneStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept events in text inputs
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      // Wall drawing: Escape finishes or cancels
      if (wallDrawingMode && e.key === "Escape") {
        e.preventDefault();
        if (currentWallSegments.length > 0) {
          finishWallDrawing();
        } else {
          cancelWallDrawing();
        }
        return;
      }

      // Ctrl / Cmd combos
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case "c": {
            // Copy single selected asset
            e.preventDefault();
            if (selectedAssetId) {
              copyAsset(selectedAssetId);
              console.log("[Keyboard] Copied asset:", selectedAssetId);
            }
            break;
          }
          case "v": {
            // Paste
            e.preventDefault();
            pasteAsset(20, 20);
            break;
          }
          case "x": {
            // Cut = copy + delete
            e.preventDefault();
            if (selectedAssetId) {
              copyAsset(selectedAssetId);
            }
            if (selectedAssetIds.length > 0 || selectedAssetId) {
              saveToHistory();
              deleteSelectedAssets();
            }
            break;
          }
          case "d": {
            // Duplicate selected
            e.preventDefault();
            if (selectedAssetIds.length > 0 || selectedAssetId) {
              duplicateSelectedAssets();
            }
            break;
          }
          case "z": {
            e.preventDefault();
            if (e.shiftKey) {
              // Ctrl+Shift+Z = Redo
              console.log("[Keyboard] Redo triggered");
              redo();
            } else {
              // Ctrl+Z = Undo
              console.log("[Keyboard] Undo triggered");
              undo();
            }
            break;
          }
          case "y": {
            // Ctrl+Y = Redo
            e.preventDefault();
            console.log("[Keyboard] Redo triggered (Ctrl+Y)");
            redo();
            break;
          }
          case "a": {
            // Ctrl+A = select all
            e.preventDefault();
            const allIds = assets.map((a) => a.id);
            useSceneStore.setState({
              selectedAssetIds: allIds,
              selectedAssetId: allIds.length === 1 ? allIds[0] : null,
            });
            break;
          }
        }
        return; // Don't fall through to non-ctrl handling
      }

      // Delete / Backspace — remove selected items
      if (e.key === "Delete" || e.key === "Backspace") {
        const hasSelection =
          selectedAssetIds.length > 0 || selectedAssetId !== null;
        if (hasSelection) {
          e.preventDefault();
          console.log(
            "[Keyboard] Delete triggered. selectedAssetIds:",
            selectedAssetIds,
            "selectedAssetId:",
            selectedAssetId
          );
          // Ensure the single-select is also in selectedAssetIds so deleteSelectedAssets sees it
          if (
            selectedAssetId &&
            !selectedAssetIds.includes(selectedAssetId)
          ) {
            useSceneStore.setState({
              selectedAssetIds: [selectedAssetId, ...selectedAssetIds],
            });
          }
          saveToHistory();
          deleteSelectedAssets();
        }
        return;
      }

      // Escape — deselect
      if (e.key === "Escape") {
        if (selectedAssetIds.length > 0 || selectedAssetId) {
          clearSelection();
        }
        return;
      }

      // Arrow keys — nudge selected items
      if (
        (selectedAssetIds.length > 0 || selectedAssetId) &&
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
      ) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1; // mm

        // Ensure selectedAssetIds includes the single-selected asset
        if (
          selectedAssetId &&
          !selectedAssetIds.includes(selectedAssetId)
        ) {
          useSceneStore.setState({
            selectedAssetIds: [selectedAssetId, ...selectedAssetIds],
          });
        }

        let dx = 0;
        let dy = 0;
        switch (e.key) {
          case "ArrowUp":
            dy = -step;
            break;
          case "ArrowDown":
            dy = step;
            break;
          case "ArrowLeft":
            dx = -step;
            break;
          case "ArrowRight":
            dx = step;
            break;
        }
        moveSelectedAssets(dx, dy);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    undo,
    redo,
    saveToHistory,
    deleteSelectedAssets,
    clearSelection,
    selectedAssetId,
    selectedAssetIds,
    assets,
    copyAsset,
    pasteAsset,
    duplicateSelectedAssets,
    wallDrawingMode,
    currentWallSegments,
    finishWallDrawing,
    cancelWallDrawing,
    moveSelectedAssets,
  ]);

  return { copiedAssetId: null };
}
