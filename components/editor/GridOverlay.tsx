import React from 'react';

interface GridOverlayProps {
  showGrid: boolean;
  canvasPxW: number;
  canvasPxH: number;
  mmToPx: number;
  gridSize: number;
}

export const GridOverlay = React.memo(({ showGrid, mmToPx, gridSize }: GridOverlayProps) => {
  if (!showGrid) return null;
  
  const patternSize = Math.min(gridSize * mmToPx, 100);

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        zIndex: 1,
        backgroundImage: `linear-gradient(to right, rgba(96, 165, 250, 0.35) 1px, transparent 1px), linear-gradient(to bottom, rgba(96, 165, 250, 0.35) 1px, transparent 1px)`,
        backgroundSize: `${patternSize}px ${patternSize}px`,
      }}
    />
  );
});

GridOverlay.displayName = "GridOverlay";

export default GridOverlay;

