"use client";

import React, { useState } from "react";
import { Download, Plus, X, Minus } from "lucide-react";
import { useSceneStore } from "@/store/sceneStore";
import { jsPDF } from "jspdf";
import { ASSET_LIBRARY } from "@/lib/assets";

type PaperSize = "A1" | "A2" | "A3" | "A4" | "A5";
type ExportFormat = "pdf" | "png" | "jpeg";

const PAPER_SIZES: Record<PaperSize, { width: number; height: number; label: string }> = {
  A1: { width: 594, height: 841, label: "A1 (594 × 841 mm)" },
  A2: { width: 420, height: 594, label: "A2 (420 × 594 mm)" },
  A3: { width: 297, height: 420, label: "A3 (297 × 420 mm)" },
  A4: { width: 210, height: 297, label: "A4 (210 × 297 mm)" },
  A5: { width: 148, height: 210, label: "A5 (148 × 210 mm)" },
};

interface ExportOption {
  id: string;
  paperSize: PaperSize;
  format: ExportFormat;
}

export default function ExportPanel() {
  const selectedAssetIds = useSceneStore((s) => s.selectedAssetIds);
  const selectedAssetId = useSceneStore((s) => s.selectedAssetId);
  const assets = useSceneStore((s) => s.assets);
  const [isExpanded, setIsExpanded] = useState(true);
  const [exportOptions, setExportOptions] = useState<ExportOption[]>([
    { id: "1", paperSize: "A4", format: "png" },
  ]);
  
  // Check if any asset is selected (either via selectedAssetIds or selectedAssetId)
  const hasAnySelection = selectedAssetIds.length > 0 || selectedAssetId !== null;

  // Calculate bounding box of selected assets
  const getSelectedBounds = () => {
    // Get all selected asset IDs (from both selectedAssetIds array and selectedAssetId)
    const allSelectedIds = selectedAssetIds.length > 0 
      ? selectedAssetIds 
      : selectedAssetId 
        ? [selectedAssetId] 
        : [];
    
    if (allSelectedIds.length === 0) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    allSelectedIds.forEach((id) => {
      const asset = assets.find((a) => a.id === id);
      if (!asset) return;

      if (asset.type === "wall-segments" && asset.wallNodes) {
        asset.wallNodes.forEach((node) => {
          minX = Math.min(minX, node.x);
          minY = Math.min(minY, node.y);
          maxX = Math.max(maxX, node.x);
          maxY = Math.max(maxY, node.y);
        });
      } else {
        const w = (asset.width || 0) * (asset.scale || 1);
        const h = (asset.height || 0) * (asset.scale || 1);
        minX = Math.min(minX, asset.x - w / 2);
        minY = Math.min(minY, asset.y - h / 2);
        maxX = Math.max(maxX, asset.x + w / 2);
        maxY = Math.max(maxY, asset.y + h / 2);
      }
    });

    if (!isFinite(minX)) return null;

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
    };
  };

  const bounds = getSelectedBounds();
  const hasSelection = hasAnySelection && bounds;

  const addExportOption = () => {
    setExportOptions([
      ...exportOptions,
      { id: Date.now().toString(), paperSize: "A4", format: "png" },
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

  const handleExport = async (option: ExportOption) => {
    if (!hasSelection || !bounds) {
      alert("Please select assets on the canvas to export.");
      return;
    }

    try {
      // Get all selected asset IDs
      const allSelectedIds = selectedAssetIds.length > 0 
        ? selectedAssetIds 
        : selectedAssetId 
          ? [selectedAssetId] 
          : [];

      if (allSelectedIds.length === 0) {
        alert("Please select assets on the canvas to export.");
        return;
      }

      // Get selected assets from store
      const selectedAssets = assets.filter(a => allSelectedIds.includes(a.id));
      
      if (selectedAssets.length === 0) {
        alert("Selected assets not found.");
        return;
      }

      const mmToPx = 2; // Match your MM_TO_PX constant
      const dpi = 96;
      const mmToInch = 0.0393701;
      const pixelsPerMm = dpi * mmToInch;

      // Create a canvas to render the selected assets
      // Use bounds to determine canvas size, with padding
      const padding = 50; // pixels
      const canvasWidth = (bounds.width * mmToPx) + (padding * 2);
      const canvasHeight = (bounds.height * mmToPx) + (padding * 2);
      
      // Create canvas at high resolution for export
      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = canvasWidth * 2; // 2x scale for quality
      exportCanvas.height = canvasHeight * 2;
      const ctx = exportCanvas.getContext("2d");
      if (!ctx) return;

      // Fill with white background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

      // Calculate offset to center assets in the export canvas
      const offsetX = padding * 2 - (bounds.minX * mmToPx * 2);
      const offsetY = padding * 2 - (bounds.minY * mmToPx * 2);

      // Render each selected asset
      // First, load all custom asset images
      const imagePromises = selectedAssets.map(async (asset) => {
        const def = ASSET_LIBRARY.find((a) => a.id === asset.type);
        const assetPath = def?.isCustom && def?.path ? def.path : null;
        if (assetPath) {
          return new Promise<{ asset: typeof asset; img: HTMLImageElement | null }>((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => resolve({ asset, img });
            img.onerror = () => resolve({ asset, img: null });
            img.src = assetPath;
          });
        }
        return { asset, img: null };
      });

      const assetsWithImages = await Promise.all(imagePromises);

      // Render each asset
      assetsWithImages.forEach(({ asset, img }) => {
        ctx.save();
        
        // Calculate position relative to bounds
        const assetX = (asset.x * mmToPx * 2) + offsetX;
        const assetY = (asset.y * mmToPx * 2) + offsetY;
        const assetWidth = (asset.width || 50) * (asset.scale || 1) * mmToPx * 2;
        const assetHeight = (asset.height || 50) * (asset.scale || 1) * mmToPx * 2;
        const rotation = asset.rotation || 0;

        // Move to asset center and rotate
        ctx.translate(assetX, assetY);
        ctx.rotate((rotation * Math.PI) / 180);

        // Render based on asset type
        if (asset.type === "square" || asset.type === "circle") {
          ctx.fillStyle = asset.fillColor || "#000000";
          ctx.strokeStyle = asset.strokeColor || "#000000";
          ctx.lineWidth = (asset.strokeWidth || 2) * 2;
          
          if (asset.type === "circle") {
            ctx.beginPath();
            ctx.arc(0, 0, assetWidth / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          } else {
            ctx.fillRect(-assetWidth / 2, -assetHeight / 2, assetWidth, assetHeight);
            ctx.strokeRect(-assetWidth / 2, -assetHeight / 2, assetWidth, assetHeight);
          }
        } else if (asset.type === "line") {
          ctx.strokeStyle = asset.strokeColor || "#000000";
          ctx.lineWidth = (asset.strokeWidth || 2) * (asset.scale || 1) * 2;
          ctx.beginPath();
          ctx.moveTo(-assetWidth / 2, 0);
          ctx.lineTo(assetWidth / 2, 0);
          ctx.stroke();
        } else if (asset.type === "text") {
          ctx.fillStyle = asset.textColor || "#000000";
          ctx.font = `${(asset.fontSize || 16) * 2}px ${asset.fontFamily || "Arial"}`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(asset.text || "Text", 0, 0);
        } else if (asset.type === "wall-segments" && asset.wallNodes) {
          // Render wall segments
          ctx.strokeStyle = asset.strokeColor || "#000000";
          ctx.lineWidth = (asset.strokeWidth || 2) * 2;
          ctx.beginPath();
          asset.wallNodes.forEach((node, index) => {
            const nodeX = (node.x - asset.x) * mmToPx * 2;
            const nodeY = (node.y - asset.y) * mmToPx * 2;
            if (index === 0) {
              ctx.moveTo(nodeX, nodeY);
            } else {
              ctx.lineTo(nodeX, nodeY);
            }
          });
          ctx.stroke();
        } else if (img) {
          // For custom SVG assets, draw the loaded image
          ctx.drawImage(img, -assetWidth / 2, -assetHeight / 2, assetWidth, assetHeight);
        } else {
          // Fallback: render a placeholder rectangle if image failed to load
          ctx.fillStyle = asset.fillColor || "#cccccc";
          ctx.strokeStyle = asset.strokeColor || "#000000";
          ctx.lineWidth = 2;
          ctx.fillRect(-assetWidth / 2, -assetHeight / 2, assetWidth, assetHeight);
          ctx.strokeRect(-assetWidth / 2, -assetHeight / 2, assetWidth, assetHeight);
        }

        ctx.restore();
      });

      // The export canvas now contains the rendered assets
      const croppedCanvas = exportCanvas;
      const cropWidth = croppedCanvas.width;
      const cropHeight = croppedCanvas.height;

      // Scale to paper size
      const paperSizeInfo = PAPER_SIZES[option.paperSize];
      const finalCanvas = document.createElement("canvas");
      const finalCtx = finalCanvas.getContext("2d");
      if (!finalCtx) return;

      // Scale to fit paper size (use padded dimensions for scaling)
      const paperScaleX = (paperSizeInfo.width * pixelsPerMm) / cropWidth;
      const paperScaleY = (paperSizeInfo.height * pixelsPerMm) / cropHeight;
      const finalScale = Math.min(paperScaleX, paperScaleY);

      finalCanvas.width = paperSizeInfo.width * pixelsPerMm;
      finalCanvas.height = paperSizeInfo.height * pixelsPerMm;

      finalCtx.fillStyle = "#ffffff";
      finalCtx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

      const scaledWidth = cropWidth * finalScale;
      const scaledHeight = cropHeight * finalScale;
      const centerX = (finalCanvas.width - scaledWidth) / 2;
      const centerY = (finalCanvas.height - scaledHeight) / 2;

      finalCtx.drawImage(croppedCanvas, centerX, centerY, scaledWidth, scaledHeight);

      // Export
      const fileName = `export-${Date.now()}.${option.format}`;

      if (option.format === "pdf") {
        const pdf = new jsPDF({
          orientation: paperSizeInfo.width > paperSizeInfo.height ? "landscape" : "portrait",
          unit: "mm",
          format: option.paperSize.toLowerCase(),
        });
        const imgData = finalCanvas.toDataURL("image/png", 1.0);
        pdf.addImage(imgData, "PNG", 0, 0, paperSizeInfo.width, paperSizeInfo.height);
        pdf.save(fileName);
      } else {
        const mimeType = option.format === "png" ? "image/png" : "image/jpeg";
        finalCanvas.toBlob(
          (blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = fileName;
              a.click();
              URL.revokeObjectURL(url);
            }
          },
          mimeType,
          option.format === "jpeg" ? 0.95 : 1.0
        );
      }
    } catch (error) {
      console.error("Export error:", error);
      alert("Export failed. Please try again.");
    }
  };

  return (
    <div className="border-t border-gray-200 pt-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Export</h3>
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
                    {size}
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
              disabled={!hasSelection}
              className={`w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded transition-colors ${
                hasSelection
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
              }`}
            >
              <Download className="w-3 h-3" />
              Export {option.format.toUpperCase()}
            </button>
          </div>
        ))}
        
        {/* Add export option button */}
        <button
          onClick={addExportOption}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 border-2 border-dashed border-gray-300 rounded-lg text-xs text-gray-600 hover:border-gray-400 hover:bg-gray-50 transition-colors"
        >
          <Plus className="w-3 h-3" />
          Add Export Option
        </button>
      </div>

      {hasSelection ? (
        <div className="mt-2 text-xs text-gray-500">
          Selected: {bounds.width.toFixed(0)} × {bounds.height.toFixed(0)} mm
        </div>
      ) : (
        <div className="mt-2 text-xs text-gray-400 italic">
          Select assets on the canvas to export
        </div>
      )}
        </>
      )}
    </div>
  );
}

