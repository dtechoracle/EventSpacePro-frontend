"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

type PaperSize = "A1" | "A2" | "A3" | "A4" | "A5";
type ExportFormat = "pdf" | "png" | "jpeg";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  exportArea: { startX: number; startY: number; endX: number; endY: number } | null;
  onExport: (paperSize: PaperSize, format: ExportFormat) => void;
}

const PAPER_SIZES: Record<PaperSize, { width: number; height: number; label: string }> = {
  A1: { width: 594, height: 841, label: "A1 (594 × 841 mm)" },
  A2: { width: 420, height: 594, label: "A2 (420 × 594 mm)" },
  A3: { width: 297, height: 420, label: "A3 (297 × 420 mm)" },
  A4: { width: 210, height: 297, label: "A4 (210 × 297 mm)" },
  A5: { width: 148, height: 210, label: "A5 (148 × 210 mm)" },
};

export default function ExportModal({ isOpen, onClose, exportArea, onExport }: ExportModalProps) {
  const [selectedPaperSize, setSelectedPaperSize] = useState<PaperSize>("A4");
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("pdf");

  if (!isOpen || !exportArea) return null;

  const handleExport = () => {
    onExport(selectedPaperSize, selectedFormat);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[10000]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl z-[10001] w-[85vw] max-w-sm p-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Export Selection</h2>
              <button
                onClick={onClose}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Paper Size Selection */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  Paper Size
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {Object.entries(PAPER_SIZES).map(([size, info]) => (
                    <button
                      key={size}
                      onClick={() => setSelectedPaperSize(size as PaperSize)}
                      className={`p-2 rounded border-2 transition-all text-xs ${
                        selectedPaperSize === size
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-gray-200 hover:border-gray-300 text-gray-700"
                      }`}
                    >
                      <div className="font-semibold text-xs">{size}</div>
                      <div className="text-[10px] text-gray-500 mt-0.5">{info.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Format Selection */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  Format
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["pdf", "png", "jpeg"] as ExportFormat[]).map((format) => (
                    <button
                      key={format}
                      onClick={() => setSelectedFormat(format)}
                      className={`p-2 rounded border-2 transition-all uppercase text-xs ${
                        selectedFormat === format
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-gray-200 hover:border-gray-300 text-gray-700"
                      }`}
                    >
                      {format}
                    </button>
                  ))}
                </div>
              </div>

              {/* Export Area Info */}
              <div className="bg-gray-50 rounded p-2.5">
                <div className="text-xs text-gray-600">
                  <div className="font-medium mb-0.5">Selected Area:</div>
                  <div>
                    {Math.abs(exportArea.endX - exportArea.startX).toFixed(0)} ×{" "}
                    {Math.abs(exportArea.endY - exportArea.startY).toFixed(0)} mm
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={onClose}
                  className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExport}
                  className="flex-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Export
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

