"use client";

import { useSceneStore } from "@/store/sceneStore";

type ExportSelectionBoxProps = {
  mmToPx: number;
};

export default function ExportSelectionBox({ mmToPx }: ExportSelectionBoxProps) {
  // All hooks must be called at the top, before any conditional returns
  const isExportSelectionMode = useSceneStore((s) => s.isExportSelectionMode);
  const exportSelectionStart = useSceneStore((s) => s.exportSelectionStart);
  const exportSelectionEnd = useSceneStore((s) => s.exportSelectionEnd);

  // Show selection box if we're in export mode and have both start and end points
  // This matches the pattern used in SelectionBox
  if (!isExportSelectionMode || !exportSelectionStart || !exportSelectionEnd) {
    return null;
  }

  // Calculate selection box dimensions (same as SelectionBox)
  const left = Math.min(exportSelectionStart.x, exportSelectionEnd.x) * mmToPx;
  const top = Math.min(exportSelectionStart.y, exportSelectionEnd.y) * mmToPx;
  const width = Math.abs(exportSelectionEnd.x - exportSelectionStart.x) * mmToPx;
  const height = Math.abs(exportSelectionEnd.y - exportSelectionStart.y) * mmToPx;

  // Use the same simple style as SelectionBox but with green color to differentiate
  return (
    <div
      className="absolute border-2 border-green-500 bg-green-100 bg-opacity-20 pointer-events-none z-50"
      style={{
        left,
        top,
        width,
        height,
      }}
    >
      <div className="absolute -top-6 left-0 text-xs text-green-700 font-medium bg-white px-2 py-1 rounded shadow whitespace-nowrap">
        Export: {Math.abs(exportSelectionEnd.x - exportSelectionStart.x).toFixed(0)} ×{" "}
        {Math.abs(exportSelectionEnd.y - exportSelectionStart.y).toFixed(0)} mm
      </div>
    </div>
  );
}

