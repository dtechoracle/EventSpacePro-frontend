"use client";

import React, { useState, useRef, useMemo } from "react";
import { Download, Upload, Plus, X, Minus } from "lucide-react";
import { useSceneStore, AssetInstance } from "@/store/sceneStore";
import { useProjectStore } from "@/store/projectStore";
import { useEditorStore } from "@/store/editorStore";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import PlanPreview from "../dashboard/PlanPreview";
import toast from "react-hot-toast";
import { ASSET_LIBRARY } from "@/lib/assets";

const svgCache: Record<string, string> = {};

const loadSvgAssets = async (assets: AssetInstance[]) => {
  const loadedImages = new Map<string, HTMLImageElement>();

  await Promise.all(assets.map(async (asset) => {
    // Skip shapes/walls/freehand
    const isShape = asset.type === 'circle' || asset.type === 'rect' || asset.type === 'ellipse' || asset.type === 'line' || asset.type === 'polyline';
    const isWall = asset.type === 'wall-segments';
    const isFreehand = asset.type === 'freehand';

    if (isShape || isWall || isFreehand) return;

    // Find definition
    const definition = ASSET_LIBRARY.find(item => item.id === asset.type || item.name === asset.type);
    if (!definition) return;

    try {
      let svg = svgCache[definition.path];
      if (!svg) {
        const res = await fetch(definition.path);
        svg = await res.text();
        svgCache[definition.path] = svg;
      }

      // Apply styles (Fill/Stroke/Color) - Matching AssetRenderer Logic
      if (asset.fillColor) {
        svg = svg.replace(/fill="([^"]*)"/gi, (match, value) => value === 'none' ? match : `fill="${asset.fillColor}"`);
        svg = svg.replace(/fill='([^']*)'/gi, (match, value) => value === 'none' ? match : `fill='${asset.fillColor}'`);
      }
      if (asset.strokeColor) {
        svg = svg.replace(/stroke="([^"]*)"/gi, (match, value) => value === 'none' ? match : `stroke="${asset.strokeColor}"`);
        svg = svg.replace(/stroke='([^']*)'/gi, (match, value) => value === 'none' ? match : `stroke='${asset.strokeColor}'`);
      }
      if (asset.strokeWidth) {
        svg = svg.replace(/stroke-width="([^"]*)"/gi, `stroke-width="${asset.strokeWidth}"`);
        svg = svg.replace(/stroke-width='([^']*)'/gi, `stroke-width='${asset.strokeWidth}'`);
      }

      // Inject root style (fallback & currentColor)
      let style = "overflow: visible;";
      if (asset.fillColor) style += ` fill: ${asset.fillColor};`;
      if (asset.strokeColor) style += ` stroke: ${asset.strokeColor}; color: ${asset.strokeColor};`;

      svg = svg.replace(/<svg([^>]*)>/, (match, attrs) => {
        let newAttrs = attrs.replace(/\s(width|height|x|y|id)="[^"]*"/gi, '');
        return `<svg${newAttrs} style="${style}" preserveAspectRatio="none">`;
      });

      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.src = url;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
      loadedImages.set(asset.id, img);
    } catch (err) {
      console.error("Failed to load SVG for export", asset.type, err);
    }
  }));

  return loadedImages;
};


type PaperSize = "A1" | "A2" | "A3" | "A4" | "A5";
type ExportFormat = "pdf" | "png" | "jpeg";

const PAPER_SIZES: Record<PaperSize, { width: number; height: number; label: string }> = {
  A1: { width: 594, height: 841, label: "A1 (594 × 841 mm)" },
  A2: { width: 420, height: 594, label: "A2 (420 × 594 mm)" },
  A3: { width: 297, height: 420, label: "A3 (297 × 420 mm)" },
  A4: { width: 210, height: 297, label: "A4 (210 × 297 mm)" },
  A5: { width: 148, height: 210, label: "A5 (148 × 210 mm)" },
};

const EXPORT_DPI = 300; // High-resolution output so physical paper size is accurate when printed

interface ExportOption {
  id: string;
  paperSize: PaperSize;
  format: ExportFormat;
  exportSelection: boolean; // Export selected items only, or entire canvas
}

