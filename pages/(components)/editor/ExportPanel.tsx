"use client";

import React, { useState, useMemo, useEffect } from "react";
import { FaDownload, FaExpand, FaTimes, FaPlus, FaUserCircle, FaCheckCircle, FaExclamationCircle } from "react-icons/fa";
import { Download, Plus, X, Upload } from "lucide-react";
import { useProjectStore } from "@/store/projectStore";
import { useEditorStore } from "@/store/editorStore";
import { useSceneStore, AssetInstance } from "@/store/sceneStore";
import { ASSET_LIBRARY } from "@/lib/assets";
import { PAPER_SIZES, PaperSize } from "@/lib/paperSizes";
import jsPDF from "jspdf";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { getDimensionsForWall, getDimensionsForObject, renderDimensionToCanvas } from "@/utils/dimensionUtils";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/router";
import { apiRequest } from "@/helpers/Config";
import { canRenderAssetOnCanvas } from "@/utils/assetRenderMode";

type ExportFormat = "pdf" | "png" | "jpg" | "jpeg";

const svgCache: Record<string, string> = {};
const typeIconCache: Record<string, HTMLImageElement> = {};
const assetTypesWithSvgPaths = new Set(
  ASSET_LIBRARY
    .filter(item => !!item.path)
    .flatMap(item => [item.id, item.name].filter(Boolean) as string[])
);

const EXPORT_DPI = 300; 

type ExportBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

const expandBoundsWithPoint = (bounds: ExportBounds, x: number, y: number, pad = 0) => {
  bounds.minX = Math.min(bounds.minX, x - pad);
  bounds.minY = Math.min(bounds.minY, y - pad);
  bounds.maxX = Math.max(bounds.maxX, x + pad);
  bounds.maxY = Math.max(bounds.maxY, y + pad);
};

const isVisibleFillColor = (fill: string | undefined | null) => {
  if (!fill) return false;
  const normalized = fill.trim().toLowerCase();
  return normalized !== 'transparent' && normalized !== 'none' && normalized !== 'rgba(0,0,0,0)' && normalized !== 'rgba(0, 0, 0, 0)';
};

const expandBoundsWithDimension = (bounds: ExportBounds, dim: any, viewportZoom = 1) => {
  const startPoint = dim.startPoint;
  const endPoint = dim.endPoint;
  if (!startPoint || !endPoint) return;

  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.y - startPoint.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return;

  const px = -dy / length;
  const py = dx / length;
  const offset = dim.offset ?? 400;
  let sign = Math.sign(offset || 1) || 1;
  if (dim.labelPosition === 'top-right') sign = -1;
  if (dim.labelPosition === 'bottom-left') sign = 1;
  const finalOffset = dim.labelPosition ? Math.abs(offset) * sign : offset;

  const p1 = { x: startPoint.x + px * finalOffset, y: startPoint.y + py * finalOffset };
  const p2 = { x: endPoint.x + px * finalOffset, y: endPoint.y + py * finalOffset };
  const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

  const safeZoom = Math.max(0.02, Math.min(viewportZoom || 1, 4));
  const fixedScreenLabelPad = ((dim.fontSize || 12) * 12) / safeZoom;
  const labelPad = Math.max(1800, Math.min(3600, fixedScreenLabelPad));
  const dimensionLinePad = Math.max(260, labelPad * 0.1);
  [startPoint, endPoint, p1, p2].forEach((point) => expandBoundsWithPoint(bounds, point.x, point.y, dimensionLinePad));
  expandBoundsWithPoint(bounds, mid.x, mid.y, labelPad);
};

interface ExportOption {
  id: string;
  paperSize: PaperSize;
  format: ExportFormat;
  exportSelection: boolean;
  isProfessional: boolean;
}

interface ProfessionalDetails {
  eventName: string;
  venue: string;
  client?: string;
  date?: string;
  eventPlanner?: string;
  sittingCode: string;
  guestAllocation: string;
  logo: string | null;
  byLogo: string | null; // Added for branding
  panelPosition: 'left' | 'right';
  panelColor?: string;
}

const formatDateForDisplay = (value?: string) => {
  if (!value) return "";
  const trimmed = value.trim();

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  }

  const displayMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (displayMatch) {
    return trimmed;
  }

  return trimmed;
};

const normalizeDateInput = (value: string) => {
  const trimmed = value.trim();
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  }

  const digitsOnly = trimmed.replace(/\D/g, "").slice(0, 8);
  if (digitsOnly.length <= 2) return digitsOnly;
  if (digitsOnly.length <= 4) return `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(2)}`;
  return `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(2, 4)}/${digitsOnly.slice(4)}`;
};

/**
 * Robustly loads SVGs for export, applying real-time color/stroke overrides
 */
