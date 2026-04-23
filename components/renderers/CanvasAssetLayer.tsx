"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ASSET_LIBRARY } from '@/lib/assets';
import { Asset, useProjectStore } from '@/store/projectStore';
import { DEFAULT_ASSET_STROKE_WIDTH, canRenderAssetOnCanvas } from '@/utils/assetRenderMode';
import { SpatialIndex, getRotatedItemBounds } from '@/utils/spatialIndex';
import { TEXT_STYLE_FONTS, ensureGoogleFontsLoaded } from '@/utils/googleFonts';

type DragPreview = {
  ids: string[];
  dx: number;
  dy: number;
};

interface CanvasAssetLayerProps {
  assets: Asset[];
  panX: number;
  panY: number;
  zoom: number;
  viewportSize: { width: number; height: number };
  dragPreview: DragPreview | null;
}

const imageCache = new Map<string, HTMLImageElement>();
const svgTextCache = new Map<string, string>();
const pendingSvgTextLoads = new Map<string, Promise<string>>();
const rasterCanvasCache = new Map<string, HTMLCanvasElement>();
const IMAGE_CACHE_MAX_ENTRIES = 360;
const RASTER_CACHE_MAX_ENTRIES = 240;
const RASTER_MIN_SIZE = 128;
const RASTER_MAX_SIDE = 1600;
const LOD_MIN_SCREEN_SIZE = 8;
const ASSET_IMAGE_SIZE_CACHE_BUCKET = 16;
const RASTER_SIZE_CACHE_BUCKET = 32;
const VIEWPORT_IDLE_MS = 120;
const assetPathById = new Map(
  ASSET_LIBRARY.map(item => [item.id, item.path || null])
);

const getAssetPath = (asset: Asset) => {
  return assetPathById.get(asset.type) ?? null;
};

const getImageCacheKey = (path: string, displayWidth: number, displayHeight: number) => {
  const roundedWidth = Math.max(1, Math.round(displayWidth / ASSET_IMAGE_SIZE_CACHE_BUCKET) * ASSET_IMAGE_SIZE_CACHE_BUCKET);
  const roundedHeight = Math.max(1, Math.round(displayHeight / ASSET_IMAGE_SIZE_CACHE_BUCKET) * ASSET_IMAGE_SIZE_CACHE_BUCKET);
  return `${path}|${roundedWidth}x${roundedHeight}|stroke-${DEFAULT_ASSET_STROKE_WIDTH}`;
};

const loadSvgText = (path: string) => {
  const cached = svgTextCache.get(path);
  if (cached) return Promise.resolve(cached);

  const pending = pendingSvgTextLoads.get(path);
  if (pending) return pending;

  const request = fetch(encodeURI(path))
    .then(response => response.ok ? response.text() : Promise.reject(new Error('Unable to load asset SVG')))
    .then((svgText) => {
      svgTextCache.set(path, svgText);
      pendingSvgTextLoads.delete(path);
      return svgText;
    })
    .catch((error) => {
      pendingSvgTextLoads.delete(path);
      throw error;
    });

  pendingSvgTextLoads.set(path, request);
  return request;
};

const isImageReady = (image: HTMLImageElement) => {
  return Boolean(image.src && image.complete && image.naturalWidth > 0);
};

const getReadyImageForPath = (path: string, preferredImage: HTMLImageElement) => {
  if (isImageReady(preferredImage)) return preferredImage;

  for (const [key, image] of imageCache) {
    if (key.startsWith(`${path}|`) && isImageReady(image)) {
      return image;
    }
  }

  return null;
};

