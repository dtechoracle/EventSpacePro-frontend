"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

export type PageData = {
  pageIndex: number;
  dataUrl: string;
  width: number;
  height: number;
};

export type PdfPagePickerProps = {
  arrayBuffer: ArrayBuffer;
  onImport: (pages: PageData[]) => void;
  onCancel: () => void;
};

const RENDER_SCALE = 0.3;

const PdfPagePicker = ({ arrayBuffer, onImport, onCancel }: PdfPagePickerProps) => {
  const [pages, setPages] = useState<{ index: number; selected: boolean; thumbnail: string; width: number; height: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    const loadPdf = async () => {
      try {
        const pdfjsLib = await loadPdfJs();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        if (cancelled) return;
        const pageData: typeof pages = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: RENDER_SCALE });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            await page.render({ canvasContext: ctx, viewport }).promise;
            pageData.push({
              index: i,
              selected: true,
              thumbnail: canvas.toDataURL("image/jpeg", 0.5),
              width: viewport.width,
              height: viewport.height,
            });
          }
        }
        if (!cancelled) setPages(pageData);
      } catch (err) {
        console.error("PDF load error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadPdf();
    return () => { cancelled = true; };
  }, [arrayBuffer]);

  const togglePage = useCallback((index: number) => {
    setPages(prev => prev.map(p => p.index === index ? { ...p, selected: !p.selected } : p));
  }, []);

  const selectAll = useCallback(() => {
    setPages(prev => prev.map(p => ({ ...p, selected: true })));
  }, []);

  const deselectAll = useCallback(() => {
    setPages(prev => prev.map(p => ({ ...p, selected: false })));
  }, []);

  const handleImport = useCallback(async () => {
    const selected = pages.filter(p => p.selected);
    if (selected.length === 0) return;

    const pdfjsLib = (window as any).pdfjsLib;
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const results: PageData[] = [];
    for (const s of selected) {
      const page = await pdf.getPage(s.index);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        await page.render({ canvasContext: ctx, viewport }).promise;
        const dataUrl = await compressImage(canvas.toDataURL("image/jpeg", 0.7), 1200, 1200);
        results.push({ pageIndex: s.index, dataUrl, width: canvas.width, height: canvas.height });
      }
    }
    onImport(results);
  }, [pages, arrayBuffer, onImport]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[9999]"
        onClick={onCancel}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 30 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="bg-[#FDFDFF] w-[42rem] max-h-[80vh] rounded-[2.25rem] p-[2rem] flex flex-col gap-4"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="text-[1.5rem] font-semibold text-[#272235]">Select Pages to Import</h2>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400 text-sm">Loading pages...</div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <button onClick={selectAll} className="text-xs px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700">Select All</button>
                <button onClick={deselectAll} className="text-xs px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700">Deselect All</button>
                <span className="text-xs text-gray-400 ml-2">{pages.filter(p => p.selected).length} of {pages.length} selected</span>
              </div>
              <div className="grid grid-cols-3 gap-3 max-h-[50vh] overflow-y-auto pr-1">
                {pages.map(p => (
                  <button
                    key={p.index}
                    onClick={() => togglePage(p.index)}
                    className={`relative flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all ${
                      p.selected ? "border-blue-500 bg-blue-50/50" : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <img src={p.thumbnail} alt={`Page ${p.index}`} className="w-full rounded-lg shadow-sm" />
                    <span className="text-[11px] text-gray-500 font-medium">Page {p.index}</span>
                    {p.selected && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] font-bold shadow">✓</div>
                    )}
                  </button>
                ))}
              </div>
              <button
                onClick={handleImport}
                disabled={pages.filter(p => p.selected).length === 0}
                className="w-full h-12 rounded-2xl text-white text-base font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Import {pages.filter(p => p.selected).length > 0 ? `(${pages.filter(p => p.selected).length} page${pages.filter(p => p.selected).length > 1 ? 's' : ''})` : ''}
              </button>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export async function loadPdfJs(): Promise<any> {
  if ((window as any).pdfjsLib) return (window as any).pdfjsLib;
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js";
    script.onload = () => {
      const pdfjsLib = (window as any).pdfjsLib;
      pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js";
      resolve(pdfjsLib);
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function compressImage(dataUrl: string, maxW = 1200, maxH = 1200): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width;
      let h = img.height;
      if (w > maxW || h > maxH) {
        const ratio = Math.min(maxW / w, maxH / h);
        w = w * ratio;
        h = h * ratio;
      }
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d");
      ctx?.drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL("image/jpeg", 0.7));
    };
    img.src = dataUrl;
  });
}

export default PdfPagePicker;