export default function ExportPanel() {
  // Get data from projectStore (where shapes, assets, walls are actually stored)
  const { shapes, assets, walls } = useProjectStore();

  // Get selection from both sceneStore (new editor) and editorStore (Workspace2D)
  const selectedAssetId = useSceneStore((s) => s.selectedAssetId);
  const selectedAssetIds = useSceneStore((s) => s.selectedAssetIds);
  const editorSelectedIds = useEditorStore((s) => s.selectedIds);

  const [isExpanded, setIsExpanded] = useState(true);
  const [exportOptions, setExportOptions] = useState<ExportOption[]>([
    { id: "1", paperSize: "A4", format: "pdf", exportSelection: false },
  ]);
  const [isExporting, setIsExporting] = useState(false);

  const selectedIds = useMemo(() => {
    const idSet = new Set<string>();
    if (selectedAssetId) {
      idSet.add(selectedAssetId);
    }
    (selectedAssetIds || []).forEach((id) => idSet.add(id));
    (editorSelectedIds || []).forEach((id) => idSet.add(id));
    return Array.from(idSet);
  }, [selectedAssetId, selectedAssetIds, editorSelectedIds]);

  const hasSelection = selectedIds.length > 0;

  // Convert shapes, assets, and walls to AssetInstance format for preview
  const allItems: AssetInstance[] = [
    // Shapes - map types correctly
    ...shapes.map(s => ({
      ...s,
      // Map shape types to preview-compatible types
      type: s.type === 'ellipse' ? 'circle' : s.type,
      backgroundColor: s.fill || '#e5e7eb',
      strokeColor: s.stroke || '#000000',
      strokeWidth: s.strokeWidth || 2,
      scale: 1, // Shapes don't have scale, use 1
    } as AssetInstance)),

    // Assets - pass through as-is
    ...assets.map(a => ({ ...a } as AssetInstance)),

    // Walls - convert to wall-segments format with proper nodes and edges
    ...walls.map(w => {
      // Filter out edges that don't have valid nodes
      const validEdges = w.edges.filter(edge => {
        const hasNodeA = w.nodes.some(n => n.id === edge.nodeA);
        const hasNodeB = w.nodes.some(n => n.id === edge.nodeB);
        return hasNodeA && hasNodeB;
      });

      if (validEdges.length === 0) return null;

      return {
        id: w.id,
        type: 'wall-segments' as const,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        scale: 1,
        rotation: 0,
        wallNodes: w.nodes,
        wallEdges: validEdges.map((edge) => ({
          id: edge.id,
          a: w.nodes.findIndex(n => n.id === edge.nodeA),
          b: w.nodes.findIndex(n => n.id === edge.nodeB),
          thickness: edge.thickness
        })),
        lineColor: '#000000',
        wallThickness: validEdges[0]?.thickness || 150,
        zIndex: w.zIndex || 0,
      } as AssetInstance;
    }).filter(Boolean) as AssetInstance[]
  ];

  const addExportOption = () => {
    setExportOptions([
      ...exportOptions,
      { id: Date.now().toString(), paperSize: "A4", format: "pdf", exportSelection: false },
    ]);
  };

  const removeExportOption = (id: string) => {
    setExportOptions(exportOptions.filter((opt) => opt.id !== id));
  };

  const updateExportOption = (id: string, updates: Partial<ExportOption>) => {
    setExportOptions(
      exportOptions.map((opt) => (opt.id === id ? { ...opt, ...updates } : opt))
    );
  };

  const exportAllAssetsDirectly = async (option: ExportOption) => {
    // Use allItems which already has shapes/walls/assets unified and processed
    const assetsToExport = allItems;

    console.log("exportAllAssetsDirectly: Starting export", {
      totalAssets: assetsToExport.length,
      shapes: shapes.length,
      assets: assets.length,
      walls: walls.length,
      option,
    });

    if (assetsToExport.length === 0) {
      throw new Error("No assets found to export.");
    }

    // Calculate bounds for all assets (same logic as exportSelection)
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    assetsToExport.forEach(asset => {
      if (asset.type === 'wall-segments' && asset.wallNodes) {
        asset.wallNodes.forEach(node => {
          if (isFinite(node.x) && isFinite(node.y)) {
            minX = Math.min(minX, node.x);
            minY = Math.min(minY, node.y);
            maxX = Math.max(maxX, node.x);
            maxY = Math.max(maxY, node.y);
          }
        });
      } else if (asset.wallSegments) {
        asset.wallSegments.forEach(seg => {
          const startX = seg.start.x + asset.x;
          const startY = seg.start.y + asset.y;
          const endX = seg.end.x + asset.x;
          const endY = seg.end.y + asset.y;
          if (isFinite(startX) && isFinite(startY) && isFinite(endX) && isFinite(endY)) {
            minX = Math.min(minX, startX, endX);
            minY = Math.min(minY, startY, endY);
            maxX = Math.max(maxX, startX, endX);
            maxY = Math.max(maxY, startY, endY);
          }
        });
      } else if (asset.type === 'freehand' && (asset as any).points) {
        const points = (asset as any).points;
        if (Array.isArray(points)) {
          points.forEach((p: any) => {
            const px = p.x + asset.x;
            const py = p.y + asset.y;
            if (isFinite(px) && isFinite(py)) {
              minX = Math.min(minX, px);
              minY = Math.min(minY, py);
              maxX = Math.max(maxX, px);
              maxY = Math.max(maxY, py);
            }
          });
        }
      } else {
        const w = (asset.width || 0) * (asset.scale || 1);
        const h = (asset.height || 0) * (asset.scale || 1);
        if (isFinite(asset.x) && isFinite(asset.y)) {
          minX = Math.min(minX, asset.x - w / 2);
          minY = Math.min(minY, asset.y - h / 2);
          maxX = Math.max(maxX, asset.x + w / 2);
          maxY = Math.max(maxY, asset.y + h / 2);
        }
      }
    });

    if (!isFinite(minX)) {
      throw new Error("Could not calculate bounds for assets.");
    }

    console.log("exportAllAssetsDirectly: Calculated bounds", {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
    });

    // Render to canvas (reuse exportSelection rendering logic)
    const MM_TO_PX = 2;
    const padding = 50;
    const canvasWidth = (maxX - minX + padding * 2) * MM_TO_PX;
    const canvasHeight = (maxY - minY + padding * 2) * MM_TO_PX;

    if (!isFinite(canvasWidth) || !isFinite(canvasHeight) || canvasWidth <= 0 || canvasHeight <= 0) {
      throw new Error(`Invalid canvas dimensions: ${canvasWidth}x${canvasHeight}`);
    }

    console.log("exportAllAssetsDirectly: Creating canvas", {
      canvasWidth,
      canvasHeight,
      MM_TO_PX,
      padding,
    });

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = Math.max(1, Math.round(canvasWidth));
    exportCanvas.height = Math.max(1, Math.round(canvasHeight));
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) {
      throw new Error("Failed to get 2D context");
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    // Pre-load SVGs
    const loadedImages = await loadSvgAssets(assetsToExport);

    console.log("exportAllAssetsDirectly: Starting to render assets", {
      assetCount: assetsToExport.length,
    });

    // Render all assets using the same logic as exportSelection
    assetsToExport.forEach((asset, index) => {
      console.log(`exportAllAssetsDirectly: Rendering asset ${index + 1}/${assetsToExport.length}`, {
        id: asset.id,
        type: asset.type,
        x: asset.x,
        y: asset.y,
        width: asset.width,
        height: asset.height,
        scale: asset.scale,
        backgroundColor: asset.backgroundColor || asset.fillColor,
        strokeColor: asset.strokeColor,
        strokeWidth: asset.strokeWidth,
      });

      // This is the same rendering code from exportSelection - walls, shapes, etc.
      if (asset.type === 'wall-segments') {
        if (asset.wallNodes && asset.wallEdges) {
          asset.wallEdges.forEach(edge => {
            const a = asset.wallNodes![edge.a];
            const b = asset.wallNodes![edge.b];
            if (!a || !b) return;

            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len === 0) return;

            const thickness = Math.max(1, (asset.wallThickness || 150) * (asset.scale || 1));
            const nx = (-dy / len) * (thickness / 2);
            const ny = (dx / len) * (thickness / 2);

            const p1x = (a.x + nx - minX + padding) * MM_TO_PX;
            const p1y = (a.y + ny - minY + padding) * MM_TO_PX;
            const p2x = (b.x + nx - minX + padding) * MM_TO_PX;
            const p2y = (b.y + ny - minY + padding) * MM_TO_PX;
            const p3x = (b.x - nx - minX + padding) * MM_TO_PX;
            const p3y = (b.y - ny - minY + padding) * MM_TO_PX;
            const p4x = (a.x - nx - minX + padding) * MM_TO_PX;
            const p4y = (a.y - ny - minY + padding) * MM_TO_PX;

            ctx.fillStyle = '#e5e7eb';
            ctx.beginPath();
            ctx.moveTo(p1x, p1y);
            ctx.lineTo(p2x, p2y);
            ctx.lineTo(p3x, p3y);
            ctx.lineTo(p4x, p4y);
            ctx.closePath();
            ctx.fill();

            ctx.strokeStyle = asset.lineColor || "#000000";
            ctx.lineWidth = 2 * MM_TO_PX;
            ctx.lineCap = 'square';
            ctx.beginPath();
            ctx.moveTo(p1x, p1y);
            ctx.lineTo(p2x, p2y);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(p3x, p3y);
            ctx.lineTo(p4x, p4y);
            ctx.stroke();
          });
        } else if (asset.wallSegments) {
          ctx.strokeStyle = asset.lineColor || "#000000";
          ctx.lineWidth = (asset.wallThickness || 2) * MM_TO_PX;
          ctx.lineCap = 'round';
          asset.wallSegments.forEach(seg => {
            ctx.beginPath();
            ctx.moveTo((seg.start.x + asset.x - minX + padding) * MM_TO_PX, (seg.start.y + asset.y - minY + padding) * MM_TO_PX);
            ctx.lineTo((seg.end.x + asset.x - minX + padding) * MM_TO_PX, (seg.end.y + asset.y - minY + padding) * MM_TO_PX);
            ctx.stroke();
          });
        }
      } else if (asset.type === 'freehand') {
        const freehandAsset = asset as any;
        if (freehandAsset.points && Array.isArray(freehandAsset.points) && freehandAsset.points.length > 1) {
          ctx.strokeStyle = asset.strokeColor || freehandAsset.stroke || "#000000";
          ctx.lineWidth = Math.max(1, (asset.strokeWidth || 2) * (asset.scale || 1)) * MM_TO_PX;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          const startX = (freehandAsset.points[0].x + asset.x - minX + padding) * MM_TO_PX;
          const startY = (freehandAsset.points[0].y + asset.y - minY + padding) * MM_TO_PX;
          ctx.moveTo(startX, startY);
          for (let i = 1; i < freehandAsset.points.length; i++) {
            const px = (freehandAsset.points[i].x + asset.x - minX + padding) * MM_TO_PX;
            const py = (freehandAsset.points[i].y + asset.y - minY + padding) * MM_TO_PX;
            ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
      } else {
        const w = (asset.width || 0) * (asset.scale || 1);
        const h = (asset.height || 0) * (asset.scale || 1);
        const x = (asset.x - minX + padding) * MM_TO_PX;
        const y = (asset.y - minY + padding) * MM_TO_PX;

        ctx.save();
        ctx.translate(x, y);
        if (asset.rotation) {
          ctx.rotate((asset.rotation * Math.PI) / 180);
        }

        const img = loadedImages.get(asset.id);

        if (img) {
          // Render SVG Asset
          ctx.drawImage(img, -w * MM_TO_PX / 2, -h * MM_TO_PX / 2, w * MM_TO_PX, h * MM_TO_PX);
        } else if (asset.type === 'circle') {
          const fillColor = asset.backgroundColor || asset.fillColor || "#e5e7eb";
          const strokeColor = asset.strokeColor || "#000000";
          const strokeWidth = (asset.strokeWidth || 2) * MM_TO_PX;
          const rx = Math.max(0, Math.abs(w * MM_TO_PX / 2));
          const ry = Math.max(0, Math.abs(h * MM_TO_PX / 2));

          console.log(`exportAllAssetsDirectly: Rendering circle`, {
            fillColor,
            strokeColor,
            strokeWidth,
            rx,
            ry,
            x,
            y,
            w,
            h,
          });

          ctx.fillStyle = fillColor;
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = strokeWidth;
          ctx.beginPath();
          ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.fillStyle = asset.backgroundColor || asset.fillColor || "#e5e7eb";
          ctx.strokeStyle = asset.strokeColor || "#000000";
          ctx.lineWidth = (asset.strokeWidth || 1) * MM_TO_PX;
          ctx.fillRect(-w * MM_TO_PX / 2, -h * MM_TO_PX / 2, w * MM_TO_PX, h * MM_TO_PX);
          ctx.strokeRect(-w * MM_TO_PX / 2, -h * MM_TO_PX / 2, w * MM_TO_PX, h * MM_TO_PX);
        }
        ctx.restore();
      }
    });

    // Validate that something was actually drawn
    const imageData = ctx.getImageData(0, 0, Math.min(100, exportCanvas.width), Math.min(100, exportCanvas.height));
    const pixels = imageData.data;
    let hasContent = false;
    for (let i = 0; i < pixels.length; i += 4) {
      // Check if pixel is not white (255, 255, 255)
      if (pixels[i] !== 255 || pixels[i + 1] !== 255 || pixels[i + 2] !== 255) {
        hasContent = true;
        break;
      }
    }

    if (!hasContent && exportCanvas.width > 100 && exportCanvas.height > 100) {
      console.warn("exportAllAssetsDirectly: Canvas appears to be blank after rendering");
      // Check a larger sample
      const largerSample = ctx.getImageData(0, 0, exportCanvas.width, exportCanvas.height);
      const largerPixels = largerSample.data;
      let hasContentLarge = false;
      for (let i = 0; i < largerPixels.length; i += 4) {
        if (largerPixels[i] !== 255 || largerPixels[i + 1] !== 255 || largerPixels[i + 2] !== 255) {
          hasContentLarge = true;
          break;
        }
      }
      if (!hasContentLarge) {
        throw new Error("Failed to render any content to canvas. Please check that your assets are visible on the canvas.");
      }
    }

    console.log("exportAllAssetsDirectly: Rendering complete, scaling to paper size", {
      canvasWidth: exportCanvas.width,
      canvasHeight: exportCanvas.height,
      hasContent,
    });

    // Scale to paper size and save
    await scaleToPaperSize(exportCanvas, option);

    console.log("exportAllAssetsDirectly: Export complete");
  };


  const exportSelection = async (option: ExportOption) => {
    // Use allItems which already has shapes/walls/assets unified and processed
    const selectedAssets = allItems.filter(item => selectedIds.includes(item.id));

    if (selectedAssets.length === 0) {
      throw new Error("No items selected for export.");
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    selectedAssets.forEach(asset => {
      if (asset.type === 'wall-segments' && asset.wallNodes) {
        asset.wallNodes.forEach(node => {
          if (isFinite(node.x) && isFinite(node.y)) {
            minX = Math.min(minX, node.x);
            minY = Math.min(minY, node.y);
            maxX = Math.max(maxX, node.x);
            maxY = Math.max(maxY, node.y);
          }
        });
      } else if (asset.wallSegments) {
        asset.wallSegments.forEach(seg => {
          const startX = seg.start.x + asset.x;
          const startY = seg.start.y + asset.y;
          const endX = seg.end.x + asset.x;
          const endY = seg.end.y + asset.y;
          if (isFinite(startX) && isFinite(startY) && isFinite(endX) && isFinite(endY)) {
            minX = Math.min(minX, startX, endX);
            minY = Math.min(minY, startY, endY);
            maxX = Math.max(maxX, startX, endX);
            maxY = Math.max(maxY, startY, endY);
          }
        });
      } else if (asset.type === 'freehand' && (asset as any).points) {
        const points = (asset as any).points;
        if (Array.isArray(points)) {
          points.forEach((p: any) => {
            const px = p.x + asset.x;
            const py = p.y + asset.y;
            if (isFinite(px) && isFinite(py)) {
              minX = Math.min(minX, px);
              minY = Math.min(minY, py);
              maxX = Math.max(maxX, px);
              maxY = Math.max(maxY, py);
            }
          });
        }
      } else {
        const w = (asset.width || 0) * (asset.scale || 1);
        const h = (asset.height || 0) * (asset.scale || 1);
        if (isFinite(asset.x) && isFinite(asset.y)) {
          minX = Math.min(minX, asset.x - w / 2);
          minY = Math.min(minY, asset.y - h / 2);
          maxX = Math.max(maxX, asset.x + w / 2);
          maxY = Math.max(maxY, asset.y + h / 2);
        }
      }
    });

    if (!isFinite(minX)) {
      throw new Error("Could not calculate selection bounds for selected items.");
    }

    // Create a temporary container with just the selected items
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    tempContainer.style.width = `${maxX - minX}px`;
    tempContainer.style.height = `${maxY - minY}px`;
    tempContainer.style.backgroundColor = '#ffffff';
    document.body.appendChild(tempContainer);

    try {
      // Render selected assets to canvas
      const MM_TO_PX = 2;
      const exportCanvas = document.createElement('canvas');
      const padding = 50; // mm
      const canvasWidth = (maxX - minX + padding * 2) * MM_TO_PX;
      const canvasHeight = (maxY - minY + padding * 2) * MM_TO_PX;

      // Validate dimensions
      if (!isFinite(canvasWidth) || !isFinite(canvasHeight) || canvasWidth <= 0 || canvasHeight <= 0) {
        throw new Error(`Invalid canvas dimensions for selection export: ${canvasWidth}x${canvasHeight}`);
      }

      exportCanvas.width = Math.max(1, Math.round(canvasWidth));
      exportCanvas.height = Math.max(1, Math.round(canvasHeight));
      const ctx = exportCanvas.getContext('2d');
      if (!ctx) {
        throw new Error("Failed to get 2D context for selection export canvas");
      }

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

      // Pre-load SVGs
      const loadedImages = await loadSvgAssets(selectedAssets);

      // Render selected assets
      selectedAssets.forEach(asset => {
        if (asset.type === 'wall-segments') {
          if (asset.wallNodes && asset.wallEdges) {
            asset.wallEdges.forEach(edge => {
              const a = asset.wallNodes![edge.a];
              const b = asset.wallNodes![edge.b];
              if (!a || !b) return;

              // Calculate wall vector
              const dx = b.x - a.x;
              const dy = b.y - a.y;
              const len = Math.sqrt(dx * dx + dy * dy);
              if (len === 0) return;

              // Calculate normal vector for thickness
              const thickness = Math.max(1, (asset.wallThickness || 150) * (asset.scale || 1));
              const nx = (-dy / len) * (thickness / 2);
              const ny = (dx / len) * (thickness / 2);

              // Calculate corner points relative to canvas
              const p1x = (a.x + nx - minX + padding) * MM_TO_PX;
              const p1y = (a.y + ny - minY + padding) * MM_TO_PX;
              const p2x = (b.x + nx - minX + padding) * MM_TO_PX;
              const p2y = (b.y + ny - minY + padding) * MM_TO_PX;
              const p3x = (b.x - nx - minX + padding) * MM_TO_PX;
              const p3y = (b.y - ny - minY + padding) * MM_TO_PX;
              const p4x = (a.x - nx - minX + padding) * MM_TO_PX;
              const p4y = (a.y - ny - minY + padding) * MM_TO_PX;

              // Draw filled wall (lighter for double-line look)
              ctx.fillStyle = '#e5e7eb';
              ctx.beginPath();
              ctx.moveTo(p1x, p1y);
              ctx.lineTo(p2x, p2y);
              ctx.lineTo(p3x, p3y);
              ctx.lineTo(p4x, p4y);
              ctx.closePath();
              ctx.fill();

              // Draw outlines (Explicit double lines)
              ctx.strokeStyle = asset.lineColor || "#000000";
              ctx.lineWidth = 2 * MM_TO_PX; // Thicker outline
              ctx.lineCap = 'square';

              // Line 1
              ctx.beginPath();
              ctx.moveTo(p1x, p1y);
              ctx.lineTo(p2x, p2y);
              ctx.stroke();

              // Line 2
              ctx.beginPath();
              ctx.moveTo(p3x, p3y);
              ctx.lineTo(p4x, p4y);
              ctx.stroke();
            });
          } else if (asset.wallSegments) {
            // Legacy wall segments support
            ctx.strokeStyle = asset.lineColor || "#000000";
            ctx.lineWidth = (asset.wallThickness || 2) * MM_TO_PX;
            ctx.lineCap = 'round';
            asset.wallSegments.forEach(seg => {
              ctx.beginPath();
              ctx.moveTo((seg.start.x + asset.x - minX + padding) * MM_TO_PX, (seg.start.y + asset.y - minY + padding) * MM_TO_PX);
              ctx.lineTo((seg.end.x + asset.x - minX + padding) * MM_TO_PX, (seg.end.y + asset.y - minY + padding) * MM_TO_PX);
              ctx.stroke();
            });
          }
        } else if (asset.type === 'freehand') {
          const freehandAsset = asset as any;
          if (freehandAsset.points && Array.isArray(freehandAsset.points) && freehandAsset.points.length > 1) {
            ctx.strokeStyle = asset.strokeColor || freehandAsset.stroke || "#000000";
            ctx.lineWidth = Math.max(1, (asset.strokeWidth || 2) * (asset.scale || 1)) * MM_TO_PX;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            ctx.beginPath();
            const startX = (freehandAsset.points[0].x + asset.x - minX + padding) * MM_TO_PX;
            const startY = (freehandAsset.points[0].y + asset.y - minY + padding) * MM_TO_PX;
            ctx.moveTo(startX, startY);

            for (let i = 1; i < freehandAsset.points.length; i++) {
              const px = (freehandAsset.points[i].x + asset.x - minX + padding) * MM_TO_PX;
              const py = (freehandAsset.points[i].y + asset.y - minY + padding) * MM_TO_PX;
              ctx.lineTo(px, py);
            }
            ctx.stroke();
          }
        } else {
          const w = (asset.width || 0) * (asset.scale || 1);
          const h = (asset.height || 0) * (asset.scale || 1);
          const x = (asset.x - minX + padding) * MM_TO_PX;
          const y = (asset.y - minY + padding) * MM_TO_PX;

          ctx.save();
          ctx.translate(x, y);
          if (asset.rotation) {
            ctx.rotate((asset.rotation * Math.PI) / 180);
          }

          const img = loadedImages.get(asset.id);

          if (img) {
            // Render SVG Asset
            ctx.drawImage(img, -w * MM_TO_PX / 2, -h * MM_TO_PX / 2, w * MM_TO_PX, h * MM_TO_PX);
          } else if (asset.type === 'circle') {
            ctx.fillStyle = asset.backgroundColor || asset.fillColor || "#e5e7eb";
            ctx.strokeStyle = asset.strokeColor || "#000000";
            ctx.lineWidth = (asset.strokeWidth || 1) * MM_TO_PX;
            ctx.beginPath();
            // Ensure positive radii to prevent IndexSizeError
            const rx = Math.max(0, Math.abs(w * MM_TO_PX / 2));
            const ry = Math.max(0, Math.abs(h * MM_TO_PX / 2));
            ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          } else {
            ctx.fillStyle = asset.backgroundColor || asset.fillColor || "#e5e7eb";
            ctx.strokeStyle = asset.strokeColor || "#000000";
            ctx.lineWidth = (asset.strokeWidth || 1) * MM_TO_PX;
            ctx.fillRect(-w * MM_TO_PX / 2, -h * MM_TO_PX / 2, w * MM_TO_PX, h * MM_TO_PX);
            ctx.strokeRect(-w * MM_TO_PX / 2, -h * MM_TO_PX / 2, w * MM_TO_PX, h * MM_TO_PX);
          }
          ctx.restore();
        }

      });

      // Scale to paper size and save
      await scaleToPaperSize(exportCanvas, option);
    } catch (error) {
      // Re-throw with better context
      if (error instanceof Error) {
        throw new Error(`Selection export failed: ${error.message}`);
      }
      throw new Error(`Selection export failed: ${String(error)}`);
    } finally {
      // Clean up temporary container
      if (document.body.contains(tempContainer)) {
        document.body.removeChild(tempContainer);
      }
    }
  };

  const scaleToPaperSize = async (sourceCanvas: HTMLCanvasElement, option: ExportOption) => {
    try {
      // Validate source canvas
      if (!sourceCanvas || sourceCanvas.width <= 0 || sourceCanvas.height <= 0) {
        throw new Error(`Invalid source canvas dimensions: ${sourceCanvas?.width || 0}x${sourceCanvas?.height || 0}`);
      }

      const paperSizeInfo = PAPER_SIZES[option.paperSize];
      const mmToPx = EXPORT_DPI / 25.4;
      const paperWidthPx = paperSizeInfo.width * mmToPx;
      const paperHeightPx = paperSizeInfo.height * mmToPx;

      // Validate paper dimensions
      if (!isFinite(paperWidthPx) || !isFinite(paperHeightPx) || paperWidthPx <= 0 || paperHeightPx <= 0) {
        throw new Error(`Invalid paper dimensions: ${paperWidthPx}x${paperHeightPx}`);
      }

      const canvasAspect = sourceCanvas.width / sourceCanvas.height;
      const paperAspect = paperWidthPx / paperHeightPx;

      if (!isFinite(canvasAspect) || canvasAspect <= 0) {
        throw new Error(`Invalid canvas aspect ratio: ${canvasAspect}`);
      }

      let finalWidth: number;
      let finalHeight: number;
      let offsetX = 0;
      let offsetY = 0;

      if (canvasAspect > paperAspect) {
        finalWidth = paperWidthPx;
        finalHeight = paperWidthPx / canvasAspect;
        offsetY = (paperHeightPx - finalHeight) / 2;
      } else {
        finalHeight = paperHeightPx;
        finalWidth = paperHeightPx * canvasAspect;
        offsetX = (paperWidthPx - finalWidth) / 2;
      }

      // Validate final dimensions
      if (!isFinite(finalWidth) || !isFinite(finalHeight) || finalWidth <= 0 || finalHeight <= 0) {
        throw new Error(`Invalid calculated dimensions: ${finalWidth}x${finalHeight}`);
      }

      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = Math.max(1, Math.round(paperWidthPx));
      finalCanvas.height = Math.max(1, Math.round(paperHeightPx));
      const ctx = finalCanvas.getContext('2d');
      if (!ctx) {
        throw new Error("Failed to get 2D context for final canvas");
      }

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

      // Draw the source canvas onto the final canvas
      try {
        ctx.drawImage(
          sourceCanvas,
          Math.round(offsetX),
          Math.round(offsetY),
          Math.round(finalWidth),
          Math.round(finalHeight)
        );
      } catch (drawError) {
        console.error("drawImage error in scaleToPaperSize:", drawError);
        throw new Error(`Failed to draw image: ${drawError instanceof Error ? drawError.message : 'Unknown error'}`);
      }

      await saveCanvas(finalCanvas, option);
    } catch (error) {
      console.error("scaleToPaperSize error:", error);
      if (error instanceof Error) {
        throw new Error(`Failed to scale to paper size: ${error.message}`);
      }
      throw new Error(`Failed to scale to paper size: ${String(error)}`);
    }
  };

  const saveCanvas = async (canvas: HTMLCanvasElement, option: ExportOption): Promise<void> => {
    const fileName = `canvas-export-${Date.now()}.${option.format}`;
    const paperSizeInfo = PAPER_SIZES[option.paperSize];

    // Validate canvas has content before attempting to save
    console.log("saveCanvas: Validating canvas content", {
      width: canvas.width,
      height: canvas.height,
      format: option.format,
    });

    // Check if canvas has any non-white pixels
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error("Failed to get canvas context for validation");
    }

    const sampleSize = Math.max(1, Math.min(200, canvas.width, canvas.height));
    const samplePositions = [
      { x: 0, y: 0 },
      { x: Math.max(0, canvas.width - sampleSize), y: 0 },
      { x: 0, y: Math.max(0, canvas.height - sampleSize) },
      { x: Math.max(0, canvas.width - sampleSize), y: Math.max(0, canvas.height - sampleSize) },
      {
        x: Math.max(0, Math.floor(canvas.width / 2 - sampleSize / 2)),
        y: Math.max(0, Math.floor(canvas.height / 2 - sampleSize / 2)),
      },
    ];

    const hasNonWhitePixels = (x: number, y: number, width: number, height: number) => {
      if (width <= 0 || height <= 0) return false;
      const imageData = ctx.getImageData(x, y, width, height);
      const pixels = imageData.data;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i] !== 255 || pixels[i + 1] !== 255 || pixels[i + 2] !== 255) {
          return true;
        }
      }
      return false;
    };

    let hasContent = false;
    for (const pos of samplePositions) {
      const sampleWidth = Math.min(sampleSize, canvas.width - pos.x);
      const sampleHeight = Math.min(sampleSize, canvas.height - pos.y);
      if (hasNonWhitePixels(pos.x, pos.y, sampleWidth, sampleHeight)) {
        hasContent = true;
        break;
      }
    }

    if (!hasContent) {
      // Fallback: inspect entire canvas before declaring blank
      hasContent = hasNonWhitePixels(0, 0, canvas.width, canvas.height);
    }

    console.log("saveCanvas: Content validation result", {
      hasContent,
      sampleSize,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
    });

    if (!hasContent) {
      throw new Error("Canvas appears to be blank. No content was rendered. Please ensure your selection contains visible elements.");
    }

    try {
      if (option.format === "pdf") {
        try {
          const pdf = new jsPDF({
            orientation: paperSizeInfo.width > paperSizeInfo.height ? "landscape" : "portrait",
            unit: "mm",
            format: option.paperSize.toLowerCase(),
          });

          // Validate canvas before converting to data URL
          if (canvas.width <= 0 || canvas.height <= 0) {
            throw new Error("Canvas has invalid dimensions for PDF export");
          }

          const imgData = canvas.toDataURL("image/png", 1.0);
          if (!imgData || imgData === "data:,") {
            throw new Error("Failed to convert canvas to image data");
          }

          pdf.addImage(imgData, "PNG", 0, 0, paperSizeInfo.width, paperSizeInfo.height, undefined, "FAST");
          pdf.save(fileName);
        } catch (pdfError) {
          console.error("PDF export error:", pdfError);
          throw new Error(`Failed to create PDF: ${pdfError instanceof Error ? pdfError.message : 'Unknown error'}`);
        }
      } else {
        const mimeType = option.format === "png" ? "image/png" : "image/jpeg";

        // Validate canvas before converting to blob
        if (canvas.width <= 0 || canvas.height <= 0) {
          throw new Error("Canvas has invalid dimensions for image export");
        }

        return new Promise<void>((resolve, reject) => {
          try {
            canvas.toBlob(
              (blob) => {
                try {
                  if (!blob) {
                    reject(new Error("Failed to create image blob"));
                    return;
                  }

                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = fileName;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                  resolve();
                } catch (downloadError) {
                  console.error("Download error:", downloadError);
                  reject(new Error(`Failed to download file: ${downloadError instanceof Error ? downloadError.message : 'Unknown error'}`));
                }
              },
              mimeType,
              option.format === "jpeg" ? 0.95 : 1.0
            );
          } catch (blobError) {
            console.error("toBlob error:", blobError);
            reject(new Error(`Failed to convert canvas to blob: ${blobError instanceof Error ? blobError.message : 'Unknown error'}`));
          }
        });
      }
    } catch (error) {
      console.error("saveCanvas error:", error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to save canvas: ${String(error)}`);
    }
  };

  const exportCanvas = async (element: HTMLElement, option: ExportOption) => {
    // Hide UI elements that shouldn't be in export
    const uiElements = document.querySelectorAll('[data-export-hide]');
    uiElements.forEach((el) => {
      (el as HTMLElement).style.display = 'none';
    });

    try {
      // Validate element dimensions
      const rect = element.getBoundingClientRect();
      const scrollWidth = element.scrollWidth || rect.width;
      const scrollHeight = element.scrollHeight || rect.height;

      if (scrollWidth <= 0 || scrollHeight <= 0) {
        throw new Error(`Invalid canvas dimensions: ${scrollWidth}x${scrollHeight}. Please ensure the canvas is visible.`);
      }

      // Use html2canvas to capture the canvas exactly as it appears
      let canvas: HTMLCanvasElement | null = null;
      try {
        // Try to find the inner canvas div if we're on the outer container
        let targetElement = element;
        const innerCanvas = element.querySelector('[data-canvas-container]') as HTMLElement;
        if (innerCanvas) {
          const innerRect = innerCanvas.getBoundingClientRect();
          if (innerRect.width > 0 && innerRect.height > 0) {
            targetElement = innerCanvas;
            console.log("Using inner canvas element for export");
          }
        }

        // Limit dimensions to prevent memory issues
        const maxDimension = 10000; // pixels
        const exportWidth = Math.min(maxDimension, Math.max(1, scrollWidth));
        const exportHeight = Math.min(maxDimension, Math.max(1, scrollHeight));

        console.log("html2canvas config:", {
          element: targetElement.tagName,
          width: exportWidth,
          height: exportHeight,
          scrollWidth: targetElement.scrollWidth,
          scrollHeight: targetElement.scrollHeight,
          clientWidth: targetElement.clientWidth,
          clientHeight: targetElement.clientHeight,
        });

        canvas = await html2canvas(targetElement, {
          backgroundColor: '#ffffff',
          scale: 1, // Reduced from 2 to prevent memory issues
          useCORS: true,
          allowTaint: true, // Changed to true to allow cross-origin images
          logging: true, // Enable logging to see what's happening
          width: exportWidth,
          height: exportHeight,
          x: 0,
          y: 0,
          scrollX: 0,
          scrollY: 0,
          windowWidth: exportWidth,
          windowHeight: exportHeight,
          removeContainer: false,
          imageTimeout: 15000,
          ignoreElements: (el) => {
            // Skip elements that might have unsupported color formats or are hidden
            try {
              const computedStyle = window.getComputedStyle(el);
              const bgColor = computedStyle.backgroundColor;
              const color = computedStyle.color;
              const display = computedStyle.display;
              const visibility = computedStyle.visibility;

              // Skip hidden elements
              if (display === 'none' || visibility === 'hidden') {
                return true;
              }

              // Check if color uses lab() or other unsupported formats
              return bgColor?.includes('lab(') || color?.includes('lab(') ||
                bgColor?.includes('lch(') || color?.includes('lch(');
            } catch (e) {
              // If we can't get computed style, skip the element
              return true;
            }
          },
          onclone: (clonedDoc, element) => {
            // Fix any potential issues in the cloned document
            const clonedElement = element as HTMLElement;
            if (clonedElement) {
              // Ensure the cloned element is visible
              clonedElement.style.visibility = 'visible';
              clonedElement.style.display = 'block';
            }
          },
        });

        // Check if the captured canvas is blank (all white pixels)
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const imageData = ctx.getImageData(0, 0, Math.min(100, canvas.width), Math.min(100, canvas.height));
          const pixels = imageData.data;
          let allWhite = true;
          for (let i = 0; i < pixels.length; i += 4) {
            // Check if pixel is not white (255, 255, 255)
            if (pixels[i] !== 255 || pixels[i + 1] !== 255 || pixels[i + 2] !== 255) {
              allWhite = false;
              break;
            }
          }
          if (allWhite && canvas.width > 100 && canvas.height > 100) {
            console.warn("html2canvas captured a blank canvas, falling back to direct rendering");
            throw new Error("Captured canvas appears to be blank");
          }
        }
      } catch (html2canvasError) {
        console.error("html2canvas error details:", {
          error: html2canvasError,
          message: html2canvasError instanceof Error ? html2canvasError.message : String(html2canvasError),
          stack: html2canvasError instanceof Error ? html2canvasError.stack : undefined,
          name: html2canvasError instanceof Error ? html2canvasError.name : undefined,
        });

        // Try with simpler options as fallback
        let fallbackSucceeded = false;
        try {
          console.log("Attempting fallback capture with simpler options...");
          const fallbackCanvas = await html2canvas(element, {
            backgroundColor: '#ffffff',
            scale: 1,
            useCORS: false,
            allowTaint: true,
            logging: true,
          });

          // Check if fallback canvas is also blank
          const fallbackCtx = fallbackCanvas.getContext('2d');
          if (fallbackCtx) {
            const imageData = fallbackCtx.getImageData(0, 0, Math.min(100, fallbackCanvas.width), Math.min(100, fallbackCanvas.height));
            const pixels = imageData.data;
            let allWhite = true;
            for (let i = 0; i < pixels.length; i += 4) {
              if (pixels[i] !== 255 || pixels[i + 1] !== 255 || pixels[i + 2] !== 255) {
                allWhite = false;
                break;
              }
            }
            if (!allWhite || fallbackCanvas.width <= 100) {
              canvas = fallbackCanvas;
              fallbackSucceeded = true;
              console.log("Fallback capture succeeded");
            } else {
              console.warn("Fallback canvas is also blank");
            }
          }
        } catch (fallbackError) {
          console.error("Fallback capture also failed:", fallbackError);
        }

        // If html2canvas failed or produced blank canvas, use direct rendering
        if (!fallbackSucceeded) {
          console.log("html2canvas failed or produced blank canvas, using direct asset rendering instead...");
          try {
            // Export all assets using the direct rendering method
            await exportAllAssetsDirectly(option);
            return; // Success, exit early - don't continue with html2canvas path
          } catch (directRenderError) {
            console.error("Direct rendering also failed:", directRenderError);
            const errorMessage = html2canvasError instanceof Error
              ? html2canvasError.message
              : String(html2canvasError);
            throw new Error(
              `Failed to export canvas. ` +
              `html2canvas error: ${errorMessage}. ` +
              `Direct rendering error: ${directRenderError instanceof Error ? directRenderError.message : String(directRenderError)}. ` +
              `Please try using "Export selected items only" or refresh the page and try again.`
            );
          }
        }
      }

      // Validate captured canvas
      if (!canvas || canvas.width <= 0 || canvas.height <= 0) {
        // If we have a blank/invalid canvas, try direct rendering
        console.log("Invalid canvas from html2canvas, using direct rendering...");
        await exportAllAssetsDirectly(option);
        return;
      }

      // Ensure canvas is defined before proceeding
      if (!canvas) {
        throw new Error("Canvas capture failed");
      }

      // Get paper size dimensions in mm
      const paperSizeInfo = PAPER_SIZES[option.paperSize];

      // Calculate scaling to fit paper size
      // Convert mm to pixels at 96 DPI (standard screen DPI)
      const mmToPx = 96 / 25.4; // 96 DPI = 3.779527559 pixels per mm
      const paperWidthPx = paperSizeInfo.width * mmToPx;
      const paperHeightPx = paperSizeInfo.height * mmToPx;

      // Calculate scale to fit canvas content to paper while maintaining aspect ratio
      const canvasAspect = canvas.width / canvas.height;
      const paperAspect = paperWidthPx / paperHeightPx;

      let finalWidth: number;
      let finalHeight: number;
      let offsetX = 0;
      let offsetY = 0;

      if (canvasAspect > paperAspect) {
        // Canvas is wider - fit to paper width
        finalWidth = paperWidthPx;
        finalHeight = paperWidthPx / canvasAspect;
        offsetY = (paperHeightPx - finalHeight) / 2;
      } else {
        // Canvas is taller - fit to paper height
        finalHeight = paperHeightPx;
        finalWidth = paperHeightPx * canvasAspect;
        offsetX = (paperWidthPx - finalWidth) / 2;
      }

      // Validate final dimensions
      if (!isFinite(finalWidth) || !isFinite(finalHeight) || finalWidth <= 0 || finalHeight <= 0) {
        throw new Error(`Invalid calculated dimensions: ${finalWidth}x${finalHeight}`);
      }

      // Create final canvas at paper size
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = Math.max(1, Math.round(paperWidthPx));
      finalCanvas.height = Math.max(1, Math.round(paperHeightPx));
      const ctx = finalCanvas.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to get 2D context for final canvas');
      }

      // Fill with white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

      // Draw the captured canvas centered on paper
      try {
        ctx.drawImage(canvas, Math.round(offsetX), Math.round(offsetY), Math.round(finalWidth), Math.round(finalHeight));
      } catch (drawError) {
        console.error("drawImage error:", drawError);
        throw new Error(`Failed to draw image to canvas: ${drawError instanceof Error ? drawError.message : 'Unknown error'}`);
      }

      // Export based on format
      await saveCanvas(finalCanvas, option);
    } catch (error) {
      // Re-throw with better context
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Export failed: ${String(error)}`);
    } finally {
      // Restore UI elements
      uiElements.forEach((el) => {
        (el as HTMLElement).style.display = '';
      });
    }
  };

  const handleExport = async (option: ExportOption) => {
    setIsExporting(true);
    try {
      // If exporting selection only, we need to create a custom export
      if (option.exportSelection && hasSelection) {
        await exportSelection(option);
        return;
      }

      // For full canvas export, use direct rendering by default since it's more reliable
      // than html2canvas which has issues with transformed containers and complex SVG rendering
      console.log("Starting full canvas export using direct rendering...");

      // Use direct rendering for full canvas export (more reliable than html2canvas)
      await exportAllAssetsDirectly(option);
    } catch (error) {
      console.error("Export error:", error);
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else {
        try {
          errorMessage = JSON.stringify(error);
        } catch (e) {
          errorMessage = 'Non-serializable error';
        }
      }
      alert(`Export failed: ${errorMessage}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          const { shapes, assets, walls } = useProjectStore.getState();

          // Import shapes
          if (data.shapes && Array.isArray(data.shapes)) {
            data.shapes.forEach((shape: any) => {
              useProjectStore.getState().addShape(shape);
            });
          }

          // Import assets
          if (data.assets && Array.isArray(data.assets)) {
            data.assets.forEach((asset: any) => {
              useProjectStore.getState().addAsset(asset);
            });
          }

          // Import walls
          if (data.walls && Array.isArray(data.walls)) {
            data.walls.forEach((wall: any) => {
              useProjectStore.getState().addWall(wall);
            });
          }

          toast.success('Project imported successfully!');
        } catch (error) {
          toast.error('Failed to import project. Invalid file format.');
          console.error('Import error:', error);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div className="border-t border-gray-200 pt-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Export / Import</h3>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
          title={isExpanded ? "Collapse export options" : "Expand export options"}
        >
          {isExpanded ? (
            <Minus className="w-4 h-4 text-gray-600" />
          ) : (
            <Plus className="w-4 h-4 text-gray-600" />
          )}
        </button>
      </div>

      {isExpanded && (
        <>
          <div className="space-y-3">
            {exportOptions.map((option) => (
              <div
                key={option.id}
                className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">Export {option.id}</span>
                  {exportOptions.length > 1 && (
                    <button
                      onClick={() => removeExportOption(option.id)}
                      className="p-1 hover:bg-gray-200 rounded transition-colors"
                    >
                      <X className="w-3 h-3 text-gray-500" />
                    </button>
                  )}
                </div>

                {/* Export Selection Toggle */}
                <div className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    id={`export-selection-${option.id}`}
                    checked={option.exportSelection}
                    onChange={(e) =>
                      updateExportOption(option.id, { exportSelection: e.target.checked })
                    }
                    disabled={!hasSelection}
                    className="rounded"
                  />
                  <label
                    htmlFor={`export-selection-${option.id}`}
                    className={hasSelection ? "text-gray-700" : "text-gray-400"}
                  >
                    Export selected items only
                  </label>
                </div>

                {/* Selection Preview */}
                {hasSelection && (
                  <div className="border-2 border-blue-300 rounded overflow-hidden bg-white">
                    <PlanPreview
                      assets={allItems.filter(item => selectedIds.includes(item.id))}
                      width={250}
                      height={140}
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={option.paperSize}
                    onChange={(e) =>
                      updateExportOption(option.id, { paperSize: e.target.value as PaperSize })
                    }
                    className="text-xs border border-gray-300 rounded px-2 py-1.5 bg-white"
                  >
                    {Object.entries(PAPER_SIZES).map(([size, info]) => (
                      <option key={size} value={size}>
                        {size} - {info.label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={option.format}
                    onChange={(e) =>
                      updateExportOption(option.id, { format: e.target.value as ExportFormat })
                    }
                    className="text-xs border border-gray-300 rounded px-2 py-1.5 bg-white uppercase"
                  >
                    <option value="pdf">PDF</option>
                    <option value="png">PNG</option>
                    <option value="jpeg">JPEG</option>
                  </select>
                </div>

                <button
                  onClick={() => handleExport(option)}
                  disabled={isExporting}
                  className={`w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded transition-colors ${isExporting
                    ? "bg-gray-400 text-white cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                >
                  <Download className="w-3 h-3" />
                  {isExporting ? "Exporting..." : `Export ${option.format.toUpperCase()}`}
                </button>
              </div>
            ))}

            <button
              onClick={addExportOption}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 border-2 border-dashed border-gray-300 rounded-lg text-xs text-gray-600 hover:border-gray-400 hover:bg-gray-50 transition-colors"
            >
              <Plus className="w-3 h-3" />
              Add Export Option
            </button>

            {/* Import Button */}
            <button
              onClick={handleImport}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors mt-2"
            >
              <Upload className="w-3 h-3" />
              Import Project
            </button>
          </div>
        </>
      )}
    </div>
  );
}