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

type ExportFormat = "pdf" | "png" | "jpg" | "jpeg";

const svgCache: Record<string, string> = {};
const typeIconCache: Record<string, HTMLImageElement> = {};

const EXPORT_DPI = 300; 

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
  sittingCode: string;
  guestAllocation: string;
  logo: string | null;
  panelPosition: 'left' | 'right';
  panelColor?: string;
}

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
      const exportStrokeWidth = (asset.strokeWidth || 4.0) * 3.5; 

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

          const allElements = Array.from(doc.querySelectorAll('*'));
          allElements.forEach(el => {
            const tag = el.tagName.toLowerCase();
            if (tag === 'svg' || tag === 'style') return;

            const fillAttr = el.getAttribute("fill");
            const styleAttr = el.getAttribute("style");
            const dAttr = el.getAttribute("d") || "";

            const wasExplicitlyNone = fillAttr === 'none' || (styleAttr && /fill\s*:\s*none/i.test(styleAttr));
            const isLineElement = tag === 'line' || tag === 'polyline';
            const isClosed = dAttr.toLowerCase().includes('z');
            const isOpenPath = tag === 'path' && !isClosed;

            // Preserve transparency for structural lines and open paths
            if (wasExplicitlyNone || isLineElement || isOpenPath) {
              el.setAttribute("fill", "none");
            } else {
              el.setAttribute("fill", fill === 'transparent' ? 'none' : fill);
            }

            // Force high-contrast architectural strokes
            el.setAttribute("stroke", stroke);
            el.setAttribute("stroke-width", exportStrokeWidth.toString());
            el.setAttribute("vector-effect", "non-scaling-stroke");
            
            // Cleanup internal styles that might override our baked attributes
            if (styleAttr) {
              const cleaned = styleAttr
                .replace(/fill\s*:[^;]+;?/gi, "")
                .replace(/stroke\s*:[^;]+;?/gi, "")
                .replace(/stroke-width\s*:[^;]+;?/gi, "");
              if (cleaned.trim()) el.setAttribute("style", cleaned);
              else el.removeAttribute("style");
            }
          });

          processedSvg = new XMLSerializer().serializeToString(doc);
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
  const { shapes, assets, walls, textAnnotations, labelArrows, dimensions, projectName } = useProjectStore();
  const selectedIds = useEditorStore((s) => s.selectedIds);
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

  const [profDetails, setProfDetails] = useState<ProfessionalDetails & { client?: string; date?: string; }>({
    eventName: projectName || "",
    venue: "TBA",
    sittingCode: "",
    guestAllocation: "General Admission: TBA",
    logo: null,
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
        type: s.type === 'ellipse' ? 'circle' : (s.type === 'rectangle' ? 'rect' : s.type),
        backgroundColor: s.fill || 'transparent',
        strokeColor: s.stroke || '#000000',
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
          lineColor: '#000000',
          wallThickness: validEdges[0]?.thickness || 150,
          zIndex: w.zIndex || 0,
          showDimensions: w.showDimensions,
        };
      }).filter(Boolean),
      ...assets.map(a => ({ ...a })),
      ...textAnnotations.map(t => ({ ...t, type: 'text-annotation' })),
      ...labelArrows.map(la => ({ ...la, type: 'label-arrow' })),
      ...dimensions.map(d => ({ ...d, type: 'dimension' }))
    ];
    return items.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
  }, [shapes, assets, walls, textAnnotations, labelArrows, dimensions]);

  const renderAssetToCanvas = (
    ctx: CanvasRenderingContext2D,
    asset: AssetInstance,
    minX: number,
    minY: number,
    padding: number,
    contentShift: number,
    MM_TO_PX: number,
    loadedImages: Map<string, HTMLImageElement>
  ) => {
    const worldX = asset.x - minX + padding + (contentShift / MM_TO_PX);
    const worldY = asset.y - minY + padding;
    const cx = worldX * MM_TO_PX;
    const cy = worldY * MM_TO_PX;

    if (asset.type === 'wall-segments') {
      const strokeColor = asset.lineColor || "#000000";
      // Use workspace-native wall stroke width
      const wallThickness = (asset.wallThickness || 150) * (asset.scale || 1);
      
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

          ctx.fillStyle = '#f1f5f9';
          ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); pts.forEach(p => ctx.lineTo(p.x, p.y)); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = strokeColor;
          // Use heavy-duty architectural line weight for structural walls (3.0mm)
          ctx.lineWidth = (asset.strokeWidth || 3.0) * MM_TO_PX;
          ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(pts[1].x, pts[1].y); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(pts[2].x, pts[2].y); ctx.lineTo(pts[3].x, pts[3].y); ctx.stroke();
        });
      }
    } else if (asset.type === 'freehand') {
      const points = (asset as any).points;
      if (points?.length > 1) {
        ctx.strokeStyle = asset.strokeColor || "#000000";
        // Freehand path: ensure it's visible but not chunky
        ctx.lineWidth = Math.max(1, (asset.strokeWidth || 1) * 0.2 * MM_TO_PX);
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
      // Basic label arrow export
      const la = asset as any;
      const startX = (la.startPoint.x - minX + padding + (contentShift / MM_TO_PX)) * MM_TO_PX;
      const startY = (la.startPoint.y - minY + padding) * MM_TO_PX;
      const endX = (la.endPoint.x - minX + padding + (contentShift / MM_TO_PX)) * MM_TO_PX;
      const endY = (la.endPoint.y - minY + padding) * MM_TO_PX;
      
      ctx.strokeStyle = la.color || "#000000";
      ctx.lineWidth = 1 * MM_TO_PX;
      ctx.beginPath(); ctx.moveTo(startX, startY); ctx.lineTo(endX, endY); ctx.stroke();
      
      // Arrow head (simple)
      const angle = Math.atan2(endY - startY, endX - startX);
      const headLen = 10 * MM_TO_PX;
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(endX - headLen * Math.cos(angle - Math.PI / 6), endY - headLen * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(endX, endY);
      ctx.lineTo(endX - headLen * Math.cos(angle + Math.PI / 6), endY - headLen * Math.sin(angle + Math.PI / 6));
      ctx.stroke();

      if (la.label) {
        ctx.font = `${8 * MM_TO_PX}px Inter, sans-serif`;
        ctx.fillStyle = la.color || "#000000";
        ctx.fillText(la.label, startX, startY - 5 * MM_TO_PX);
      }
    } else {
      const w = (asset.width || 0) * (asset.scale || 1);
      const h = (asset.height || 0) * (asset.scale || 1);
      ctx.save();
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
        const fill = asset.backgroundColor || asset.fillColor || (asset.type.includes('table') ? '#f8fafc' : 'transparent');
        ctx.fillStyle = fill;
        ctx.strokeStyle = asset.strokeColor || '#000000';
        // Shapes get a 3.0mm minimum stroke for maximum clarity on full-plan prints
        ctx.lineWidth = (asset.strokeWidth || 3.0) * MM_TO_PX;
        
        // ONLY draw primitive circles if the type is explicitly circle/ellipse
        if (asset.type === 'circle' || asset.type === 'ellipse') {
          ctx.beginPath(); ctx.ellipse(0, 0, Math.abs(w*MM_TO_PX/2), Math.abs(h*MM_TO_PX/2), 0, 0, Math.PI*2);
          if (fill !== 'transparent') ctx.fill(); ctx.stroke();
        } else {
           // Fallback for missing furniture assets: use a visible structural outline
          ctx.strokeStyle = '#000000'; // Hard force black for visibility if asset failed
          ctx.lineWidth = 2 * MM_TO_PX;
          if (fill !== 'transparent') ctx.fill();
          ctx.strokeRect(-w*MM_TO_PX/2, -h*MM_TO_PX/2, w*MM_TO_PX, h*MM_TO_PX);
          
          // Cross-hatch to signal internal error but keep plan readable
          ctx.beginPath();
          ctx.moveTo(-w*MM_TO_PX/2, -h*MM_TO_PX/2); ctx.lineTo(w*MM_TO_PX/2, h*MM_TO_PX/2);
          ctx.moveTo(w*MM_TO_PX/2, -h*MM_TO_PX/2); ctx.lineTo(-w*MM_TO_PX/2, h*MM_TO_PX/2);
          ctx.stroke();
        }
      }

      // Add high-visibility Table Name (Numbering) Label if present
      if ((asset as any).tableName) {
        ctx.rotate(-((asset.rotation || 0) * Math.PI) / 180); // Un-rotate text so it's always upright
        
        const label = (asset as any).tableName;
        // Match proportional size logic from editor
        const size = Math.max(14, (asset.width || 100) * 0.14);
        const circleR = Math.max(16, (asset.width || 100) * 0.12);
        
        // Use a high-quality circular background
        ctx.shadowColor = 'rgba(0,0,0,0.2)';
        ctx.shadowBlur = 4 * MM_TO_PX;
        ctx.shadowOffsetY = 2 * MM_TO_PX;
        
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(0, 0, circleR * MM_TO_PX, 0, Math.PI * 2);
        ctx.fill();
        
        // Reset shadow for text
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = Math.max(1, (asset.width || 100) * 0.01) * MM_TO_PX;
        ctx.stroke();

        ctx.font = `900 ${size * MM_TO_PX}px Inter, sans-serif`;
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, 0, 0);
      }
      ctx.restore();
    }

    // Show auto-dimensions if enabled (Applies to all types including Walls)
    if ((asset as any).showDimensions) {
      const autoDims = getDimensionsForObject(asset as any, `export-auto-${asset.id}`);
      autoDims.forEach(ad => {
        renderDimensionToCanvas(ctx, ad, minX - padding - (contentShift / MM_TO_PX), minY - padding, 0, MM_TO_PX);
      });
    }
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
      drawRow('', details.date, false);
    }

    // 2. VENUE
    drawHeader('VENUE');
    drawRow('', details.venue || "TBA", false);

    // 3. SITTING CODE (Inventory)
    drawHeader('SITTING CODE');
    const inventory = new Map<string, number>();
    assetsToCount.forEach(a => {
      if(!['wall-segments', 'freehand', 'line', 'polyline', 'text', 'rect', 'circle', 'ellipse'].includes(a.type)) {
        inventory.set(a.type, (inventory.get(a.type) || 0) + 1);
      }
    });

    if (inventory.size === 0) {
      drawTableEntry('No items found', '');
    } else {
      let totalItems = 0;
      inventory.forEach((count, type) => {
        totalItems += count;
        const name = ASSET_LIBRARY.find(l => l.id === type)?.name || type;
        drawTableEntry(name, String(count));
      });
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(xBase, y, PANEL_WIDTH, rowHeight);
      ctx.fillStyle = textColor;
      ctx.font = `bold ${rowFontLarge}px Inter, sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText('TOTAL', xBase + padding, y + rowHeight / 2);
      ctx.textAlign = 'right';
      ctx.fillText(String(totalItems), xBase + PANEL_WIDTH - padding, y + rowHeight / 2);
      y += rowHeight;
    }

    // 4. GUESTS ALLOCATION
    drawHeader('GUESTS ALLOCATION');
    const allocationLines = (details.guestAllocation || "").split('\n').filter(l => l.trim().length > 0);
    if (allocationLines.length === 0) {
       drawTableEntry('General Admission', 'TBA');
    } else {
      allocationLines.forEach(line => {
        if (line.includes(':')) {
          const [label, count] = line.split(':');
          drawTableEntry(label.trim(), count.trim());
        } else {
          drawTableEntry(line.trim(), '');
        }
      });
    }

    // 5. EVENT BY (Branding)
    const logoBlockH = PANEL_WIDTH * 0.4;
    const blockStartY = height - logoBlockH;
    y = blockStartY;
    drawHeader('EVENT BY');
    
    if (details.logo) {
      const img = new Image(); img.src = details.logo;
      await new Promise(r => { img.onload = r; img.onerror = r; });
      if (img.naturalWidth > 0) {
        // Precise vertical centering in the area remaining after the 'EVENT BY' header
        const availableH = logoBlockH - headerHeight;
        const maxW = PANEL_WIDTH * 0.8;
        const maxH = availableH * 0.8;

        let tw = img.naturalWidth;
        let th = img.naturalHeight;
        const scale = Math.min(maxW / tw, maxH / th);
        tw *= scale; th *= scale;

        const lx = xBase + (PANEL_WIDTH - tw) / 2;
        const ly = blockStartY + headerHeight + (availableH - th) / 2;
        
        ctx.drawImage(img, lx, ly, tw, th);
      }
    } else {
      const availableH = logoBlockH - headerHeight;
      ctx.fillStyle = '#94a3b8';
      ctx.font = `italic ${rowFontBase}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('Professional Layout Design', xBase + PANEL_WIDTH / 2, y + headerHeight + (availableH / 2));
    }
  };


  const handleExport = async (option: ExportOption, details?: ProfessionalDetails) => {
    setIsExporting(true);
    try {
      const assetsToExport = option.exportSelection ? allItems.filter(i => selectedIds.includes(i.id)) : allItems;
      if (assetsToExport.length === 0) throw new Error("Nothing to export.");

      // 1. Calculate Bounding Box of content in mm (Include ALL types to prevent clipping)
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      const OFFSET = 200; // Architectural dimension offset from dimensionUtils

      assetsToExport.forEach(a => {
        if (a.type === 'wall-segments' && a.wallNodes) {
          a.wallNodes.forEach(n => { 
            minX = Math.min(minX, n.x); minY = Math.min(minY, n.y); 
            maxX = Math.max(maxX, n.x); maxY = Math.max(maxY, n.y); 
          });
        } else if (a.type === 'dimension') {
          const d = a as any;
          minX = Math.min(minX, d.startPoint.x, d.endPoint.x);
          minY = Math.min(minY, d.startPoint.y, d.endPoint.y);
          maxX = Math.max(maxX, d.startPoint.x, d.endPoint.x);
          maxY = Math.max(maxY, d.startPoint.y, d.endPoint.y);
          // Account for dimension offset
          if (d.offset) {
             const dx = d.endPoint.x - d.startPoint.x;
             const dy = d.endPoint.y - d.startPoint.y;
             const len = Math.sqrt(dx*dx + dy*dy);
             if (len > 0) {
               const nx = -dy/len; const ny = dx/len;
               const px = d.startPoint.x + nx * d.offset;
               const py = d.startPoint.y + ny * d.offset;
               minX = Math.min(minX, px); minY = Math.min(minY, py);
               maxX = Math.max(maxX, px); maxY = Math.max(maxY, py);
             }
          }
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
          }
        }
      });

      const mmPadding = 400; // Increased to 400mm (40cm) for better architectural breathing room
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

      const loadedImages = await loadSvgAssets(assetsToExport);

      // Draw all assets on sourceCanvas
      assetsToExport.forEach(a => renderAssetToCanvas(ctx, a, minX, minY, mmPadding, 0, MM_TO_PX, loadedImages));

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
              <div className="flex flex-col items-center gap-3">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Project Logo</label>
                <div className="relative group">
                  <div className="w-24 h-24 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden transition-all group-hover:border-slate-400">
                    {profDetails.logo ? (
                      <img src={profDetails.logo} className="w-full h-full object-cover" />
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
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Date</label>
                  <input className="w-full h-12 bg-slate-50/50 rounded-2xl px-5 text-sm font-medium border-2 border-transparent focus:border-slate-800/10 focus:bg-white transition-all outline-none" value={profDetails.date} onChange={e=>setProfDetails({...profDetails, date: e.target.value})}/>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Position</label>
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