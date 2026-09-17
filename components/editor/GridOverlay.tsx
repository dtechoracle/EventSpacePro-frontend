import React from 'react';

interface GridOverlayProps {
  showGrid: boolean;
  canvasPxW: number;
  canvasPxH: number;
  mmToPx: number;
  gridSize: number;
}

export default function GridOverlay({ showGrid, canvasPxW, canvasPxH, mmToPx, gridSize }: GridOverlayProps) {
  if (!showGrid) return null;
  
  // Ensure grid is visible - if pattern is too large, use a smaller size
  const patternSize = Math.min(gridSize * mmToPx, 100); // Max 100px pattern size

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={canvasPxW}
      height={canvasPxH}
      style={{ zIndex: 1 }}
    >
      <defs>
        <pattern
          id="grid-pattern"
          width={patternSize}
          height={patternSize}
          patternUnits="userSpaceOnUse"
        >
          <path
            d={`M ${patternSize} 0 L 0 0 0 ${patternSize}`}
            fill="none"
            stroke="rgba(96, 165, 250, 0.5)"
            strokeWidth="1"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid-pattern)" />
    </svg>
  );
}
