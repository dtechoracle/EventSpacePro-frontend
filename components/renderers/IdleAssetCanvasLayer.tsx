"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ASSET_LIBRARY } from '@/lib/assets';
import { Asset } from '@/store/projectStore';
import { canUseIdleAssetPreview, getIdleAssetPreviewPath } from '@/utils/idleAssetPreview';

interface IdleAssetCanvasLayerProps {
  assets: Asset[];
  panX: number;
  panY: number;
  zoom: number;
  viewportSize: { width: number; height: number };
  dragPreview: { ids: string[]; dx: number; dy: number } | null;
  lowDetail?: boolean;
}

const imageCache = new Map<string, HTMLImageElement>();
const assetPathByType = new Map(ASSET_LIBRARY.map((asset) => [asset.id, asset.path]));

const getImage = (path: string, onReady: () => void) => {
  const cached = imageCache.get(path);
  if (cached) return cached;

  const image = new Image();
  image.decoding = 'async';
  image.onload = onReady;
  image.onerror = onReady;
  image.src = encodeURI(path);
  imageCache.set(path, image);
  return image;
};

const isReady = (image: HTMLImageElement) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;

export default function IdleAssetCanvasLayer({
  assets,
  panX,
  panY,
  zoom,
  viewportSize,
  dragPreview,
  lowDetail = false,
}: IdleAssetCanvasLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const [imageVersion, setImageVersion] = useState(0);

  const previewAssets = useMemo(() => (
    assets
      .filter((asset) => canUseIdleAssetPreview(asset, assetPathByType.get(asset.type)))
      .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
  ), [assets]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
    }

    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;

      const width = Math.max(1, viewportSize.width);
      const height = Math.max(1, viewportSize.height);
      const dpr = window.devicePixelRatio || 1;
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
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'medium';

      const previewIds = dragPreview ? new Set(dragPreview.ids) : null;

      previewAssets.forEach((asset) => {
        const assetPath = assetPathByType.get(asset.type);
        const previewPath = getIdleAssetPreviewPath(assetPath);
        if (!previewPath) return;

        const worldWidth = (asset.width || 100) * (asset.scale || 1);
        const worldHeight = (asset.height || 100) * (asset.scale || 1);
        const screenWidth = worldWidth * zoom;
        const screenHeight = worldHeight * zoom;
        const offsetX = previewIds?.has(asset.id) ? dragPreview?.dx || 0 : 0;
        const offsetY = previewIds?.has(asset.id) ? dragPreview?.dy || 0 : 0;
        const screenX = (asset.x + offsetX) * zoom + panX;
        const screenY = (asset.y + offsetY) * zoom + panY;

        if (
          screenX + screenWidth / 2 < -100 ||
          screenX - screenWidth / 2 > width + 100 ||
          screenY + screenHeight / 2 < -100 ||
          screenY - screenHeight / 2 > height + 100
        ) {
          return;
        }

        ctx.save();
        ctx.translate(screenX, screenY);
        ctx.rotate(((asset.rotation || 0) * Math.PI) / 180);
        ctx.globalAlpha = Math.max(0, Math.min(1, asset.opacity ?? 1));

        if (lowDetail) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
          ctx.strokeStyle = 'rgba(15, 23, 42, 0.65)';
          ctx.lineWidth = 1;
          ctx.fillRect(-screenWidth / 2, -screenHeight / 2, screenWidth, screenHeight);
          ctx.strokeRect(-screenWidth / 2, -screenHeight / 2, screenWidth, screenHeight);
          ctx.restore();
          return;
        }

        const image = getImage(previewPath, () => setImageVersion((version) => version + 1));
        if (isReady(image)) {
          ctx.drawImage(image, -screenWidth / 2, -screenHeight / 2, screenWidth, screenHeight);
        }

        ctx.restore();
      });
    });

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [previewAssets, panX, panY, zoom, viewportSize.width, viewportSize.height, imageVersion, dragPreview, lowDetail]);

  if (previewAssets.length === 0) return null;

  return (
    <canvas
      ref={canvasRef}
      data-workspace-idle-asset-canvas="true"
      data-export-ignore="true"
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
