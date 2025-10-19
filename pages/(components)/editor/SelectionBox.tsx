"use client";

import { useSceneStore } from "@/store/sceneStore";

type SelectionBoxProps = {
  mmToPx: number;
};

export default function SelectionBox({ mmToPx }: SelectionBoxProps) {
  const isRectangularSelecting = useSceneStore((s) => s.isRectangularSelecting);
  const selectionBox = useSceneStore((s) => s.selectionBox);

  if (!isRectangularSelecting || !selectionBox) return null;

  const { startX, startY, endX, endY } = selectionBox;
  const left = Math.min(startX, endX) * mmToPx;
  const top = Math.min(startY, endY) * mmToPx;
  const width = Math.abs(endX - startX) * mmToPx;
  const height = Math.abs(endY - startY) * mmToPx;

  return (
    <div
      className="absolute border-2 border-blue-500 bg-blue-100 bg-opacity-20 pointer-events-none z-50"
      style={{
        left,
        top,
        width,
        height,
      }}
    />
  );
}
