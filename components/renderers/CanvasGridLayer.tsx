"use client";

import React, { useEffect, useRef } from 'react';

interface CanvasGridLayerProps {
  show: boolean;
  gridSize: number;
  viewportSize: { width: number; height: number };
  zoom: number;
  panX: number;
  panY: number;
  unitSystem?: 'metric-mm' | 'metric-m' | 'imperial-ft';
}

const formatGridSize = (gridSize: number, unitSystem: CanvasGridLayerProps['unitSystem']) => {
  if (unitSystem === 'imperial-ft') {
    const feet = gridSize / 304.8;
    return `${feet >= 10 ? feet.toFixed(0) : feet.toFixed(1)}ft`;
  }

  if (unitSystem === 'metric-m') {
    return `${gridSize / 1000}m`;
  }

  return `${gridSize}mm`;
};

export default function CanvasGridLayer({
  show,
  gridSize,
  viewportSize,
  zoom,
  panX,
  panY,
  unitSystem = 'metric-mm',
}: CanvasGridLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
    }

    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;

      const dpr = window.devicePixelRatio || 1;
      const width = Math.max(1, viewportSize.width);
      const height = Math.max(1, viewportSize.height);
      const targetWidth = Math.round(width * dpr);
      const targetHeight = Math.round(height * dpr);

      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
      }

      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      if (!show || gridSize <= 0 || zoom <= 0) return;

      let minorStep = gridSize * zoom;
      let majorEvery = 5;

      while (minorStep < 8) {
        minorStep *= 2;
        majorEvery *= 2;
      }

      const majorStep = minorStep * majorEvery;
      const worldStep = minorStep / zoom;
      const startWorldX = Math.floor((-panX / zoom) / worldStep) * worldStep;
      const startWorldY = Math.floor((-panY / zoom) / worldStep) * worldStep;
      const endWorldX = ((width - panX) / zoom) + worldStep;
      const endWorldY = ((height - panY) / zoom) + worldStep;

      ctx.lineWidth = 1;

      let lineIndex = Math.round(startWorldX / worldStep);
      for (let worldX = startWorldX; worldX <= endWorldX; worldX += worldStep, lineIndex += 1) {
        const x = Math.round(worldX * zoom + panX) + 0.5;
        const isMajor = lineIndex % majorEvery === 0;
        ctx.strokeStyle = isMajor ? '#cbd5e1' : '#e2e8f0';
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      lineIndex = Math.round(startWorldY / worldStep);
      for (let worldY = startWorldY; worldY <= endWorldY; worldY += worldStep, lineIndex += 1) {
        const y = Math.round(worldY * zoom + panY) + 0.5;
        const isMajor = lineIndex % majorEvery === 0;
        ctx.strokeStyle = isMajor ? '#cbd5e1' : '#e2e8f0';
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      const label = `Grid: ${formatGridSize(gridSize, unitSystem)}`;
      ctx.font = '600 12px Inter, system-ui, sans-serif';
      const labelWidth = Math.ceil(ctx.measureText(label).width) + 16;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.beginPath();
      ctx.roundRect(15, 12, labelWidth, 24, 4);
      ctx.fill();
      ctx.fillStyle = '#475569';
      ctx.fillText(label, 23, 28);
    });

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [show, gridSize, viewportSize.width, viewportSize.height, zoom, panX, panY, unitSystem]);

  return (
    <canvas
      ref={canvasRef}
      data-export-ignore="true"
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
