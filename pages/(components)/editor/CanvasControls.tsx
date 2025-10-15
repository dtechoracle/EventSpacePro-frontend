import React from 'react';
import { RotateCw, RotateCcw } from "lucide-react";

type CanvasControlsProps = {
  selectedAssetId: string | null;
  onRotateCW: () => void;
  onRotateCCW: () => void;
  canvas?: { size: string; width: number; height: number } | null;
};

export default function CanvasControls({ 
  selectedAssetId, 
  onRotateCW, 
  onRotateCCW, 
  canvas 
}: CanvasControlsProps) {
  return (
    <>
      {/* Rotate Buttons */}
      {selectedAssetId === null && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex gap-2 z-10 pointer-events-auto">
          <button 
            onClick={(ev) => { ev.stopPropagation(); onRotateCCW(); }} 
            className="p-2 bg-gray-200 rounded-full shadow hover:bg-gray-300" 
            title="Rotate CCW"
          >
            <RotateCcw size={16} />
          </button>
          <button 
            onClick={(ev) => { ev.stopPropagation(); onRotateCW(); }} 
            className="p-2 bg-gray-200 rounded-full shadow hover:bg-gray-300" 
            title="Rotate CW"
          >
            <RotateCw size={16} />
          </button>
        </div>
      )}

      {/* Canvas Info */}
      {canvas && (
        <span className="absolute bottom-2 right-2 text-xs text-gray-400 pointer-events-none">
          {canvas.size} ({canvas.width}×{canvas.height} mm)
        </span>
      )}
    </>
  );
}
