import React from 'react';

interface GridOverlayProps {
  showGrid: boolean;
  canvasPxW: number;
  canvasPxH: number;
  mmToPx: number;
}

export default function GridOverlay({ showGrid, canvasPxW, canvasPxH, mmToPx }: GridOverlayProps) {
  if (!showGrid) return null;

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={canvasPxW}
      height={canvasPxH}
      style={{ zIndex: 0 }}
    >
      <defs>
        <pattern
          id="grid-pattern"
          width={20 * mmToPx}
          height={20 * mmToPx}
          patternUnits="userSpaceOnUse"
        >
          <path
            d={`M ${20 * mmToPx} 0 L 0 0 0 ${20 * mmToPx}`}
            fill="none"
            stroke="rgba(96, 165, 250, 0.4)"
            strokeWidth="1"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid-pattern)" />
    </svg>
  );
}