const loadSvgAssets = async (assets: AssetInstance[]) => {
  const loadedImages = new Map<string, HTMLImageElement>();
  
  await Promise.all(assets.map(async (asset) => {
    const isShape = ['circle', 'rect', 'ellipse', 'line', 'polyline', 'square', 'rectangle', 'arc'].includes(asset.type);
    const isWall = asset.type === 'wall-segments';
    const isFreehand = asset.type === 'freehand';
    if (isShape || isWall || isFreehand) return;

    const definition = ASSET_LIBRARY.find(item => item.id === asset.type || item.name === asset.type);
    if (!definition) {
      console.warn(`Definition not found for type: ${asset.type}`);
      return;
    }

    try {
      let svg = svgCache[definition.path];
      if (!svg) {
        // Encode URI to handle spaces in filenames correctly
        const encodedPath = encodeURI(definition.path);
        const res = await fetch(encodedPath);
        if (res.ok) {
          svg = await res.text();
          svgCache[definition.path] = svg;
        }
      }

      if (!svg) return;

      let processedSvg = svg;
      const fill = asset.fillColor || 'transparent';
      const stroke = asset.strokeColor || '#000000';
      const exportStrokeWidth = asset.strokeWidth !== undefined ? asset.strokeWidth : 0.5;

      // ROBUST DOM-BASED PROCESSING (Matches AssetRenderer.tsx logic)
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(processedSvg, "image/svg+xml");
        const svgEl = doc.querySelector("svg");
        
        if (svgEl) {
          // Remove natural dimensions to let us control scaling
          svgEl.removeAttribute("width");
          svgEl.removeAttribute("height");
          svgEl.setAttribute("preserveAspectRatio", "xMidYMid meet");
          // Ensure it has a coordinate system we can reliably draw into
          if (!svgEl.getAttribute("viewBox")) {
             svgEl.setAttribute("width", "2000");
             svgEl.setAttribute("height", "2000");
          }

          const styleId = "dynamic-asset-style-export";
          if (!doc.getElementById(styleId)) {
            const styleEl = doc.createElementNS("http://www.w3.org/2000/svg", "style");
            styleEl.setAttribute("id", styleId);
            styleEl.textContent = `* { vector-effect: non-scaling-stroke !important; } .fill-none-el { fill: none !important; } .fill-inherit-el { fill: inherit !important; stroke: inherit !important; stroke-width: inherit !important; } .stroke-top-layer { pointer-events: none; }`;
            svgEl.prepend(styleEl);
          }

          const children = Array.from(doc.querySelectorAll('path, circle, rect, line, polyline, ellipse'));
          const circles = Array.from(doc.querySelectorAll('circle'));
          const innerCircles = new Set<Element>();

          if (circles.length > 1) {
            const sorted = [...circles].sort((a, b) => parseFloat(a.getAttribute("r") || "0") - parseFloat(b.getAttribute("r") || "0"));
            for (let i = 0; i < sorted.length - 1; i++) {
              innerCircles.add(sorted[i]);
            }
          }

          const category = (definition as any).category || "";
          const catLower = category.toLowerCase();
          const isFurniture = catLower === 'furniture' || catLower === 'structure' || catLower === 'furniture asset' || asset.type.includes('chair') || asset.type.includes('table');

          children.forEach(el => {
            const tag = el.tagName.toLowerCase();
            const dAttr = el.getAttribute("d") || "";
            const fillAttr = el.getAttribute("fill");
            const styleAttr = el.getAttribute("style");

            const wasExplicitlyNone = fillAttr === 'none' || (styleAttr && /fill\s*:\s*none/i.test(styleAttr));
            const isLineElement = tag === 'line' || tag === 'polyline';
            const hasFillRule = el.hasAttribute("fill-rule") || (styleAttr && /fill-rule/i.test(styleAttr));

            const dClean = dAttr.trim();
            const isZClosed = dClean.toLowerCase().includes('z');
            let isCoordClosed = false;
            if (!isZClosed && dClean.startsWith('M')) {
              const firstMatch = dClean.match(/^M\s*(-?[\d.]+)\s*[, \s]\s*(-?[\d.]+)/i);
              const lastMatch = dClean.match(/(-?[\d.]+)\s*[, \s]\s*(-?[\d.]+)\s*$/);
              if (firstMatch && lastMatch) {
                const startX = parseFloat(firstMatch[1]);
                const startY = parseFloat(firstMatch[2]);
                const endX = parseFloat(lastMatch[1]);
                const endY = parseFloat(lastMatch[2]);
                isCoordClosed = Math.abs(startX - endX) < 1.0 && Math.abs(startY - endY) < 1.0;
              }
            }
            const isClosed = isZClosed || isCoordClosed;
            const isOpenPath = tag === 'path' && !isClosed;
            const isAutoFill = el.getAttribute("id") === "auto-fill";

            if (styleAttr) {
              const cleaned = styleAttr
                .replace(/fill\s*:[^;]+;?/gi, "")
                .replace(/stroke\s*:[^;]+;?/gi, "")
                .replace(/stroke-width\s*:[^;]+;?/gi, "");
              if (cleaned.trim()) el.setAttribute("style", cleaned);
              else el.removeAttribute("style");
            }

            el.removeAttribute("fill");
            el.removeAttribute("stroke");
            el.removeAttribute("stroke-width");

            let shouldBeNone = wasExplicitlyNone || isLineElement;
            if (!isFurniture) {
              const isConsentricOuter = tag === 'circle' && circles.length > 1 && !innerCircles.has(el);
              if (isOpenPath || isConsentricOuter) {
                shouldBeNone = true;
              }
            }

            if (shouldBeNone && !hasFillRule && !isAutoFill) {
              el.classList.add("fill-none-el");
            } else {
              el.classList.add("fill-inherit-el");
            }
          });

          const rootGroup = svgEl.querySelector('g');
          if (rootGroup) {
            const strokeOnlyEls = Array.from(rootGroup.querySelectorAll('.fill-none-el'));
            if (strokeOnlyEls.length > 0) {
              const topLayer = doc.createElementNS("http://www.w3.org/2000/svg", "g");
              topLayer.setAttribute("class", "stroke-top-layer");
              strokeOnlyEls.forEach(el => topLayer.appendChild(el));
              rootGroup.appendChild(topLayer);
            }
          }

          processedSvg = new XMLSerializer().serializeToString(doc).replace(/<svg([^>]*)>/i, (_match, attrs) => {
            const cleanAttrs = attrs
              .replace(/\s+width\s*=\s*["'][^"']*["']/gi, '')
              .replace(/\s+height\s*=\s*["'][^"']*["']/gi, '')
              .replace(/\s+x\s*=\s*["'][^"']*["']/gi, '')
              .replace(/\s+y\s*=\s*["'][^"']*["']/gi, '')
              .replace(/\s+fill\s*=\s*["'][^"']*["']/gi, '')
              .replace(/\s+stroke\s*=\s*["'][^"']*["']/gi, '');

            return `<svg${cleanAttrs} fill="${fill}" stroke="${stroke}" stroke-width="${exportStrokeWidth}" preserveAspectRatio="xMidYMid meet">`;
          });
        }
      } catch (err) {
        console.error("DOM Processing failed, falling back to basic replace", err);
      }

      const blob = new Blob([processedSvg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      
      const isOk = await new Promise((resolve) => {
        const timeout = setTimeout(() => resolve(false), 5000);
        img.onload = () => { clearTimeout(timeout); resolve(img.naturalWidth > 0 || img.width > 0); };
        img.onerror = () => { clearTimeout(timeout); resolve(false); };
        img.src = url; // MUST be set after onload wrapper
      });

      if (isOk) {
        loadedImages.set(asset.id, img);
        if (!typeIconCache[asset.type]) typeIconCache[asset.type] = img;
      } else {
         console.warn(`Failed to process image for asset: ${asset.id} (${asset.type})`);
      }
    } catch (err) {
      console.error(`Asset load error: ${asset.type}`, err);
    }
  }));

  return loadedImages;
};

export default function ExportPanel() {
  const { 
    shapes, assets, walls, textAnnotations, labelArrows, dimensions, projectName,
    globalTableNumberingPosition, globalTableNumberingOrientation,
    globalTableNumberingFontSize, globalTableNumberingFontFamily,
    globalTableNumberingFontWeight, globalTableNumberingFontStyle,
    globalTableNumberingTextDecoration, globalTableNumberingColor
  } = useProjectStore();
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const zoom = useEditorStore((s) => s.zoom);
  const panX = useEditorStore((s) => s.panX);
  const panY = useEditorStore((s) => s.panY);
  const [exportOptions, setExportOptions] = useState<ExportOption[]>([
    { id: "1", paperSize: "A4", format: "pdf", exportSelection: false, isProfessional: true },
  ]);
  
  const [showProfessionalModal, setShowProfessionalModal] = useState(false);
  const [currentOption, setCurrentOption] = useState<ExportOption | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const router = useRouter();
  const { slug } = router.query;

  const { data: projectData } = useQuery({
    queryKey: ["project-data", slug],
    queryFn: async () => {
      if (!slug) return null;
      try {
        const res = await apiRequest(`/projects/${slug}`, "GET", null, true).catch(async () => {
          const allRes = await apiRequest("/projects", "GET", null, true);
          return allRes.data.find((p: any) => p.slug === slug);
        });
        return res.data || res;
      } catch (err) {
        console.error("Failed to fetch project for export:", err);
        return null;
      }
    },
    enabled: !!slug,
  });

  const { setProjectName } = useProjectStore();

  useEffect(() => {
    if (projectData?.name) {
      setProjectName(projectData.name);
      setProfDetails(prev => ({ ...prev, eventName: projectData.name }));
    }
  }, [projectData?.name, setProjectName]);

  const [profDetails, setProfDetails] = useState<ProfessionalDetails>({
    eventName: projectName || "",
    venue: "",
    eventPlanner: "",
    sittingCode: "",
    guestAllocation: "",
    logo: null,
    byLogo: null,
    panelPosition: 'right',
    panelColor: '#0056A9' // Firm Brand Blue default
  });

  useEffect(() => {
    if (projectName && !profDetails.eventName) {
      setProfDetails(prev => ({ ...prev, eventName: projectName }));
    }
  }, [projectName]);

  const hasSelection = selectedIds.length > 0;

  const allItems: AssetInstance[] = useMemo(() => {
    const items: any[] = [
      ...shapes.map(s => ({
        ...s,
        id: s.id,
        type: s.type === 'ellipse' ? 'circle' : (s as any).type, 
        backgroundColor: (s as any).fill || (s as any).fillColor || (s as any).backgroundColor || 'transparent',
        strokeColor: (s as any).stroke || (s as any).strokeColor || '#000000',
        strokeWidth: s.strokeWidth || 1,
        scale: 1,
        zIndex: s.zIndex || (s.type === 'rectangle' ? -1 : 0),
      })),
      ...walls.map(w => {
        const validEdges = w.edges.filter(e => w.nodes.find(n => n.id === e.nodeA) && w.nodes.find(n => n.id === e.nodeB));
        if (validEdges.length === 0) return null;
        return {
          id: w.id,
          type: 'wall-segments' as const,
          x: 0, y: 0, width: 0, height: 0, scale: 1, rotation: 0,
          wallNodes: w.nodes,
          wallEdges: validEdges.map(e => ({ id: e.id, a: w.nodes.findIndex(n => n.id === e.nodeA), b: w.nodes.findIndex(n => n.id === e.nodeB) })),
          lineColor: w.stroke || '#000000',
          wallThickness: validEdges[0]?.thickness || 150,
          backgroundColor: w.fill || '#f3f4f6',
          strokeColor: w.stroke || '#000000',
          strokeWidth: w.strokeWidth !== undefined ? w.strokeWidth : 2,
          zIndex: w.zIndex || 0,
          showDimensions: w.showDimensions,
          dimensionType: w.dimensionType,
          dimensionFontSize: w.dimensionFontSize,
          dimensionOffset: w.dimensionOffset,
          dimensionStrokeWidth: w.dimensionStrokeWidth,
          dimensionColor: w.dimensionColor,
          dimensionLabelPosition: (w as any).dimensionLabelPosition,
        };
      }).filter(Boolean),
      ...assets.map(a => ({ ...a })),
      ...textAnnotations.map(t => ({ ...t, type: 'text-annotation' })),
      ...labelArrows.map(la => ({ ...la, type: 'label-arrow' })),
      ...dimensions.map(d => ({ ...d, type: 'dimension' }))
    ];
    return items.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
  }, [shapes, assets, walls, textAnnotations, labelArrows, dimensions]);

  const loadWorkspaceSnapshot = async (
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
    paddingMm: number
  ) => {
    const workspaceSvg = document.querySelector('svg[data-workspace-root="true"]') as SVGSVGElement | null;
    if (!workspaceSvg) return null;

    const screenPadding = paddingMm * zoom;
    const screenMinX = minX * zoom + panX - screenPadding;
    const screenMinY = minY * zoom + panY - screenPadding;
    const screenWidth = Math.max(1, (maxX - minX + paddingMm * 2) * zoom);
    const screenHeight = Math.max(1, (maxY - minY + paddingMm * 2) * zoom);

    const clone = workspaceSvg.cloneNode(true) as SVGSVGElement;
    clone.querySelectorAll('.interaction-highlights, .snap-markers, .grid-layer, pattern[id^="grid-"], [data-export-ignore="true"]').forEach((node) => node.remove());
    clone.querySelectorAll('[data-canvas-backed-asset="true"]').forEach((node) => {
      (node as SVGElement).style.display = '';
      (node as SVGElement).removeAttribute('display');
    });
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', `${screenWidth}`);
    clone.setAttribute('height', `${screenHeight}`);
    clone.setAttribute('viewBox', `${screenMinX} ${screenMinY} ${screenWidth} ${screenHeight}`);
    clone.style.background = 'transparent';

    const serialized = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    try {
      const img = await new Promise<HTMLImageElement | null>((resolve) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => resolve(null);
        image.src = url;
      });
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  };

const renderAssetToCanvas = (
    ctx: CanvasRenderingContext2D,
    asset: AssetInstance,
    minX: number,
    minY: number,
    padding: number,
    contentShift: number,
    MM_TO_PX: number,
    loadedImages: Map<string, HTMLImageElement>,
    options?: {
      wallFillOnly?: boolean;
    }
  ) => {
    const worldX = asset.x - minX + padding + (contentShift / MM_TO_PX);
    const worldY = asset.y - minY + padding;
    const cx = worldX * MM_TO_PX;
    const cy = worldY * MM_TO_PX;
    const opacity = Math.max(0, Math.min(1, (asset as any).opacity ?? 1));

    ctx.save();
    ctx.globalAlpha = opacity;

    if (asset.type === 'wall-segments') {
      const strokeColor = asset.strokeColor || asset.lineColor || "#000000";
      const fillColor = asset.backgroundColor || 'transparent';
      const wallThickness = (asset.wallThickness || 150) * (asset.scale || 1);
      const wallFillOnly = options?.wallFillOnly === true;
      
      if (asset.wallNodes && asset.wallEdges) {
        asset.wallEdges.forEach(edge => {
          const a = asset.wallNodes![edge.a];
          const b = asset.wallNodes![edge.b];
          if (!a || !b) return;
          const dx = b.x - a.x; const dy = b.y - a.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len === 0) return;
          const nx = (-dy / len) * (wallThickness / 2);
          const ny = (dx / len) * (wallThickness / 2);

          const pts = [
            { x: a.x + nx, y: a.y + ny }, { x: b.x + nx, y: b.y + ny },
            { x: b.x - nx, y: b.y - ny }, { x: a.x - nx, y: a.y - ny }
          ].map(p => ({
            x: (p.x - minX + padding + (contentShift / MM_TO_PX)) * MM_TO_PX,
            y: (p.y - minY + padding) * MM_TO_PX
          }));

          ctx.fillStyle = fillColor;
          ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); pts.forEach(p => ctx.lineTo(p.x, p.y)); ctx.closePath();
          if (isVisibleFillColor(fillColor)) ctx.fill();
          if (!wallFillOnly) {
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = (asset.strokeWidth !== undefined ? asset.strokeWidth : 2) * MM_TO_PX;
            ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(pts[1].x, pts[1].y); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(pts[2].x, pts[2].y); ctx.lineTo(pts[3].x, pts[3].y); ctx.stroke();
          }
        });
      }
    } else if (asset.type === 'freehand') {
      const points = (asset as any).points;
      if (points?.length > 1) {
        ctx.strokeStyle = asset.strokeColor || "#000000";
        ctx.lineWidth = Math.max(0.5 * MM_TO_PX, (asset.strokeWidth || 1) * MM_TO_PX);
        ctx.beginPath();
        const startX = (points[0].x + asset.x - minX + padding + (contentShift / MM_TO_PX)) * MM_TO_PX;
        const startY = (points[0].y + asset.y - minY + padding) * MM_TO_PX;
        ctx.moveTo(startX, startY);
        points.forEach((p: any) => ctx.lineTo((p.x + asset.x - minX + padding + (contentShift / MM_TO_PX)) * MM_TO_PX, (p.y + asset.y - minY + padding) * MM_TO_PX));
        ctx.stroke();
      }
    } else if (asset.type === 'dimension') {
      renderDimensionToCanvas(ctx, asset as any, minX - padding - (contentShift / MM_TO_PX), minY - padding, 0, MM_TO_PX);
    } else if (asset.type === 'text-annotation') {
      const fs = ((asset as any).fontSize || 16) * MM_TO_PX;
      ctx.font = `bold ${Math.round(fs)}px Inter, sans-serif`;
      ctx.fillStyle = (asset as any).color || '#000000';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText((asset as any).text || "", cx, cy);
    } else if (asset.type === 'label-arrow') {
      const la = asset as any;
      const startX = (la.startPoint.x - minX + padding + (contentShift / MM_TO_PX)) * MM_TO_PX;
      const startY = (la.startPoint.y - minY + padding) * MM_TO_PX;
      const endX = (la.endPoint.x - minX + padding + (contentShift / MM_TO_PX)) * MM_TO_PX;
      const endY = (la.endPoint.y - minY + padding) * MM_TO_PX;
      const dx = endX - startX;
      const dy = endY - startY;
      const len = Math.hypot(dx, dy);
      if (len === 0) return;
      const ux = dx / len;
      const uy = dy / len;
      const px = -uy;
      const py = ux;
      const color = la.color || "#000000";
      const stroke = Math.max(1, la.strokeWidth || 3) * MM_TO_PX;
      const markerSize = Math.max(14 * MM_TO_PX, stroke * 5);

      const drawMarker = (type: string, x: number, y: number, dirX: number, dirY: number) => {
        if (!type || type === 'none') return;
        const mpX = -dirY;
        const mpY = dirX;
        const baseX = x - dirX * markerSize;
        const baseY = y - dirY * markerSize;
        const side = markerSize * 0.48;

        ctx.save();
        ctx.strokeStyle = color;
        ctx.fillStyle = type === 'filled-triangle' ? color : '#ffffff';
        ctx.lineWidth = stroke;
        ctx.lineJoin = 'round';

        if (type === 'triangle' || type === 'filled-triangle') {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(baseX + mpX * side, baseY + mpY * side);
          ctx.lineTo(baseX - mpX * side, baseY - mpY * side);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else if (type === 'open') {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(baseX + mpX * side, baseY + mpY * side);
          ctx.moveTo(x, y);
          ctx.lineTo(baseX - mpX * side, baseY - mpY * side);
          ctx.stroke();
        } else if (type === 'circle') {
          ctx.beginPath();
          ctx.arc(x, y, markerSize * 0.36, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else if (type === 'square') {
          const size = markerSize * 0.72;
          ctx.translate(x, y);
          ctx.rotate(Math.atan2(dirY, dirX));
          ctx.fillRect(-size / 2, -size / 2, size, size);
          ctx.strokeRect(-size / 2, -size / 2, size, size);
        } else if (type === 'diamond') {
          const backX = x - dirX * markerSize;
          const backY = y - dirY * markerSize;
          const centerX = x - dirX * markerSize * 0.5;
          const centerY = y - dirY * markerSize * 0.5;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(centerX + mpX * side, centerY + mpY * side);
          ctx.lineTo(backX, backY);
          ctx.lineTo(centerX - mpX * side, centerY - mpY * side);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.moveTo(x + mpX * markerSize * 0.5, y + mpY * markerSize * 0.5);
          ctx.lineTo(x - mpX * markerSize * 0.5, y - mpY * markerSize * 0.5);
          ctx.stroke();
        }
        ctx.restore();
      };
      
      ctx.strokeStyle = color;
      ctx.lineWidth = stroke;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(startX, startY); ctx.lineTo(endX, endY); ctx.stroke();
      drawMarker(la.arrowHeadType || 'filled-triangle', endX, endY, ux, uy);
      drawMarker(la.arrowTailType || 'none', startX, startY, -ux, -uy);

      if (la.label) {
        const fontSize = (la.fontSize || 16) * MM_TO_PX;
        const labelPosition = la.textPosition || 'bottom';
        const labelT = labelPosition === 'top' ? 0.86 : labelPosition === 'middle' ? 0.5 : 0.14;
        const labelX = startX + dx * labelT;
        const labelY = startY + dy * labelT;
        const textWidth = Math.max(34 * MM_TO_PX, la.label.length * fontSize * 0.62 + 16 * MM_TO_PX);
        const textHeight = fontSize * 1.65;
        let textAngle = Math.atan2(dy, dx);
        if (textAngle > Math.PI / 2 || textAngle < -Math.PI / 2) textAngle += Math.PI;

        ctx.save();
        ctx.translate(labelX, labelY);
        ctx.rotate(textAngle);
        ctx.fillStyle = la.backgroundColor || '#ffffff';
        ctx.globalAlpha = 0.96;
        ctx.fillRect(-textWidth / 2, -textHeight / 2, textWidth, textHeight);
        ctx.globalAlpha = 1;
        ctx.font = `${la.fontWeight || '700'} ${Math.round(fontSize)}px ${la.fontFamily || 'Inter, sans-serif'}`;
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(la.label, 0, 0);
        ctx.restore();
      }
    } else {
      const w = (asset.width || 0) * (asset.scale || 1);
      const h = (asset.height || 0) * (asset.scale || 1);
      ctx.translate(cx, cy);
      if (asset.rotation) ctx.rotate((asset.rotation * Math.PI) / 180);

      const img = loadedImages.get(asset.id);
      if (img && (img.naturalWidth > 0 || img.width > 0)) {
        ctx.drawImage(img, -w*MM_TO_PX/2, -h*MM_TO_PX/2, w*MM_TO_PX, h*MM_TO_PX);
      } else if (asset.type === 'text') {
        const fs = (asset.fontSize || 16) * MM_TO_PX;
        ctx.font = `${Math.round(fs)}px ${asset.fontFamily || 'Inter'}`;
        ctx.fillStyle = asset.textColor || '#000000';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(asset.text || "", 0, 0);
      } else {
        const fill = asset.backgroundColor || asset.fillColor || asset.fill || (asset.type.includes('table') ? '#f8fafc' : 'transparent');
        ctx.fillStyle = fill;
        ctx.strokeStyle = asset.strokeColor || '#000000';
        ctx.lineWidth = (asset.strokeWidth !== undefined ? asset.strokeWidth : 0.5) * MM_TO_PX;
        
        // Handle all primitive shapes (Circle, Ellipse, Rect, Rectangle, Square, Polygon)
        const typeLower = (asset.type || '').toLowerCase();
        const isPrimitive = ['circle', 'ellipse', 'rect', 'rectangle', 'square', 'polygon'].includes(typeLower) || asset.id.includes('shape');

        if (isPrimitive) {
          ctx.beginPath();
          if (typeLower === 'circle' || typeLower === 'ellipse') {
            ctx.ellipse(0, 0, Math.abs(w*MM_TO_PX/2), Math.abs(h*MM_TO_PX/2), 0, 0, Math.PI*2);
          } else if (typeLower === 'polygon' && (asset as any).points) {
            const pts = (asset as any).points;
            if (pts.length > 0) {
              ctx.moveTo(pts[0].x * MM_TO_PX, pts[0].y * MM_TO_PX);
              for (let i = 1; i < pts.length; i++) {
                ctx.lineTo(pts[i].x * MM_TO_PX, pts[i].y * MM_TO_PX);
              }
              ctx.closePath();
            }
          } else {
            // Rect / Rectangle / Square / Fallback
            ctx.rect(-w*MM_TO_PX/2, -h*MM_TO_PX/2, w*MM_TO_PX, h*MM_TO_PX);
          }
          
          if (fill !== 'transparent') ctx.fill(); 
          ctx.stroke();
        } else {
           // Fallback for missing furniture assets: use a visible structural outline
          ctx.strokeStyle = '#000000'; 
          ctx.lineWidth = 1 * MM_TO_PX;
          
          // Ensure we have a path to fill/stroke
          ctx.beginPath();
          ctx.rect(-w*MM_TO_PX/2, -h*MM_TO_PX/2, w*MM_TO_PX, h*MM_TO_PX);
          if (fill !== 'transparent') ctx.fill();
          ctx.stroke();
          
          // Cross-hatch ONLY for complex assets that definitely failed to load an image
          // and are not intended to be simple shapes.
          // ONLY draw cross-hatch for complex furniture assets that failed to load
          // NEVER draw for basic shapes (rect, square, circle, etc)
          const isBasicShape = typeLower === 'rect' || typeLower === 'rectangle' || typeLower === 'square' || typeLower === 'circle' || typeLower === 'ellipse' || typeLower === 'polygon' || asset.id.includes('shape');
          
          if (!isBasicShape) {
            ctx.beginPath();
            ctx.moveTo(-w*MM_TO_PX/2, -h*MM_TO_PX/2); ctx.lineTo(w*MM_TO_PX/2, h*MM_TO_PX/2);
            ctx.moveTo(w*MM_TO_PX/2, -h*MM_TO_PX/2); ctx.lineTo(-w*MM_TO_PX/2, h*MM_TO_PX/2);
            ctx.stroke();
          }
        }
      }

      // Add high-visibility Table Name (Numbering) Label if present
      if ((asset as any).tableName) {
        const label = (asset as any).tableName;
        const pos = (asset as any).tableNumberingPosition || globalTableNumberingPosition || 'center';
        const orientation = (asset as any).tableNumberingOrientation || globalTableNumberingOrientation || 'horizontal';
        
        ctx.save();
        
        // Base sizes
        const size = (asset as any).tableNumberingFontSize || globalTableNumberingFontSize || Math.max(14, (asset.width || 100) * 0.14);
        const labelFontFamily = (asset as any).tableNumberingFontFamily || globalTableNumberingFontFamily || 'Inter, sans-serif';
        const labelFontWeight = (asset as any).tableNumberingFontWeight || globalTableNumberingFontWeight || '900';
        const labelFontStyle = (asset as any).tableNumberingFontStyle || globalTableNumberingFontStyle || 'normal';
        const labelTextDecoration = (asset as any).tableNumberingTextDecoration || globalTableNumberingTextDecoration || 'none';
        const labelColor = (asset as any).tableNumberingColor || globalTableNumberingColor || '#000000';
        const circleR = Math.max(16, (asset.width || 100) * 0.12);
        
        // Calculate Offset based on position
        let offsetX = 0;
        let offsetY = 0;
        const padding = circleR * 1.5;
        const halfW = (asset.width || 100) / 2;
        const halfH = (asset.height || 100) / 2;
        
        switch (pos) {
          case 'top': offsetY = -halfH - padding; break;
          case 'bottom': offsetY = halfH + padding; break;
          case 'top-left': offsetX = -halfW; offsetY = -halfH - padding; break;
          case 'top-right': offsetX = halfW; offsetY = -halfH - padding; break;
          case 'bottom-left': offsetX = -halfW; offsetY = halfH + padding; break;
          case 'bottom-right': offsetX = halfW; offsetY = halfH + padding; break;
          case 'middle-left': offsetX = -halfW - padding; break;
          case 'middle-right': offsetX = halfW + padding; break;
          default: break; // center
        }

        ctx.translate(offsetX * MM_TO_PX, offsetY * MM_TO_PX);
        ctx.rotate(-((asset.rotation || 0) * Math.PI) / 180); // Ensure text is base-upright

        if (orientation === 'vertical') {
          ctx.rotate(Math.PI / 2);
        }
        
        ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;


        ctx.font = `${labelFontStyle} ${labelFontWeight} ${size * MM_TO_PX}px ${labelFontFamily}`;
        ctx.fillStyle = labelColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, 0, 0);
        if (labelTextDecoration === 'underline') {
          const metrics = ctx.measureText(label);
          ctx.strokeStyle = labelColor;
          ctx.lineWidth = Math.max(1, size * MM_TO_PX * 0.08);
          ctx.beginPath();
          ctx.moveTo(-metrics.width / 2, size * MM_TO_PX * 0.42);
          ctx.lineTo(metrics.width / 2, size * MM_TO_PX * 0.42);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // Show auto-dimensions if enabled (Applies to all types including Walls)
    if ((asset as any).showDimensions) {
      const autoDims = asset.type === 'wall-segments' && asset.wallNodes && asset.wallEdges
        ? getDimensionsForWall({
            id: asset.id,
            nodes: asset.wallNodes.map((node, index) => ({ id: `wall-node-${index}`, x: node.x, y: node.y })),
            edges: asset.wallEdges.map((edge, index) => ({
              id: `wall-edge-${index}`,
              nodeA: `wall-node-${edge.a}`,
              nodeB: `wall-node-${edge.b}`,
              thickness: asset.wallThickness || 150
            })),
            fill: asset.backgroundColor,
            stroke: asset.strokeColor,
            strokeWidth: asset.strokeWidth,
            fillType: (asset as any).fillType || 'color',
            fillTexture: (asset as any).fillTexture,
            zIndex: asset.zIndex || 0,
            showDimensions: true,
            dimensionType: (asset as any).dimensionType,
            dimensionFontSize: (asset as any).dimensionFontSize,
            dimensionOffset: (asset as any).dimensionOffset,
            dimensionStrokeWidth: (asset as any).dimensionStrokeWidth,
            dimensionColor: (asset as any).dimensionColor
          } as any)
        : getDimensionsForObject(asset as any, `export-auto-${asset.id}`);
      autoDims.forEach(ad => {
        renderDimensionToCanvas(ctx, ad, minX - padding - (contentShift / MM_TO_PX), minY - padding, 0, MM_TO_PX);
      });
    }

    ctx.restore();
  };

  const drawProfessionalPanel = async (
    ctx: CanvasRenderingContext2D, 
    width: number, 
    height: number, 
    details: ProfessionalDetails, 
    assetsToCount: AssetInstance[], 
    panelWidthPx: number,
    xOffset: number
  ) => {
    const PANEL_WIDTH = panelWidthPx;
    // Base all dimensions internally on the PANEL_WIDTH to ensure it looks 
    // exactly the same proportion regardless of the canvas size
    const padding = PANEL_WIDTH * 0.05; 
    const isLeft = details.panelPosition === 'left';
    const xBase = xOffset;
    const dividerColor = '#f1f5f9';
    const textColor = '#1e293b';
    const headerBg = details.panelColor || '#0056A9'; 
    
    // Fill background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(xBase, 0, PANEL_WIDTH, height);
    
    // Draw a border between panel and canvas
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = Math.max(1, PANEL_WIDTH * 0.005);
    ctx.beginPath();
    ctx.moveTo(isLeft ? xBase + PANEL_WIDTH : xBase, 0);
    ctx.lineTo(isLeft ? xBase + PANEL_WIDTH : xBase, height);
    ctx.stroke();

    let y = 0;

    // Relative font size definitions
    const headerFont = Math.max(12, PANEL_WIDTH * 0.055);
    const rowFontBase = Math.max(10, PANEL_WIDTH * 0.045);
    const rowFontLarge = Math.max(12, PANEL_WIDTH * 0.05);
    
    // Heights
    const headerHeight = PANEL_WIDTH * 0.12;
    const rowHeight = PANEL_WIDTH * 0.1;

    // Helper functions for sections
    const drawHeader = (title: string) => {
      ctx.fillStyle = headerBg;
      ctx.fillRect(xBase, y, PANEL_WIDTH, headerHeight);
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${headerFont}px Inter, sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillText(title.toUpperCase(), xBase + padding, y + (headerHeight / 2));
      y += headerHeight;
    };

    const drawRow = (label: string, value: string, isBold: boolean = false, isLast: boolean = false) => {
      ctx.fillStyle = textColor;
      ctx.font = isBold ? `bold ${rowFontLarge}px Inter, sans-serif` : `${rowFontBase}px Inter, sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      
      const maxW = PANEL_WIDTH - padding * 2;
      const metrics = ctx.measureText(value);
      
      if (metrics.width > maxW) {
        const words = value.split(' ');
        let line = '';
        for(let word of words) {
          const test = line + word + ' ';
          if (ctx.measureText(test).width > maxW && line.length > 0) {
            ctx.fillText(line, xBase + padding, y + (rowHeight / 2));
            y += rowHeight;
            line = word + ' ';
          } else {
            line = test;
          }
        }
        ctx.fillText(line, xBase + padding, y + (rowHeight / 2));
        y += rowHeight;
      } else {
        ctx.fillText(value, xBase + padding, y + (rowHeight / 2));
        y += rowHeight;
      }

      if (!isLast) {
        ctx.strokeStyle = dividerColor;
        ctx.lineWidth = Math.max(1, PANEL_WIDTH * 0.002);
        ctx.beginPath(); ctx.moveTo(xBase, y); ctx.lineTo(xBase + PANEL_WIDTH, y); ctx.stroke();
      }
    };

    const drawTableEntry = (label: string, value: string) => {
      ctx.fillStyle = textColor;
      ctx.font = `${rowFontBase}px Inter, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(label.toUpperCase(), xBase + padding, y + rowHeight / 2);
      
      if (value) {
        ctx.textAlign = 'right';
        ctx.font = `bold ${rowFontBase}px Inter, sans-serif`;
        ctx.fillText(value, xBase + PANEL_WIDTH - padding, y + rowHeight / 2);
      }
      y += rowHeight;
      ctx.strokeStyle = dividerColor;
      ctx.lineWidth = Math.max(1, PANEL_WIDTH * 0.002);
      ctx.beginPath(); ctx.moveTo(xBase, y); ctx.lineTo(xBase + PANEL_WIDTH, y); ctx.stroke();
    };

    // 1. EVENT INFO
    drawHeader('EVENT');
    drawRow('', details.eventName || "Untitled Project", true);

    if (details.client) {
      drawHeader('CLIENT');
      drawRow('', details.client, false);
    }

    if (details.date) {
      drawHeader('DATE');
      drawRow('', formatDateForDisplay(details.date), false);
    }

    // 2. VENUE
    drawHeader('VENUE');
    drawRow('', details.venue || "TBA", false);

    // 3. SITTING & INVENTORY (Seating-only items)
    drawHeader('SITTING');
    
    let grandSeatingTotal = 0;
    const sittingInventory = new Map<string, { count: number; capacity: number }>();
    const otherInventory = new Map<string, number>();
    
    if (details.sittingCode) {
        drawRow('Sitting Reference', details.sittingCode, true);
    }

    const isStructural = (a: AssetInstance) => 
        ['wall-segments', 'freehand', 'line', 'polyline', 'text', 'rect', 'circle', 'ellipse', 'arch', 'window', 'door'].includes(a.type.toLowerCase());

    const isSittingCategory = (a: AssetInstance) => {
        const libItem = ASSET_LIBRARY.find(l => l.id === a.type);
        const name = (libItem?.name || a.type).toLowerCase();
        const category = libItem?.category;
        
        // Strictly Seating / Tables keyword check
        const sittingKeywords = ['chair', 'table', 'stool', 'sofa', 'bench', 'seater'];
        const matchesKeyword = sittingKeywords.some(kw => name.includes(kw));
        
        // Only include in SITTING if it's furniture that matches keyword.
        // Sitting Styles (complex layouts like Classroom) go to OTHER ITEMS.
        return category === 'Furniture' && matchesKeyword && !isStructural(a);
    };

    assetsToCount.forEach(a => {
        if (isStructural(a)) return;
        
        const type = a.type;
        const libItem = ASSET_LIBRARY.find(l => l.id === type);
        const name = libItem?.name || type;
        
        if (isSittingCategory(a)) {
            // Capacity logic
            let capacity = 1;
            const seaterMatch = name.match(/(\d+)\s*(?:seater|Seater)/);
            if (seaterMatch) {
                capacity = parseInt(seaterMatch[1]);
            } else if (name.toLowerCase().includes('cocktail table')) {
                capacity = 4;
            } else if (name.toLowerCase().includes('table')) { // Standard table default
                capacity = 1; 
            }
            const current = sittingInventory.get(type) || { count: 0, capacity };
            sittingInventory.set(type, { count: current.count + 1, capacity: current.capacity });
        } else {
            // Other items category (Decorations, Equipment, or Complex Sitting Styles)
            const count = otherInventory.get(name) || 0;
            otherInventory.set(name, count + 1);
        }
    });

    if (sittingInventory.size === 0 && !details.sittingCode) {
      drawTableEntry('No sitting items found', '');
    } else {
      sittingInventory.forEach((data, type) => {
        const { count, capacity } = data;
        const subtotal = count * capacity;
        grandSeatingTotal += subtotal;
        const name = ASSET_LIBRARY.find(l => l.id === type)?.name || type;
        
        if (capacity > 1) {
            drawTableEntry(`${name} ${capacity} x ${count} = ${subtotal}`, "");
        } else {
            drawTableEntry(name, String(count));
        }
      });
      
      if (grandSeatingTotal > 0) {
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(xBase, y, PANEL_WIDTH, rowHeight);
        ctx.fillStyle = textColor;
        ctx.font = `bold ${rowFontLarge}px Inter, sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText('TOTAL GUESTS', xBase + padding, y + rowHeight / 2);
        ctx.textAlign = 'right';
        ctx.fillText(String(grandSeatingTotal), xBase + PANEL_WIDTH - padding, y + rowHeight / 2);
        y += rowHeight;
      }
    }

    // 4. OTHER ITEMS (Decorations, Layouts, Equipment)
    // (Removed by request - only focused on sitting assets)

    // 4. GUESTS ALLOCATION (Optional - Hide if empty)
    const allocationLines = (details.guestAllocation || "").split('\n').filter(l => l.trim().length > 0);
    
    if (allocationLines.length > 0) {
        drawHeader('GUESTS ALLOCATION');
        allocationLines.forEach(line => {
          if (line.includes(':')) {
            const [label, count] = line.split(':');
            drawTableEntry(label.trim(), count.trim());
          } else {
            drawTableEntry(line.trim(), '');
          }
        });
    }

    // 5. EVENT LOGO (Dedicated Section)
    if (details.logo) {
      drawHeader('EVENT LOGO');
      const logoPadding = PANEL_WIDTH * 0.1;
      const availableLogoH = PANEL_WIDTH * 0.35;
      
      const drawSingleLogo = async (logoUrl: string) => {
        const img = new Image(); img.src = logoUrl;
        await new Promise(r => { img.onload = r; img.onerror = r; });
        if (img.naturalWidth > 0) {
          const maxW = PANEL_WIDTH - logoPadding * 2;
          const maxH = availableLogoH - logoPadding;
          let tw = img.naturalWidth;
          let th = img.naturalHeight;
          const scale = Math.min(maxW / tw, maxH / th);
          tw *= scale; th *= scale;
          const lx = xBase + (PANEL_WIDTH - tw) / 2;
          const ly = y + (availableLogoH - th) / 2;
          ctx.drawImage(img, lx, ly, tw, th);
          y += availableLogoH;
        }
      };

      if (details.logo) await drawSingleLogo(details.logo);
    }

    // 6. BY (Branding with Planner)
    const BRANDING_SECTION_HEIGHT = PANEL_WIDTH * (details.byLogo ? 0.65 : 0.3);
    const footerStartY = height - BRANDING_SECTION_HEIGHT;
    
    y = Math.max(y, footerStartY); // Ensure we don't overlap with previous items if paper is too short
    drawHeader('BY');
    
    if (details.byLogo) {
      const logoPadding = PANEL_WIDTH * 0.1;
      const availableLogoH = PANEL_WIDTH * 0.25;

      const img = new Image(); img.src = details.byLogo;
      await new Promise(r => { img.onload = r; img.onerror = r; });
      if (img.naturalWidth > 0) {
        const maxW = PANEL_WIDTH - logoPadding * 2;
        const maxH = availableLogoH - logoPadding;
        let tw = img.naturalWidth;
        let th = img.naturalHeight;
        const scale = Math.min(maxW / tw, maxH / th);
        tw *= scale; th *= scale;
        const lx = xBase + (PANEL_WIDTH - tw) / 2;
        const ly = y + (availableLogoH - th) / 2;
        ctx.drawImage(img, lx, ly, tw, th);
        y += availableLogoH;
      }
    }

    // Planner Name if present
    if (details.eventPlanner) {
        ctx.fillStyle = textColor;
        ctx.font = `bold ${headerFont * 0.9}px Inter, sans-serif`; 
        ctx.textAlign = 'center';
        ctx.fillText(details.eventPlanner, xBase + PANEL_WIDTH / 2, y + rowHeight * 0.8);
        y += rowHeight * 0.8;
    }
    
    // Footer branding
    ctx.fillStyle = '#94a3b8';
    ctx.font = `italic ${rowFontBase}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('Powered by EventSpacePro', xBase + PANEL_WIDTH / 2, y + ((height - y) / 2));
  };


  const handleExport = async (option: ExportOption, details?: ProfessionalDetails) => {
    setIsExporting(true);
    try {
      const assetsToExport = option.exportSelection ? allItems.filter(i => selectedIds.includes(i.id)) : allItems;
      if (assetsToExport.length === 0) throw new Error("Nothing to export.");

      // 1. Calculate Bounding Box of content in mm (Include ALL types to prevent clipping)
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      const OFFSET = 200; // Architectural dimension offset from dimensionUtils
      const includeDimensionBounds = (dim: any) => {
        const bounds = { minX, minY, maxX, maxY };
        expandBoundsWithDimension(bounds, dim, zoom);
        minX = bounds.minX;
        minY = bounds.minY;
        maxX = bounds.maxX;
        maxY = bounds.maxY;
      };

      assetsToExport.forEach(a => {
        if (a.type === 'wall-segments' && a.wallNodes) {
          a.wallNodes.forEach(n => { 
            minX = Math.min(minX, n.x); minY = Math.min(minY, n.y); 
            maxX = Math.max(maxX, n.x); maxY = Math.max(maxY, n.y); 
          });

          if ((a as any).showDimensions && a.wallEdges) {
            const wallAutoDims = getDimensionsForWall({
              id: a.id,
              nodes: a.wallNodes.map((node, index) => ({ id: `wall-node-${index}`, x: node.x, y: node.y })),
              edges: a.wallEdges.map((edge, index) => ({
                id: `wall-edge-${index}`,
                nodeA: `wall-node-${edge.a}`,
                nodeB: `wall-node-${edge.b}`,
                thickness: a.wallThickness || 150
              })),
              fill: a.backgroundColor,
              stroke: a.strokeColor,
              strokeWidth: a.strokeWidth,
              fillType: (a as any).fillType || 'color',
              fillTexture: (a as any).fillTexture,
              zIndex: a.zIndex || 0,
              showDimensions: true,
              dimensionType: (a as any).dimensionType,
              dimensionFontSize: (a as any).dimensionFontSize,
              dimensionOffset: (a as any).dimensionOffset,
              dimensionStrokeWidth: (a as any).dimensionStrokeWidth,
              dimensionColor: (a as any).dimensionColor,
              dimensionLabelPosition: (a as any).dimensionLabelPosition,
            } as any);
            wallAutoDims.forEach(includeDimensionBounds);
          }
        } else if (a.type === 'dimension') {
          includeDimensionBounds(a as any);
        } else if (a.type === 'label-arrow') {
          const la = a as any;
          minX = Math.min(minX, la.startPoint.x, la.endPoint.x);
          minY = Math.min(minY, la.startPoint.y, la.endPoint.y);
          maxX = Math.max(maxX, la.startPoint.x, la.endPoint.x);
          maxY = Math.max(maxY, la.startPoint.y, la.endPoint.y);
        } else {
          const w = (a.width || 0) * (a.scale || 1); 
          const h = (a.height || 0) * (a.scale || 1);
          
          // Basic bounds
          minX = Math.min(minX, a.x - w/2); minY = Math.min(minY, a.y - h/2);
          maxX = Math.max(maxX, a.x + w/2); maxY = Math.max(maxY, a.y + h/2);

          // Add extra space for auto-dimensions if enabled
          if ((a as any).showDimensions) {
            minX = Math.min(minX, a.x - w/2 - OFFSET - 100);
            minY = Math.min(minY, a.y - h/2 - OFFSET - 100);
            maxX = Math.max(maxX, a.x + w/2 + OFFSET + 100);
            maxY = Math.max(maxY, a.y + h/2 + OFFSET + 100);
            getDimensionsForObject(a as any, `export-bounds-${a.id}`).forEach(includeDimensionBounds);
          }
        }
      });

      const mmPadding = 900; // Extra breathing room for fixed-size dimension labels in exports
      const contentW_mm = (maxX - minX) + mmPadding * 2;
      const contentH_mm = (maxY - minY) + mmPadding * 2;

      // 2. Set up Final Paper dimensions
      const p = PAPER_SIZES[option.paperSize];
      const paperPx = EXPORT_DPI / 25.4;
      // Force landscape if professional layout to fit the panel nicely on the side
      const targetW = (option.isProfessional ? Math.max(p.width, p.height) : p.width) * paperPx;
      const targetH = (option.isProfessional ? Math.min(p.width, p.height) : p.height) * paperPx;

      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = targetW; 
      finalCanvas.height = targetH;
      const fctx = finalCanvas.getContext('2d');
      if (!fctx) throw new Error("Final context error");

      fctx.fillStyle = '#ffffff'; 
      fctx.fillRect(0, 0, targetW, targetH);

      // 3. Define mapping zones on the paper
      let panelW_px = 0;
      let mapW_px = targetW;
      let mapH_px = targetH;
      const PANEL_RATIO = 0.22; // 22% of paper width goes to panel

      if (option.isProfessional) {
        panelW_px = targetW * PANEL_RATIO;
        mapW_px = targetW - panelW_px;
      }

      // 4. Calculate scaling from MM to PX to fit within mapW_px x mapH_px
      const sAspect = contentW_mm / contentH_mm;
      const tAspect = mapW_px / mapH_px;
      
      let finalContentW, finalContentH;
      if (sAspect > tAspect) {
        // Fits width perfectly
        finalContentW = mapW_px;
        finalContentH = mapW_px / sAspect;
      } else {
        // Fits height perfectly
        finalContentH = mapH_px;
        finalContentW = mapH_px * sAspect;
      }
      
      const MM_TO_PX = finalContentW / contentW_mm;

      // 5. Draw the actual floorplan content into a perfectly isolated canvas
      const sourceCanvas = document.createElement('canvas');
      sourceCanvas.width = finalContentW;
      sourceCanvas.height = finalContentH;
      const ctx = sourceCanvas.getContext('2d');
      if (!ctx) throw new Error("Canvas context error");
      ctx.fillStyle = '#ffffff'; 
      ctx.fillRect(0, 0, sourceCanvas.width, sourceCanvas.height);
      const workspaceSnapshot = await loadWorkspaceSnapshot(minX, minY, maxX, maxY, mmPadding);
      const canvasBackedAssetIds = new Set(
        assets
          .filter(asset =>
            !asset.isExploded &&
            assetTypesWithSvgPaths.has(asset.type) &&
            canRenderAssetOnCanvas(asset) &&
            (!option.exportSelection || selectedIds.includes(asset.id))
          )
          .map(asset => asset.id)
      );
      const canvasBackedAssetsToDraw = assetsToExport
        .filter(asset => canvasBackedAssetIds.has(asset.id))
        .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
      const wallSegmentsToDraw = assetsToExport
        .filter(asset => asset.type === 'wall-segments')
        .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

      if (workspaceSnapshot) {
        wallSegmentsToDraw.forEach(a => renderAssetToCanvas(ctx, a, minX, minY, mmPadding, 0, MM_TO_PX, new Map(), { wallFillOnly: true }));
        if (canvasBackedAssetsToDraw.length > 0) {
          const loadedImages = await loadSvgAssets(canvasBackedAssetsToDraw);
          canvasBackedAssetsToDraw.forEach(a => renderAssetToCanvas(ctx, a, minX, minY, mmPadding, 0, MM_TO_PX, loadedImages));
        }
        ctx.drawImage(workspaceSnapshot, 0, 0, sourceCanvas.width, sourceCanvas.height);
      } else {
        const loadedImages = await loadSvgAssets(assetsToExport);

        // Fallback: redraw items manually if the live workspace snapshot is unavailable
        assetsToExport.forEach(a => renderAssetToCanvas(ctx, a, minX, minY, mmPadding, 0, MM_TO_PX, loadedImages));
      }

      // 6. Draw sourceCanvas onto final paper, centered inside the map zone
      const ox = (details?.panelPosition === 'left' && option.isProfessional) 
                  ? panelW_px + (mapW_px - finalContentW) / 2 
                  : (mapW_px - finalContentW) / 2;
      const oy = (targetH - finalContentH) / 2;
      
      fctx.drawImage(sourceCanvas, ox, oy, finalContentW, finalContentH);

      // 7. Draw professional panel squarely on the remaining real estate of final canvas
      if (option.isProfessional && details) {
        const panelX = details.panelPosition === 'left' ? 0 : mapW_px;
        await drawProfessionalPanel(fctx, targetW, targetH, details, assetsToExport, panelW_px, panelX);
      }

      // 8. Output
      const fileName = `export-${Date.now()}.${option.format}`;
      if (option.format === 'pdf') {
        const doc = new jsPDF({ orientation: (targetW > targetH ? 'l' : 'p'), unit: 'mm', format: option.paperSize.toLowerCase() });
        const dataUrl = finalCanvas.toDataURL('image/png', 1.0);
        doc.addImage(dataUrl, 'PNG', 0, 0, (targetW/paperPx), (targetH/paperPx), undefined, 'FAST');
        doc.save(fileName);
      } else {
        const a = document.createElement('a'); 
        a.download = fileName; 
        a.href = finalCanvas.toDataURL(`image/${option.format}`, 1.0); 
        a.click();
      }
      toast.success("Export finished!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="border-t border-gray-100 pt-6 mt-6 font-sans">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-gray-900 flex items-center justify-between">
          Export / Import
          <button onClick={() => setIsExpanded(!isExpanded)} className="p-1 hover:bg-gray-100 rounded transition-colors">
            {isExpanded ? <FaTimes size={10} className="text-gray-400" /> : <FaPlus size={10} className="text-gray-400" />}
          </button>
        </h3>
      </div>

      {isExpanded && (
        <div className="space-y-4">
          {exportOptions.map(opt => (
            <div key={opt.id} className="p-3 bg-gray-50 border border-gray-100 rounded-xl hover:border-slate-300 transition-all group relative">
              <div className="grid grid-cols-2 gap-2 mb-2">
                <select className="bg-white border-gray-200 text-[10px] p-1.5 rounded-lg font-bold text-gray-700 outline-none" value={opt.paperSize} onChange={e => setExportOptions(exportOptions.map(o=>o.id===opt.id?{...o, paperSize: e.target.value as PaperSize}:o))}>
                  {Object.keys(PAPER_SIZES).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select className="bg-white border-gray-200 text-[10px] p-1.5 rounded-lg font-bold text-slate-800 outline-none" value={opt.format} onChange={e => setExportOptions(exportOptions.map(o=>o.id===opt.id?{...o, format: e.target.value as ExportFormat}:o))}>
                  <option value="pdf">PDF</option>
                  <option value="png">PNG</option>
                  <option value="jpg">JPG</option>
                </select>
              </div>

              <div className="flex flex-col gap-1 mb-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={opt.exportSelection} disabled={!hasSelection} onChange={e => setExportOptions(exportOptions.map(o=>o.id===opt.id?{...o, exportSelection: e.target.checked}:o))} className="w-3 h-3 rounded border-gray-300 text-slate-800"/>
                  <span className={`text-[10px] font-bold ${!hasSelection ? 'text-gray-300' : 'text-gray-600'}`}>Current Selection</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={opt.isProfessional} onChange={e => setExportOptions(exportOptions.map(o=>o.id===opt.id?{...o, isProfessional: e.target.checked}:o))} className="w-3 h-3 rounded border-gray-300 text-slate-800"/>
                  <span className="text-[10px] font-bold text-slate-800">Professional Layout</span>
                </label>
              </div>

              <button 
                onClick={() => {
                  if (opt.isProfessional) { setCurrentOption(opt); setShowProfessionalModal(true); }
                  else handleExport(opt);
                }}
                disabled={isExporting}
                className="w-full h-11 border-2 border-[var(--accent)] text-[var(--accent)] rounded-xl text-xs font-bold hover:bg-[var(--accent)] hover:text-white transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {isExporting ? <FaExpand className="animate-spin" size={12}/> : <FaDownload size={12}/>}
                {isExporting ? 'Exporting...' : `Export ${opt.format.toUpperCase()}`}
              </button>
            </div>
          ))}
          
          <button onClick={() => setExportOptions([...exportOptions, { id: `${exportOptions.length+1}`, paperSize: 'A4', format: 'pdf', exportSelection: false, isProfessional: true }])} className="w-full py-2 border border-dashed border-gray-200 rounded-lg text-[10px] font-bold text-gray-400 hover:text-slate-800 hover:border-slate-300 transition-all">
            + New Layout Config
          </button>
        </div>
      )}

      {/* Professional Export Modal - Align with Share UI */}
      {showProfessionalModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 backdrop-blur-sm bg-black/30" onClick={() => setShowProfessionalModal(false)}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 30 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            className="w-[32rem] bg-white rounded-[2.25rem] shadow-2xl overflow-hidden relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`p-8 text-white text-center transition-colors duration-300`} style={{ backgroundColor: profDetails.panelColor }}>
              <h2 className="text-2xl font-black tracking-tight">Export Panel</h2>
              <p className="opacity-70 text-[10px] uppercase font-bold tracking-[0.2em] mt-2">Professional Layout Details</p>
            </div>

            <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {/* Logo Upload Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex-1 flex flex-col items-center gap-3">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Event Logo</label>
                  <div className="relative group w-full">
                    <div className="w-full h-24 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden transition-all group-hover:border-slate-400">
                      {profDetails.logo ? (
                        <img src={profDetails.logo} className="w-full h-full object-contain p-2" />
                      ) : (
                        <Upload className="text-slate-300 group-hover:text-slate-500 transition-colors" size={24} />
                      )}
                      <input type="file" accept="image/*" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (ev) => setProfDetails({...profDetails, logo: ev.target?.result as string});
                          reader.readAsDataURL(file);
                        }
                      }} className="absolute inset-0 opacity-0 cursor-pointer" />
                    </div>
                    {profDetails.logo && (
                      <button onClick={() => setProfDetails({...profDetails, logo: null})} className="absolute -top-2 -right-2 w-6 h-6 bg-white border border-slate-100 rounded-full shadow-md flex items-center justify-center text-slate-400 hover:text-red-500 transition-all"><X size={12}/></button>
                    )}
                  </div>
                </div>

                <div className="flex-1 flex flex-col items-center gap-3">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Event By (Logo)</label>
                  <div className="relative group w-full">
                    <div className="w-full h-24 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden transition-all group-hover:border-slate-400">
                      {profDetails.byLogo ? (
                        <img src={profDetails.byLogo} className="w-full h-full object-contain p-2" />
                      ) : (
                        <Upload className="text-slate-300 group-hover:text-slate-500 transition-colors" size={24} />
                      )}
                      <input type="file" accept="image/*" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (ev) => setProfDetails({...profDetails, byLogo: ev.target?.result as string});
                          reader.readAsDataURL(file);
                        }
                      }} className="absolute inset-0 opacity-0 cursor-pointer" />
                    </div>
                    {profDetails.byLogo && (
                      <button onClick={() => setProfDetails({...profDetails, byLogo: null})} className="absolute -top-2 -right-2 w-6 h-6 bg-white border border-slate-100 rounded-full shadow-md flex items-center justify-center text-slate-400 hover:text-red-500 transition-all"><X size={12}/></button>
                    )}
                  </div>
                </div>
              </div>

              {/* Theme Selection */}
              <div className="space-y-3 text-center">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Panel Theme</label>
                <div className="flex justify-center gap-3">
                  {['#0056A9', '#1e293b', '#0f172a', '#334155', '#272235', '#dc3545'].map(color => (
                    <button 
                      key={color}
                      onClick={() => setProfDetails({...profDetails, panelColor: color})}
                      className={`w-8 h-8 rounded-full border-4 transition-all ${profDetails.panelColor === color ? 'border-slate-200 scale-125' : 'border-white hover:scale-110'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Event Name</label>
                  <input className="w-full h-12 bg-slate-50/50 rounded-2xl px-5 text-sm font-medium border-2 border-transparent focus:border-slate-800/10 focus:bg-white transition-all outline-none" value={profDetails.eventName} onChange={e=>setProfDetails({...profDetails, eventName: e.target.value})}/>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Client</label>
                  <input className="w-full h-12 bg-slate-50/50 rounded-2xl px-5 text-sm font-medium border-2 border-transparent focus:border-slate-800/10 focus:bg-white transition-all outline-none" placeholder="Client Name" value={profDetails.client} onChange={e=>setProfDetails({...profDetails, client: e.target.value})}/>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Venue</label>
                  <input className="w-full h-12 bg-slate-50/50 rounded-2xl px-5 text-sm font-medium border-2 border-transparent focus:border-slate-800/10 focus:bg-white transition-all outline-none" value={profDetails.venue} onChange={e=>setProfDetails({...profDetails, venue: e.target.value})}/>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Event Planner</label>
                  <input className="w-full h-12 bg-slate-50/50 rounded-2xl px-5 text-sm font-medium border-2 border-transparent focus:border-slate-800/10 focus:bg-white transition-all outline-none" placeholder="Planner Name" value={profDetails.eventPlanner} onChange={e=>setProfDetails({...profDetails, eventPlanner: e.target.value})}/>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Sitting Code</label>
                  <input className="w-full h-12 bg-slate-50/50 rounded-2xl px-5 text-sm font-medium border-2 border-transparent focus:border-slate-800/10 focus:bg-white transition-all outline-none" placeholder="Code (optional)" value={profDetails.sittingCode} onChange={e=>setProfDetails({...profDetails, sittingCode: e.target.value})}/>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Date</label>
                  <input type="text" inputMode="numeric" placeholder="DD/MM/YYYY" className="w-full h-12 bg-slate-50/50 rounded-2xl px-5 text-sm font-medium border-2 border-transparent focus:border-slate-800/10 focus:bg-white transition-all outline-none" value={formatDateForDisplay(profDetails.date)} onChange={e=>setProfDetails({...profDetails, date: normalizeDateInput(e.target.value)})}/>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Guest Allocation (Optional)</label>
                <textarea rows={3} className="w-full bg-slate-50/50 rounded-2xl p-4 text-sm font-medium border-2 border-transparent focus:border-slate-800/10 focus:bg-white transition-all outline-none resize-none" placeholder="e.g. Tables: 20\nChairs: 200" value={profDetails.guestAllocation} onChange={e=>setProfDetails({...profDetails, guestAllocation: e.target.value})}/>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Panel Position</label>
                <div className="flex gap-3">
                  <button onClick={()=>setProfDetails({...profDetails, panelPosition: 'left'})} className={`flex-1 h-12 text-sm font-bold rounded-2xl border-2 transition-all ${profDetails.panelPosition==='left'?'bg-[var(--accent)] border-[var(--accent)] text-white shadow-xl translate-y-[-2px]':'bg-white text-slate-400 border-slate-100 hover:border-slate-200'}`}>Left Side</button>
                  <button onClick={()=>setProfDetails({...profDetails, panelPosition: 'right'})} className={`flex-1 h-12 text-sm font-bold rounded-2xl border-2 transition-all ${profDetails.panelPosition==='right'?'bg-[var(--accent)] border-[var(--accent)] text-white shadow-xl translate-y-[-2px]':'bg-white text-slate-400 border-slate-100 hover:border-slate-200'}`}>Right Side</button>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button onClick={() => setShowProfessionalModal(false)} className="flex-1 h-14 rounded-[1.25rem] bg-slate-50 font-bold text-slate-400 hover:bg-slate-100 transition-all">Cancel</button>
                <button onClick={() => { setShowProfessionalModal(false); if(currentOption) handleExport(currentOption, profDetails); }} className="flex-1 h-14 rounded-[1.25rem] bg-[var(--accent)] text-white font-bold shadow-2xl shadow-slate-200 hover:opacity-90 transition-all">Start Export</button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