const getImage = (path: string, displayWidth: number, displayHeight: number, onReady: () => void) => {
  const cacheKey = getImageCacheKey(path, displayWidth, displayHeight);
  const cached = imageCache.get(cacheKey);
  if (cached) return cached;

  const image = new Image();
  (image as HTMLImageElement & { __assetCacheKey?: string }).__assetCacheKey = cacheKey;
  image.decoding = 'async';
  image.onload = onReady;
  image.onerror = onReady;
  imageCache.set(cacheKey, image);

  if (imageCache.size > IMAGE_CACHE_MAX_ENTRIES) {
    const oldestKey = imageCache.keys().next().value;
    if (oldestKey && oldestKey !== cacheKey) imageCache.delete(oldestKey);
  }

  loadSvgText(path)
    .then((svgText) => {
      const normalizedSvg = normalizeSvgForCanvas(svgText, displayWidth, displayHeight);
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(normalizedSvg)}`;
    })
    .catch(() => {
      // Fall back to the raw file only if normalization cannot be loaded.
      image.src = encodeURI(path);
    });

  return image;
};

const getNumericSvgLength = (value: string | null) => {
  if (!value) return null;
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getSvgViewBoxSize = (svg: SVGSVGElement) => {
  const viewBox = svg.getAttribute('viewBox');
  if (viewBox) {
    const parts = viewBox.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every(Number.isFinite) && parts[2] > 0 && parts[3] > 0) {
      return { width: parts[2], height: parts[3] };
    }
  }

  return {
    width: getNumericSvgLength(svg.getAttribute('width')) || 100,
    height: getNumericSvgLength(svg.getAttribute('height')) || 100,
  };
};

const normalizeSvgForCanvas = (svgText: string, displayWidth: number, displayHeight: number) => {
  if (typeof window === 'undefined') return svgText;

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    if (!svg) return svgText;

    const viewBoxSize = getSvgViewBoxSize(svg);
    const sourceStrokeWidth = Math.max(
      DEFAULT_ASSET_STROKE_WIDTH,
      DEFAULT_ASSET_STROKE_WIDTH * Math.max(
        viewBoxSize.width / Math.max(1, displayWidth),
        viewBoxSize.height / Math.max(1, displayHeight)
      )
    );

    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', '#000000');
    svg.setAttribute('stroke-width', String(sourceStrokeWidth));
    svg.setAttribute('style', `${svg.getAttribute('style') || ''}; background: transparent; overflow: visible;`);

    const style = doc.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = `
      path, circle, rect, line, polyline, polygon, ellipse {
        fill: none !important;
        stroke: #000000 !important;
        stroke-width: ${sourceStrokeWidth} !important;
      }
      text {
        fill: #000000 !important;
        stroke: none !important;
      }
    `;
    svg.prepend(style);

    return new XMLSerializer().serializeToString(doc);
  } catch {
    return svgText;
  }
};

const getRasterCacheKey = (
  path: string,
  image: HTMLImageElement,
  screenWidth: number,
  screenHeight: number,
  dpr: number
) => {
  const roundedWidth = Math.max(1, Math.round(screenWidth / RASTER_SIZE_CACHE_BUCKET) * RASTER_SIZE_CACHE_BUCKET);
  const roundedHeight = Math.max(1, Math.round(screenHeight / RASTER_SIZE_CACHE_BUCKET) * RASTER_SIZE_CACHE_BUCKET);
  const quality = Math.min(2, Math.max(1, Math.round(dpr)));
  const sourceKey = (image as HTMLImageElement & { __assetCacheKey?: string }).__assetCacheKey || path;
  return `${sourceKey}|raster-${roundedWidth}x${roundedHeight}|${quality}|stroke-${DEFAULT_ASSET_STROKE_WIDTH}`;
};

const getCachedRasterCanvas = (
  path: string,
  image: HTMLImageElement,
  screenWidth: number,
  screenHeight: number,
  dpr: number
) => {
  const key = getRasterCacheKey(path, image, screenWidth, screenHeight, dpr);
  const cached = rasterCanvasCache.get(key);
  if (cached) return cached;

  let pixelWidth = Math.max(RASTER_MIN_SIZE, Math.round(screenWidth * Math.min(2, Math.max(1, dpr))));
  let pixelHeight = Math.max(RASTER_MIN_SIZE, Math.round(screenHeight * Math.min(2, Math.max(1, dpr))));
  const maxSide = Math.max(pixelWidth, pixelHeight);

  if (maxSide > RASTER_MAX_SIDE) {
    const scale = RASTER_MAX_SIDE / maxSide;
    pixelWidth = Math.max(1, Math.round(pixelWidth * scale));
    pixelHeight = Math.max(1, Math.round(pixelHeight * scale));
  }

  const rasterCanvas = document.createElement('canvas');
  rasterCanvas.width = pixelWidth;
  rasterCanvas.height = pixelHeight;

  const rasterContext = rasterCanvas.getContext('2d');
  if (!rasterContext) return null;

  rasterContext.imageSmoothingEnabled = true;
  rasterContext.imageSmoothingQuality = 'high';
  rasterContext.clearRect(0, 0, pixelWidth, pixelHeight);
  rasterContext.drawImage(image, 0, 0, pixelWidth, pixelHeight);

  rasterCanvasCache.set(key, rasterCanvas);

  if (rasterCanvasCache.size > RASTER_CACHE_MAX_ENTRIES) {
    const oldestKey = rasterCanvasCache.keys().next().value;
    if (oldestKey) rasterCanvasCache.delete(oldestKey);
  }

  return rasterCanvas;
};

export default function CanvasAssetLayer({
  assets,
  panX,
  panY,
  zoom,
  viewportSize,
  dragPreview,
}: CanvasAssetLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawFrameRef = useRef<number | null>(null);
  const viewportIdleTimeoutRef = useRef<number | null>(null);
  const isViewportSettledRef = useRef(true);
  const [imageVersion, setImageVersion] = useState(0);
  const globalTableNumberingPosition = useProjectStore(s => s.globalTableNumberingPosition);
  const globalTableNumberingOrientation = useProjectStore(s => s.globalTableNumberingOrientation);
  const globalTableNumberingFontSize = useProjectStore(s => s.globalTableNumberingFontSize);
  const globalTableNumberingFontFamily = useProjectStore(s => s.globalTableNumberingFontFamily);
  const globalTableNumberingFontWeight = useProjectStore(s => s.globalTableNumberingFontWeight);
  const globalTableNumberingFontStyle = useProjectStore(s => s.globalTableNumberingFontStyle);
  const globalTableNumberingTextDecoration = useProjectStore(s => s.globalTableNumberingTextDecoration);
  const globalTableNumberingColor = useProjectStore(s => s.globalTableNumberingColor);
  const fastAssets = useMemo(
    () => assets
      .filter(asset => !asset.isExploded && canRenderAssetOnCanvas(asset) && getAssetPath(asset))
      .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0)),
    [assets]
  );
  const fastAssetIndex = useMemo(
    () => new SpatialIndex(
      fastAssets.map((asset) => ({
        id: asset.id,
        item: asset,
        bounds: getRotatedItemBounds(asset),
        zIndex: asset.zIndex || 0,
      }))
    ),
    [fastAssets]
  );
  const visibleFastAssets = useMemo(() => {
    if (viewportSize.width <= 0 || viewportSize.height <= 0 || zoom <= 0) {
      return [];
    }

    const buffer = 800 / zoom;
    const bounds = {
      left: -panX / zoom - buffer,
      top: -panY / zoom - buffer,
      right: (viewportSize.width - panX) / zoom + buffer,
      bottom: (viewportSize.height - panY) / zoom + buffer,
    };

    return fastAssetIndex
      .query(bounds)
      .map((entry) => entry.item)
      .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
  }, [fastAssetIndex, panX, panY, zoom, viewportSize.width, viewportSize.height]);

  useEffect(() => {
    ensureGoogleFontsLoaded(TEXT_STYLE_FONTS);

    if (typeof document !== 'undefined' && document.fonts) {
      document.fonts.ready.then(() => {
        setImageVersion(version => version + 1);
      }).catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    isViewportSettledRef.current = false;

    if (viewportIdleTimeoutRef.current !== null) {
      window.clearTimeout(viewportIdleTimeoutRef.current);
    }

    viewportIdleTimeoutRef.current = window.setTimeout(() => {
      isViewportSettledRef.current = true;
      viewportIdleTimeoutRef.current = null;
      setImageVersion(version => version + 1);
    }, VIEWPORT_IDLE_MS);

    return () => {
      if (viewportIdleTimeoutRef.current !== null) {
        window.clearTimeout(viewportIdleTimeoutRef.current);
        viewportIdleTimeoutRef.current = null;
      }
    };
  }, [panX, panY, zoom]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (drawFrameRef.current !== null) {
      cancelAnimationFrame(drawFrameRef.current);
    }

    drawFrameRef.current = requestAnimationFrame(() => {
      drawFrameRef.current = null;

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
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'medium';

      const previewIds = dragPreview ? new Set(dragPreview.ids) : null;
      const shouldUseRasterCache = isViewportSettledRef.current && !dragPreview;
      const drawAssetLabel = (asset: Asset, assetWidth: number, assetHeight: number) => {
        if (!asset.tableName) return;

        const pos = (asset as any).tableNumberingPosition || globalTableNumberingPosition || 'center';
        const orientation = (asset as any).tableNumberingOrientation || globalTableNumberingOrientation || 'horizontal';
        const worldWidth = (asset.width || 100) * (asset.scale || 1);
        const worldHeight = (asset.height || 100) * (asset.scale || 1);
        const fontSize = ((asset as any).tableNumberingFontSize || globalTableNumberingFontSize || Math.max(14, worldWidth * 0.14)) * zoom;
        const fontFamily = (asset as any).tableNumberingFontFamily || globalTableNumberingFontFamily || 'Inter, sans-serif';
        const fontWeight = (asset as any).tableNumberingFontWeight || globalTableNumberingFontWeight || '900';
        const fontStyle = (asset as any).tableNumberingFontStyle || globalTableNumberingFontStyle || 'normal';
        const textDecoration = (asset as any).tableNumberingTextDecoration || globalTableNumberingTextDecoration || 'none';
        const textColor = (asset as any).tableNumberingColor || globalTableNumberingColor || '#000000';
        const circleR = Math.max(16, worldWidth * 0.12) * zoom;
        const padding = circleR * 1.5;
        const halfW = assetWidth / 2;
        const halfH = assetHeight / 2;
        let tx = 0;
        let ty = 0;

        switch (pos) {
          case 'top': ty = -halfH - padding; break;
          case 'bottom': ty = halfH + padding; break;
          case 'top-left': tx = -halfW; ty = -halfH - padding; break;
          case 'top-right': tx = halfW; ty = -halfH - padding; break;
          case 'bottom-left': tx = -halfW; ty = halfH + padding; break;
          case 'bottom-right': tx = halfW; ty = halfH + padding; break;
          case 'middle-left': tx = -halfW - padding; break;
          case 'middle-right': tx = halfW + padding; break;
          default: break;
        }

        ctx.save();
        ctx.translate(tx, ty);
        ctx.rotate((((orientation === 'vertical' ? 90 : 0) - (asset.rotation || 0)) * Math.PI) / 180);
        ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
        ctx.fillStyle = textColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(asset.tableName, 0, 0);
        if (textDecoration === 'underline') {
          const metrics = ctx.measureText(asset.tableName);
          ctx.lineWidth = Math.max(1, fontSize * 0.08);
          ctx.strokeStyle = textColor;
          ctx.beginPath();
          ctx.moveTo(-metrics.width / 2, fontSize * 0.42);
          ctx.lineTo(metrics.width / 2, fontSize * 0.42);
          ctx.stroke();
        }
        ctx.restore();
      };

      const drawAsset = (asset: Asset, offsetX = 0, offsetY = 0) => {
        const worldWidth = (asset.width || 100) * (asset.scale || 1);
        const worldHeight = (asset.height || 100) * (asset.scale || 1);
        const assetWidth = worldWidth * zoom;
        const assetHeight = worldHeight * zoom;
        const screenX = (asset.x + offsetX) * zoom + panX;
        const screenY = (asset.y + offsetY) * zoom + panY;

        if (
          screenX + assetWidth / 2 < -100 ||
          screenX - assetWidth / 2 > width + 100 ||
          screenY + assetHeight / 2 < -100 ||
          screenY - assetHeight / 2 > height + 100
        ) {
          return;
        }

        if (Math.max(assetWidth, assetHeight) < LOD_MIN_SCREEN_SIZE) {
          ctx.save();
          ctx.translate(screenX, screenY);
          ctx.rotate(((asset.rotation || 0) * Math.PI) / 180);
          ctx.globalAlpha = Math.max(0, Math.min(1, asset.opacity ?? 1));
          ctx.strokeStyle = '#111827';
          ctx.lineWidth = 1;
          ctx.strokeRect(-assetWidth / 2, -assetHeight / 2, assetWidth, assetHeight);
          ctx.restore();
          return;
        }

        const path = getAssetPath(asset);
        if (!path) return;

        const requestedImage = getImage(path, worldWidth, worldHeight, () => setImageVersion(version => version + 1));
        const image = getReadyImageForPath(path, requestedImage);

        if (!image) {
          return;
        }

        ctx.save();
        ctx.translate(screenX, screenY);
        ctx.rotate(((asset.rotation || 0) * Math.PI) / 180);
        ctx.globalAlpha = Math.max(0, Math.min(1, asset.opacity ?? 1));
        const rasterCanvas = shouldUseRasterCache
          ? getCachedRasterCanvas(path, image, assetWidth, assetHeight, dpr)
          : null;
        ctx.drawImage(rasterCanvas || image, -assetWidth / 2, -assetHeight / 2, assetWidth, assetHeight);
        drawAssetLabel(asset, assetWidth, assetHeight);
        ctx.restore();
      };

      visibleFastAssets.forEach(asset => {
        if (previewIds?.has(asset.id)) return;
        drawAsset(asset);
      });

      if (dragPreview) {
        visibleFastAssets.forEach(asset => {
          if (!previewIds?.has(asset.id)) return;
          drawAsset(asset, dragPreview.dx, dragPreview.dy);
        });
      }
    });

    return () => {
      if (drawFrameRef.current !== null) {
        cancelAnimationFrame(drawFrameRef.current);
        drawFrameRef.current = null;
      }
    };
  }, [visibleFastAssets, panX, panY, zoom, viewportSize.width, viewportSize.height, dragPreview, imageVersion, globalTableNumberingPosition, globalTableNumberingOrientation, globalTableNumberingFontSize, globalTableNumberingFontFamily, globalTableNumberingFontWeight, globalTableNumberingFontStyle, globalTableNumberingTextDecoration, globalTableNumberingColor]);

  return (
    <canvas
      ref={canvasRef}
      data-workspace-asset-canvas="true"
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
