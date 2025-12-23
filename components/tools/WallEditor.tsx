/**
 * Wall Editor
 * Allows editing wall endpoints and thickness by dragging
 */

"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { useEditorStore } from '@/store/editorStore';
import type { Point } from '@/utils/geometry';

// Temporary types until wallEngine is implemented
type WallSegment = {
  id: string;
  start: Point;
  end: Point;
  thickness: number;
  rightOffsetLine: { start: Point; end: Point };
};

type SnapConfig = {
  snapToGrid: boolean;
  gridSize: number;
  snapToObjects: boolean;
};

// Temporary functions until wallEngine is implemented
function updateWallSegment(wall: WallSegment, updates: Partial<WallSegment>): WallSegment {
  return { ...wall, ...updates };
}

function applySnapping(point: Point, walls: WallSegment[], config: SnapConfig): { point: Point } {
  // Simple snap implementation
  if (config.snapToGrid) {
    return {
      point: {
        x: Math.round(point.x / config.gridSize) * config.gridSize,
        y: Math.round(point.y / config.gridSize) * config.gridSize,
      },
    };
  }
  return { point };
}

interface WallEditorProps {
  wall: WallSegment;
  allWalls: WallSegment[];
  onUpdate: (updated: WallSegment) => void;
  snapConfig: SnapConfig;
  screenToWorld: (screenX: number, screenY: number) => Point;
}

export default function WallEditor({
  wall,
  allWalls,
  onUpdate,
  snapConfig,
  screenToWorld,
}: WallEditorProps) {
  const [dragHandle, setDragHandle] = useState<'start' | 'end' | 'thickness' | null>(null);
  const [dragStart, setDragStart] = useState<{ point: Point; thickness: number } | null>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, handle: 'start' | 'end' | 'thickness') => {
      e.stopPropagation();
      const worldPos = screenToWorld(e.clientX, e.clientY);
      setDragHandle(handle);
      setDragStart({
        point: worldPos,
        thickness: wall.thickness,
      });
    },
    [wall.thickness, screenToWorld]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragHandle || !dragStart) return;

      const worldPos = screenToWorld(e.clientX, e.clientY);
      const snapped = applySnapping(worldPos, allWalls.filter((w) => w.id !== wall.id), snapConfig);

      if (dragHandle === 'start') {
        const updated = updateWallSegment(wall, { start: snapped.point });
        onUpdate(updated);
      } else if (dragHandle === 'end') {
        const updated = updateWallSegment(wall, { end: snapped.point });
        onUpdate(updated);
      } else if (dragHandle === 'thickness') {
        // Calculate thickness based on distance from center line
        const centerLine = {
          start: wall.start,
          end: wall.end,
        };
        const dx = centerLine.end.x - centerLine.start.x;
        const dy = centerLine.end.y - centerLine.start.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        if (length === 0) return;

        // Project point onto perpendicular line
        const perpX = -dy / length;
        const perpY = dx / length;
        const toPoint = {
          x: snapped.point.x - centerLine.start.x,
          y: snapped.point.y - centerLine.start.y,
        };
        const perpDist = toPoint.x * perpX + toPoint.y * perpY;
        const newThickness = Math.max(50, Math.abs(perpDist * 2)); // Minimum 50mm

        const updated = updateWallSegment(wall, { thickness: newThickness });
        onUpdate(updated);
      }
    },
    [dragHandle, dragStart, wall, allWalls, snapConfig, screenToWorld, onUpdate]
  );

  const handleMouseUp = useCallback(() => {
    setDragHandle(null);
    setDragStart(null);
  }, []);

  useEffect(() => {
    if (dragHandle) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragHandle, handleMouseMove, handleMouseUp]);

  return (
    <g id={`wall-editor-${wall.id}`}>
      {/* Start endpoint handle */}
      <circle
        cx={wall.start.x}
        cy={wall.start.y}
        r={6}
        fill="#3b82f6"
        stroke="white"
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
        style={{ cursor: 'move' }}
        onMouseDown={(e) => handleMouseDown(e, 'start')}
      />

      {/* End endpoint handle */}
      <circle
        cx={wall.end.x}
        cy={wall.end.y}
        r={6}
        fill="#3b82f6"
        stroke="white"
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
        style={{ cursor: 'move' }}
        onMouseDown={(e) => handleMouseDown(e, 'end')}
      />

      {/* Thickness adjustment handle (on right offset line midpoint) */}
      {(() => {
        const midX = (wall.rightOffsetLine.start.x + wall.rightOffsetLine.end.x) / 2;
        const midY = (wall.rightOffsetLine.start.y + wall.rightOffsetLine.end.y) / 2;
        return (
          <circle
            cx={midX}
            cy={midY}
            r={5}
            fill="#10b981"
            stroke="white"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
            style={{ cursor: 'ew-resize' }}
            onMouseDown={(e) => handleMouseDown(e, 'thickness')}
          />
        );
      })()}
    </g>
  );
}
