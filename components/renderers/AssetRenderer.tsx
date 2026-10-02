"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Asset, useProjectStore } from '@/store/projectStore';
import { useEditorStore } from '@/store/editorStore';
import { ASSET_LIBRARY } from '@/lib/assets';
import { PRELOADED_VENUES } from '@/lib/preloadedVenues';
import { DEFAULT_ASSET_STROKE_WIDTH, canRenderAssetAsImage } from '@/utils/assetRenderMode';
import { getRasterAssetPath } from '@/utils/assetRasterPath';
import { getDwgSvgString } from '@/utils/dwgParser';

// Global cache for SVGs - defined at module top level to prevent ReferenceErrors during evaluation
const svgCache: Record<string, string> = {};
const pendingSvgCache: Record<string, Promise<string>> = {};
const processedSvgCache: Record<string, string> = {};
const svgMetricsCache: Record<string, SvgMetrics> = {};
const elementMetricsCache = new WeakMap<Element, { cx: number; cy: number; width: number; height: number }>();

function injectSvgDef(defId: string, svgString: string) {
    if (typeof document === 'undefined') return;
    let container = document.getElementById('asset-svg-defs-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'asset-svg-defs-container';
        container.style.display = 'none';
        document.body.appendChild(container);
    }
    if (!document.getElementById(defId)) {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = svgString;
        const svgEl = wrapper.firstElementChild;
        if (svgEl) {
            svgEl.setAttribute('id', defId);
            container.appendChild(svgEl);
        }
    }
}

type SvgMetrics = {
    artboardWidth: number | null;
    artboardHeight: number | null;
    contentX: number | null;
    contentY: number | null;
    contentWidth: number | null;
    contentHeight: number | null;
    physicalContentWidth: number | null;
    physicalContentHeight: number | null;
    shouldCropToContent: boolean;
};

// Helper to extract dimensions from SVG string
function getSvgMetrics(svgText: string): SvgMetrics {
    const widthMatch = svgText.match(/width=["']([\d.]+)[a-z%]*["']/i);
    const heightMatch = svgText.match(/height=["']([\d.]+)[a-z%]*["']/i);
    const viewBoxMatch = svgText.match(/viewBox=["']([\d\s.-]+)["']/);

    let width = widthMatch ? parseFloat(widthMatch[1]) : null;
    let height = heightMatch ? parseFloat(heightMatch[1]) : null;
    let viewBoxX = 0;
    let viewBoxY = 0;
    let viewBoxW: number | null = null;
    let viewBoxH: number | null = null;

    if (viewBoxMatch) {
        const parts = viewBoxMatch[1].split(/\s+/).map(parseFloat);
        if (parts.length === 4) {
            viewBoxX = parts[0];
            viewBoxY = parts[1];
            viewBoxW = parts[2];
            viewBoxH = parts[3];
            width = width || parts[2];
            height = height || parts[3];
        }
    }

    const result: SvgMetrics = {
        artboardWidth: width,
        artboardHeight: height,
        contentX: null,
        contentY: null,
        contentWidth: null,
        contentHeight: null,
        physicalContentWidth: null,
        physicalContentHeight: null,
        shouldCropToContent: false,
    };

    if (typeof document === 'undefined') {
        return result;
    }

    // mm width/height vs user-unit viewBox are different scales. Comparing
    // getBBox content to the width attr always looked uncropped-full, which
    // forced shouldCrop and then updateAsset() down to raw user units —
    // items shrank or vanished. Skip DOM measurement when scales differ.
    const unitScaleMismatch =
        !!width &&
        !!viewBoxW &&
        Math.abs(width / viewBoxW - 1) > 0.05;
    if (unitScaleMismatch) {
        return result;
    }

    const tempHost = document.createElement('div');
    tempHost.style.position = 'absolute';
    tempHost.style.left = '-100000px';
    tempHost.style.top = '-100000px';
    tempHost.style.width = '0';
    tempHost.style.height = '0';
    tempHost.style.opacity = '0';
    tempHost.style.pointerEvents = 'none';
    tempHost.style.overflow = 'hidden';
    tempHost.innerHTML = svgText;

    document.body.appendChild(tempHost);

    try {
        const tempSvg = tempHost.querySelector('svg') as SVGSVGElement | null;
        if (!tempSvg) {
            return result;
        }

        // Find and remove completely invisible background rects/paths before measuring the root bounds,
        // so we don't accidentally measure the designer's invisible artboard box.
        const allGraphics = Array.from(tempSvg.querySelectorAll('*')).filter((node) => node instanceof SVGGraphicsElement);
        allGraphics.forEach(node => {
            const fill = (node.getAttribute('fill') || '').trim();
            const stroke = (node.getAttribute('stroke') || '').trim();
            const style = (node.getAttribute('style') || '').toLowerCase();
            
            const isFillNone = fill === 'none' || style.includes('fill:none') || style.includes('fill: none');
            const isStrokeNone = stroke === 'none' || stroke === '' || style.includes('stroke:none') || style.includes('stroke: none');
            
            if (isFillNone && isStrokeNone && node.parentNode) {
                node.parentNode.removeChild(node);
            }
        });

        let bbox: DOMRect | null = null;
        try {
            const rootBox = tempSvg.getBBox();
            if (rootBox.width > 0 && rootBox.height > 0) {
                bbox = rootBox;
            }
        } catch {
            bbox = null;
        }

        if (!bbox || bbox.width <= 0 || bbox.height <= 0) {
            return result;
        }

        const contentX = bbox.x;
        const contentY = bbox.y;
        const contentWidth = bbox.width;
        const contentHeight = bbox.height;

        const refW = viewBoxW || width;
        const refH = viewBoxH || height;
        const widthRatio = refW ? contentWidth / refW : null;
        const heightRatio = refH ? contentHeight / refH : null;
        const xOffset = refW ? Math.abs(contentX - viewBoxX) / refW : 0;
        const yOffset = refH ? Math.abs(contentY - viewBoxY) / refH : 0;
        const shouldCropToContent =
            !refW ||
            !refH ||
            xOffset > 0.01 ||
            yOffset > 0.01 ||
            (widthRatio !== null && widthRatio < 0.95) ||
            (heightRatio !== null && heightRatio < 0.95);

        // Scale physical dimensions for updateAsset if viewBox and width differ (e.g. mm vs user-units)
        const scaleX = (width && viewBoxW) ? (width / viewBoxW) : 1;
        const scaleY = (height && viewBoxH) ? (height / viewBoxH) : 1;

        return {
            artboardWidth: width,
            artboardHeight: height,
            contentX,
            contentY,
            contentWidth,
            contentHeight,
            physicalContentWidth: contentWidth * scaleX,
            physicalContentHeight: contentHeight * scaleY,
            shouldCropToContent,
        };
    } finally {
        tempHost.remove();
    }
}

function getPathPoints(d: string): {x: number, y: number}[] {
    const points: {x: number, y: number}[] = [];
    const commands = d.match(/[a-df-z][^a-df-z]*/ig);
    if (!commands) return points;

    let cx = 0, cy = 0;

    commands.forEach(cmdStr => {
        const cmd = cmdStr[0];
        const args = (cmdStr.slice(1).match(/-?[\d.]+/g) || []).map(Number);
        
        if (cmd.toUpperCase() === 'M' || cmd.toUpperCase() === 'L') {
            for (let i = 0; i < args.length; i += 2) {
                if (args[i] !== undefined && args[i+1] !== undefined) {
                    cx = args[i];
                    cy = args[i+1];
                    points.push({ x: cx, y: cy });
                }
            }
        } else if (cmd.toUpperCase() === 'A') {
            for (let i = 0; i < args.length; i += 7) {
                const x = args[i+5];
                const y = args[i+6];
                if (x !== undefined && y !== undefined) {
                    cx = x;
                    cy = y;
                    points.push({ x: cx, y: cy });
                }
            }
        } else if (cmd.toUpperCase() === 'C') {
            for (let i = 0; i < args.length; i += 6) {
                const x = args[i+4];
                const y = args[i+5];
                if (x !== undefined && y !== undefined) {
                    cx = x;
                    cy = y;
                    points.push({ x: cx, y: cy });
                }
            }
        } else if (cmd.toUpperCase() === 'S' || cmd.toUpperCase() === 'Q') {
            for (let i = 0; i < args.length; i += 4) {
                const x = args[i+2];
                const y = args[i+3];
                if (x !== undefined && y !== undefined) {
                    cx = x;
                    cy = y;
                    points.push({ x: cx, y: cy });
                }
            }
        } else if (cmd.toUpperCase() === 'H') {
            for (let i = 0; i < args.length; i++) {
                cx = args[i];
                points.push({ x: cx, y: cy });
            }
        } else if (cmd.toUpperCase() === 'V') {
            for (let i = 0; i < args.length; i++) {
                cy = args[i];
                points.push({ x: cx, y: cy });
            }
        }
    });
    return points;
}

function getElementMetrics(el: Element) {
    const cachedMetrics = elementMetricsCache.get(el);
    if (cachedMetrics) return cachedMetrics;

    const tag = el.tagName.toLowerCase();
    let result: { cx: number; cy: number; width: number; height: number } | null = null;

    if (tag === 'circle') {
        const cx = parseFloat(el.getAttribute('cx') || '0');
        const cy = parseFloat(el.getAttribute('cy') || '0');
        const r = parseFloat(el.getAttribute('r') || '0');
        result = { cx, cy, width: r * 2, height: r * 2 };
    } else if (tag === 'ellipse') {
        const cx = parseFloat(el.getAttribute('cx') || '0');
        const cy = parseFloat(el.getAttribute('cy') || '0');
        const rx = parseFloat(el.getAttribute('rx') || '0');
        const ry = parseFloat(el.getAttribute('ry') || '0');
        result = { cx, cy, width: rx * 2, height: ry * 2 };
    } else if (tag === 'rect') {
        const x = parseFloat(el.getAttribute('x') || '0');
        const y = parseFloat(el.getAttribute('y') || '0');
        const w = parseFloat(el.getAttribute('width') || '0');
        const h = parseFloat(el.getAttribute('height') || '0');
        result = { cx: x + w / 2, cy: y + h / 2, width: w, height: h };
    } else if (tag === 'path') {
        const d = el.getAttribute('d') || '';
        const points = getPathPoints(d);
        if (points.length > 0) {
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            points.forEach(p => {
                minX = Math.min(minX, p.x);
                maxX = Math.max(maxX, p.x);
                minY = Math.min(minY, p.y);
                maxY = Math.max(maxY, p.y);
            });
            result = {
                cx: (minX + maxX) / 2,
                cy: (minY + maxY) / 2,
                width: maxX - minX,
                height: maxY - minY
            };
        }
    }

    if (result) elementMetricsCache.set(el, result);
    return result;
}

function getGDepth(el: Element): number {
    let depth = 0;
    let parent = el.parentElement;
    while (parent) {
        if (parent.tagName.toLowerCase() === 'g') {
            depth++;
        }
        parent = parent.parentElement;
    }
    return depth;
}

interface AssetRendererProps {
    asset: Asset;
    isSelected?: boolean;
    isHovered?: boolean;
    isHighlightOnly?: boolean;
    isPreview?: boolean;
    onMouseEnter?: (name: string) => void;
    onMouseLeave?: () => void;
    isCanvasBacked?: boolean;
}

const AssetRendererBase = ({ asset, isSelected = false, isHovered = false, isHighlightOnly = false, isPreview, onMouseEnter, onMouseLeave, isCanvasBacked = false }: AssetRendererProps) => {
    const [rawSvgContent, setRawSvgContent] = useState<string | null>(null);
    const [rasterImageFailed, setRasterImageFailed] = useState(false);
    const [dwgSvgData, setDwgSvgData] = useState<string | null>(null);
    // Workspace reads assets from projectStore — dimension repair must write
    // there too. Writing to sceneStore left project dimensions stale and marked
    // scene dirty, so autosave could merge stale scene fields over live work.
    const updateAsset = useProjectStore(s => s.updateAsset);

    // View-only: venues always preview with one uniform stroke width
    // (default 0.6) — the "Equal stroke width" Properties toggle was removed
    // and this is now permanently on. Exports build their own SVG
    // (ExportPanel.processVenueSvgForExport) and are unaffected.
    const equalVenueStrokeWidth = true;

    // Global numbering settings from store
    const globalPos = useProjectStore(s => s.globalTableNumberingPosition);
    const globalOrientation = useProjectStore(s => s.globalTableNumberingOrientation);
    const globalTableFontSize = useProjectStore(s => s.globalTableNumberingFontSize);
    const globalTableFontFamily = useProjectStore(s => s.globalTableNumberingFontFamily);
    const tableNumberingVisible = useProjectStore(s => s.tableNumberingVisible ?? true);
    const globalTableFontWeight = useProjectStore(s => s.globalTableNumberingFontWeight);
    const globalTableFontStyle = useProjectStore(s => s.globalTableNumberingFontStyle);
    const globalTableTextDecoration = useProjectStore(s => s.globalTableNumberingTextDecoration);
    const globalTableColor = useProjectStore(s => s.globalTableNumberingColor);

    // Find the definition for this asset type
    const libDef = ASSET_LIBRARY.find(item => item.id === asset.type);
    const venueDef = !libDef ? PRELOADED_VENUES.find(v => v.id === asset.type) : null;
    const definition: any = libDef || (venueDef ? { ...venueDef, category: 'Venue', label: venueDef.name } : null);
    const isMarquee = definition?.category === 'Marquee' || definition?.path?.toLowerCase().includes('marquee');
    const isSpaceElement =
        definition?.category === 'Space_Elements' ||
        definition?.category === 'Structure' ||
        definition?.path?.toLowerCase().includes('space_elements') ||
        definition?.path?.toLowerCase().includes('door') ||
        definition?.path?.toLowerCase().includes('window');
    const assetPath = definition?.path ? encodeURI(definition.path) : null;
    const rasterAssetPath = definition?.path ? encodeURI(getRasterAssetPath(definition.path) || '') : null;

    const showHighlight = isSelected || isHovered;
    const highlightColor = isSelected ? '#3b82f6' : '#60a5fa';
    const defaultStrokeWidth = isPreview ? 0.4 : (isMarquee ? 0.5 : DEFAULT_ASSET_STROKE_WIDTH);
    const disableFastImageForAsset =
        !!definition?.path &&
        (
            definition.path.toLowerCase().includes('10 seater round table 02.svg') ||
            definition.path.toLowerCase().includes('6 seater l shaped sofa.svg')
        );
    const hasCustomSubColors = Boolean((asset as any).tableColor || (asset as any).chairColor);
    const hasCustomColors = hasCustomSubColors || !canRenderAssetAsImage(asset, isPreview);
    // Only use SVG processing when the asset has custom fill/stroke colors that
    // need CSS variable overrides. Default-styled assets use the fast raster
    // path so their original SVG appearance (fills, strokes) is preserved.
    // In the workspace (not preview), an SVG asset without a raster renders as a
    // plain <image> so its internal strokes scale proportionally with the asset
    // size — preloaded venues/marquees keep a visible outline. Only the small
    // thumbnail/preview must avoid a broken/missing raster (otherwise it falls to
    // the SVG-processing path with non-scaling-stroke, which is what keeps a thin
    // outline legible at tiny zoom).
    const isVenueAsset = definition?.category === 'Venue' || definition?.path?.toLowerCase().includes('preloaded-venues');
    const preserveVenueStrokes = isVenueAsset && !equalVenueStrokeWidth;
    const isCad = !!definition?.path && (definition.path.toLowerCase().endsWith('.dwg') || definition.path.toLowerCase().endsWith('.dxf'));
    const isRasterFile = !!definition?.path && /\.(png|jpe?g|webp|gif|avif)$/i.test(definition.path);
    // Fast image path: render standard unexploded assets using their pre-rendered .webp raster
    // instead of parsing DOM and dangerouslySetInnerHTML DOM string for every asset instance.
    // Falls back to processed SVG if raster fails or for custom-colored/exploded/venue assets.
    // Disabled: the .webp rasters have ~10% margins and a thick outline baked in and they
    // ignore asset.strokeWidth entirely, so stroke widths 0.6/0.5 rendered thick+small vs
    // the hairline SVG path. Stroke-width control requires the SVG-processing path.
    const canUseFastImage = false;
    const fastImageHref = canUseFastImage ? rasterAssetPath : assetPath;
    
    // 1. Fill resolution logic (moved before baseSvg to determine if we need SVG for custom colors)
    const currentFill = useMemo(() => {
        let fill = asset.fillColor || 'transparent'; // Standard default
        const a = asset as any;
        if (a.fillType === 'texture' || a.fillType === 'hatch' || a.fillType === 'hash') {
            const scale = a.fillTextureScale !== undefined ? a.fillTextureScale : 1;
            const thickness = a.fillTextureThickness || 1;
            if (a.fillTexture) {
                const rotation = a.hatchRotation || 0;
                return `url(#${a.fillTexture}-scale-${scale}-thick-${thickness}-rot-${rotation})`;
            }
        }
        return fill;
    }, [asset.fillColor, (asset as any).fillType, (asset as any).fillTexture, (asset as any).fillTextureScale, (asset as any).fillTextureThickness]);

    const isCustomColored = useMemo(() => {
        const isRealColor = (c: any) => c && c !== 'transparent' && c !== 'none';
        const hasCustomFill = isRealColor(currentFill);
        const hasCustomTableColor = isRealColor((asset as any).tableColor);
        const hasCustomChairColor = isRealColor((asset as any).chairColor);
        return hasCustomFill || hasCustomTableColor || hasCustomChairColor;
    }, [currentFill, (asset as any).tableColor, (asset as any).chairColor]);

    const actuallyUseFastImage = canUseFastImage && !isCustomColored && !isVenueAsset;

    useEffect(() => {
        setRasterImageFailed(false);
    }, [rasterAssetPath]);

    // Fetch SVG content
    useEffect(() => {
        if (!definition?.path) return;
        if (isCad || isRasterFile) {
            setRawSvgContent(null);
            return;
        }

        const currentW = asset.width;
        const currentH = asset.height;
        const needsDimensionRepair = !currentW || !currentH;

        if (actuallyUseFastImage && !needsDimensionRepair) {
            setRawSvgContent(null);
            return;
        }

        const handleSvgText = (text: string) => {
            const metrics = svgMetricsCache[definition.path] || getSvgMetrics(text);
            svgMetricsCache[definition.path] = metrics;
            setRawSvgContent(prev => (prev === text ? prev : text));

            const svgWidth = (metrics.shouldCropToContent && metrics.physicalContentWidth) ? metrics.physicalContentWidth : metrics.artboardWidth;
            const svgHeight = (metrics.shouldCropToContent && metrics.physicalContentHeight) ? metrics.physicalContentHeight : metrics.artboardHeight;

            if (svgWidth && svgHeight) {
                const currentW = asset.width;
                const currentH = asset.height;
                const currentMatchesArtboard =
                    !!currentW &&
                    !!currentH &&
                    !!metrics.artboardWidth &&
                    !!metrics.artboardHeight &&
                    Math.abs(currentW - metrics.artboardWidth) / metrics.artboardWidth < 0.05 &&
                    Math.abs(currentH - metrics.artboardHeight) / metrics.artboardHeight < 0.05;
                const needsUpdate =
                    !currentW ||
                    !currentH ||
                    (metrics.shouldCropToContent && currentMatchesArtboard);

                if (needsUpdate && !isVenueAsset) {
                    setTimeout(() => {
                        updateAsset(asset.id, { width: svgWidth, height: svgHeight }, true);
                    }, 0);
                }
            }
        };

        // Check cache first
        if (svgCache[definition.path]) {
            handleSvgText(svgCache[definition.path]);
            return;
        }

        if (!pendingSvgCache[definition.path]) {
            pendingSvgCache[definition.path] = fetch(assetPath || definition.path)
                .then(res => res.text())
                .then(text => {
                    svgCache[definition.path] = text;
                    delete pendingSvgCache[definition.path];
                    return text;
                })
                .catch(err => {
                    delete pendingSvgCache[definition.path];
                    throw err;
                });
        }

        pendingSvgCache[definition.path]
            .then(handleSvgText)
            .catch(err => console.error("Failed to load SVG", err));
    }, [assetPath, definition?.path, definition?.width, definition?.height, asset.id, asset.width, asset.height, asset.type, actuallyUseFastImage, isCad, isRasterFile, updateAsset]);

    // Fetch CAD file (DWG/DXF) and parse to SVG
    useEffect(() => {
        if (!isCad || !assetPath) return;
        let cancelled = false;
        getDwgSvgString(assetPath).then((svgStr) => {
            if (cancelled) return;
            const blob = new Blob([svgStr], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);
            setDwgSvgData(url);
        }).catch((err) => console.error('[AssetRenderer] CAD parse failed for', assetPath, err));
        return () => { cancelled = true; };
    }, [isCad, assetPath]);

    const baseCacheKey = definition?.path ? `${definition.path}_workspace_v56_no_raster_${equalVenueStrokeWidth ? 'equal' : 'layered'}_eko_individual_strokes` : null;
    const defId = baseCacheKey ? "def-" + Math.abs(Array.from(baseCacheKey).reduce((h, c) => Math.imul(31, h) + c.charCodeAt(0) | 0, 0)) : null;



    // 2. Base SVG processing (Heavy - matches InlineSvg logic)
    const baseSvg = useMemo(() => {
        if (actuallyUseFastImage) return null;
        if (!rawSvgContent || typeof window === 'undefined' || !definition?.path) return null;

        if (baseCacheKey && processedSvgCache[baseCacheKey]) {
            if (defId) injectSvgDef(defId, processedSvgCache[baseCacheKey]);
            return processedSvgCache[baseCacheKey];
        }

        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(rawSvgContent, "image/svg+xml");
            const svg = doc.querySelector("svg");
            if (!svg) return rawSvgContent;
            const metrics = svgMetricsCache[definition.path] || getSvgMetrics(rawSvgContent);
            svgMetricsCache[definition.path] = metrics;

            const artboardWidth = metrics.artboardWidth || 1000;
            const artboardHeight = metrics.artboardHeight || 1000;

            const viewBoxMatch = rawSvgContent.match(/viewBox=["']([\d\s.-]+)["']/);
            let viewBoxX = 0;
            let viewBoxY = 0;
            if (viewBoxMatch) {
                const parts = viewBoxMatch[1].trim().split(/\s+/).map(parseFloat);
                if (parts.length === 4) {
                    viewBoxX = parts[0];
                    viewBoxY = parts[1];
                }
            }
            const artboardCenterX = viewBoxX + artboardWidth / 2;
            const artboardCenterY = viewBoxY + artboardHeight / 2;

            const isMultiSeater = definition.path.toLowerCase().includes('seater') || definition.path.toLowerCase().includes('sofa') || definition.path.toLowerCase().includes('doughtnut');

            const isSixSeaterLShapedSofa = definition.path.toLowerCase().includes('6 seater l shaped sofa.svg');
            if (isSixSeaterLShapedSofa) {
                const svgNs = "http://www.w3.org/2000/svg";
                const outlineSource = Array.from(doc.querySelectorAll("path")).find(path => {
                    const fill = (path.getAttribute("fill") || "").trim().toLowerCase();
                    return fill === "#402e2e";
                });

                if (outlineSource) {
                    const normalizedDoc = document.implementation.createDocument(svgNs, "svg", null);
                    const normalizedSvg = normalizedDoc.documentElement;
                    normalizedSvg.setAttribute("xmlns", svgNs);
                    normalizedSvg.setAttribute("version", "1.1");
                    normalizedSvg.setAttribute("width", "3506.0661mm");
                    normalizedSvg.setAttribute("height", "2746.0339mm");
                    normalizedSvg.setAttribute("viewBox", "165 100 1165 915");

                    const defs = normalizedDoc.createElementNS(svgNs, "defs");
                    const outlinePath = normalizedDoc.createElementNS(svgNs, "path");
                    outlinePath.setAttribute("id", "sofa-shape");
                    outlinePath.setAttribute("d", outlineSource.getAttribute("d") || "");

                    const transform = outlineSource.getAttribute("transform");
                    if (transform) outlinePath.setAttribute("transform", transform);

                    outlinePath.setAttribute("fill-rule", "evenodd");
                    outlinePath.setAttribute("clip-rule", "evenodd");
                    defs.appendChild(outlinePath);

                    const autoFillGroup = normalizedDoc.createElementNS(svgNs, "g");
                    autoFillGroup.setAttribute("id", "auto-fill");
                    autoFillGroup.setAttribute("class", "auto-fill");
                    autoFillGroup.setAttribute("data-auto-fill", "true");

                    const fillUse = normalizedDoc.createElementNS(svgNs, "use");
                    fillUse.setAttribute("href", "#sofa-shape");
                    fillUse.setAttribute("fill", "inherit");
                    fillUse.setAttribute("stroke", "none");
                    autoFillGroup.appendChild(fillUse);

                    const strokeUse = normalizedDoc.createElementNS(svgNs, "use");
                    strokeUse.setAttribute("href", "#sofa-shape");
                    strokeUse.setAttribute("fill", "none");
                    strokeUse.setAttribute("stroke", "inherit");
                    strokeUse.setAttribute("stroke-width", "inherit");
                    strokeUse.setAttribute("stroke-linejoin", "round");
                    strokeUse.setAttribute("stroke-linecap", "round");

                    normalizedSvg.appendChild(defs);
                    normalizedSvg.appendChild(autoFillGroup);
                    normalizedSvg.appendChild(strokeUse);

                    const result = new XMLSerializer().serializeToString(normalizedDoc);
                    if (baseCacheKey) processedSvgCache[baseCacheKey] = result;
                    if (defId) injectSvgDef(defId, result);
                    return result;
                }
            }

            // IMPORTANT:
            // Some QCAD SVGs put fill="none" on a parent <g>.
            // If we only set fill on the outer <svg>, that inner group blocks the fill,
            // so circles / auto-fill paths still render as unfilled.
            // follows the exact same uniform-width path as every other asset.

            // Equal-stroke view: measure the widest source layer (exterior walls) from
            // the RAW source before the child loop below strips stroke-width from every
            // element. Scaled exactly like the layered view scales it, so the venue keeps
            // its visual weight - just uniform across walls, doors, stairs and windows.
            let venueUniformStrokeWidth = NaN;
            if (isVenueAsset && !preserveVenueStrokes) {
                venueUniformStrokeWidth = asset.strokeWidth !== undefined ? asset.strokeWidth : DEFAULT_ASSET_STROKE_WIDTH;
            }

            // For venue assets, remove the baked-in optimize-venues style that forces
            // uniform stroke-width on all elements — we want to preserve per-element strokes.
            if (isVenueAsset) {
                const bakedStyle = doc.getElementById('preloaded-venue-style');
                if (bakedStyle) bakedStyle.remove();
            }

            doc.querySelectorAll("svg, g").forEach(container => {
                container.removeAttribute("fill");
                container.removeAttribute("stroke");
                // Preserve per-element stroke-width for venue assets so different
                // architectural layers (walls, doors, stairs) keep their distinct widths.
                if (!preserveVenueStrokes) {
                    container.removeAttribute("stroke-width");
                }

                const styleAttr = container.getAttribute("style");
                if (styleAttr) {
                    let cleaned = styleAttr
                        .replace(/fill\s*:[^;]+;?/gi, "")
                        .replace(/stroke\s*:[^;]+;?/gi, "");
                    if (!preserveVenueStrokes) {
                        cleaned = cleaned.replace(/stroke-width\s*:[^;]+;?/gi, "");
                    }
                    if (cleaned.trim()) container.setAttribute("style", cleaned);
                    else container.removeAttribute("style");
                }
            });

            let hasExplicitAutoFill = !!doc.querySelector('[id="auto-fill"], .auto-fill, [data-auto-fill="true"]');

            const styleId = "dynamic-asset-style";
            if (!doc.getElementById(styleId)) {
                svg.classList.add("asset-svg-content");
                const styleEl = doc.createElementNS("http://www.w3.org/2000/svg", "style");
                styleEl.setAttribute("id", styleId);
                const scope = `svg.asset-svg-content`;
                const vectorEffectRule = `${scope} path, ${scope} circle, ${scope} rect, ${scope} line, ${scope} polyline, ${scope} ellipse { vector-effect: non-scaling-stroke !important; }`;
                const strokeWidthInheritRule = "";
                styleEl.textContent = `${vectorEffectRule} ${scope} .fill-none-el { fill: none !important; stroke: inherit !important; ${strokeWidthInheritRule} } ${scope} .fill-inherit-el { fill: inherit !important; stroke: inherit !important; ${strokeWidthInheritRule} } ${scope} .auto-fill-el { fill: inherit !important; stroke: none !important; } ${scope} .stroke-top-layer { pointer-events: none; } ${scope} .table-fill-el { fill: var(--table-color, inherit) !important; stroke: inherit !important; ${strokeWidthInheritRule} } ${scope} .table-auto-fill-el { fill: var(--table-color, inherit) !important; stroke: none !important; } ${scope} .chair-fill-el { fill: var(--chair-color, inherit) !important; stroke: inherit !important; ${strokeWidthInheritRule} } ${scope} .chair-auto-fill-el { fill: var(--chair-color, inherit) !important; stroke: none !important; }`;
                svg.prepend(styleEl);
            }

            // Auto-generate auto-fill rect for SVGs that have no fillable elements
            // (e.g. QCAD wireframe exports with only open paths). Adds a fillable
            // background rect so fill/stroke controls work without editing the SVG.
            if (!hasExplicitAutoFill && definition?.path && (
                definition.path.toLowerCase().includes('curve')
            )) {
                const vb = svg.getAttribute('viewBox');
                if (vb) {
                    const parts = vb.trim().split(/\s+/).map(parseFloat);
                    if (parts.length === 4) {
                        const [vbX, vbY, vbW, vbH] = parts;
                        const autoFillRect = doc.createElementNS("http://www.w3.org/2000/svg", "rect");
                        autoFillRect.setAttribute("id", "auto-fill");
                        autoFillRect.setAttribute("class", "auto-fill");
                        autoFillRect.setAttribute("data-auto-fill", "true");
                        autoFillRect.setAttribute("x", String(vbX));
                        autoFillRect.setAttribute("y", String(vbY));
                        autoFillRect.setAttribute("width", String(vbW));
                        autoFillRect.setAttribute("height", String(vbH));
                        const cornerR = Math.min(vbW, vbH) * 0.08;
                        autoFillRect.setAttribute("rx", String(cornerR));
                        autoFillRect.setAttribute("ry", String(cornerR));
                        svg.insertBefore(autoFillRect, svg.firstChild);
                        hasExplicitAutoFill = true;
                    }
                }
            }


            const children = Array.from(doc.querySelectorAll('path, circle, rect, line, polyline, ellipse')).filter(el => !el.closest('defs, clipPath'));
            const circles = Array.from(doc.querySelectorAll('circle'));
            const innerCircles = new Set();

            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            children.forEach(el => {
                const m = getElementMetrics(el);
                if (m) {
                    minX = Math.min(minX, m.cx - m.width / 2);
                    maxX = Math.max(maxX, m.cx + m.width / 2);
                    minY = Math.min(minY, m.cy - m.height / 2);
                    maxY = Math.max(maxY, m.cy + m.height / 2);
                }
            });

            const contentWidth = isFinite(maxX - minX) ? (maxX - minX) : 1000;
            const contentHeight = isFinite(maxY - minY) ? (maxY - minY) : 1000;
            const contentCenterX = isFinite(minX) ? (minX + contentWidth / 2) : 500;
            const contentCenterY = isFinite(minY) ? (minY + contentHeight / 2) : 500;

            if (circles.length > 1) {
                const sorted = [...circles].sort((a, b) => parseFloat(a.getAttribute("r") || "0") - parseFloat(b.getAttribute("r") || "0"));
                for (let i = 0; i < sorted.length - 1; i++) {
                    innerCircles.add(sorted[i]);
                }
            }

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
                const isVenue = definition?.category === 'Venue' || definition?.path?.toLowerCase().includes('preloaded-venues');
                const isBgFill = isVenue && (tag === 'rect' || tag === 'path') && (() => {
                    // Only a solid-filled element can be a background; stroke-only line-work never qualifies
                    const fillAttrVal = (fillAttr || "").trim().toLowerCase();
                    const styleFillMatch = styleAttr && styleAttr.match(/fill\s*:\s*([^;]+)/i);
                    const fillVal = (fillAttrVal || (styleFillMatch ? styleFillMatch[1].trim().toLowerCase() : ""));
                    if (!fillVal || fillVal === "none") return false;
                    const m = getElementMetrics(el);
                    if (!m) return false;
                    const area = m.width * m.height;
                    const canvasArea = contentWidth * contentHeight;
                    // Any element covering more than 75% of the floorplan bounds is likely a solid background rectangle
                    return area > canvasArea * 0.75;
                })();

                const autoFillContainer = el.closest('[id="auto-fill"], .auto-fill, [data-auto-fill="true"]');
                const isAutoFill =
                    el.getAttribute("id") === "auto-fill" ||
                    el.classList.contains("auto-fill") ||
                    el.getAttribute("data-auto-fill") === "true" ||
                    !!autoFillContainer;

                // On workspace, we determine if it's furniture by checking the path/type
                // But for simplicity, we treat workspace assets with categories from the library
                const category = (definition as any).category || "";
                const catLower = category.toLowerCase();
                const isFurniture = catLower === 'furniture' || catLower === 'structure' || catLower === 'furniture asset' || asset.type.includes('chair') || asset.type.includes('table');

                let shouldBeNone = wasExplicitlyNone || isLineElement || (isOpenPath && !isMultiSeater) || isBgFill;

                if (hasExplicitAutoFill && tag === 'path' && !isAutoFill && !isFurniture) {
                    shouldBeNone = true;
                }

                let originalSw = el.getAttribute("stroke-width");
                if (styleAttr) {
                    const swMatch = styleAttr.match(/stroke-width\s*:\s*([^;]+)/i);
                    if (swMatch && !originalSw) originalSw = swMatch[1].trim();

                    let cleaned = styleAttr
                        .replace(/fill\s*:[^;]+;?/gi, "")
                        .replace(/stroke\s*:[^;]+;?/gi, "");
                    if (!preserveVenueStrokes) {
                        cleaned = cleaned.replace(/stroke-width\s*:[^;]+;?/gi, "");
                    }
                    // For background elements, strip stroke definitions from inline styles so stroke='none' takes effect
                    if (isBgFill) {
                        const bgCleaned = cleaned.replace(/stroke\s*:[^;]+;?/gi, "").replace(/stroke-width\s*:[^;]+;?/gi, "");
                        if (bgCleaned.trim()) el.setAttribute("style", bgCleaned);
                        else el.removeAttribute("style");
                    } else {
                        if (cleaned.trim()) el.setAttribute("style", cleaned);
                        else el.removeAttribute("style");
                    }
                }

                el.removeAttribute("fill");
                el.removeAttribute("stroke");
                // Preserve per-element stroke-width for venue assets
                if (!preserveVenueStrokes) {
                    el.removeAttribute("stroke-width");
                    
                    // Inject CSS var override that falls back to the original authored stroke width
                    const fallbackSw = originalSw || "inherit";
                    const currentStyle = el.getAttribute("style") || "";
                    el.setAttribute("style", `${currentStyle ? currentStyle + ';' : ''} stroke-width: var(--asset-stroke-width, ${fallbackSw}) !important;`);
                }

                if (!isFurniture) {
                    const isConsentricOuter = tag === 'circle' && circles.length > 1 && !innerCircles.has(el);
                    if (isConsentricOuter) {
                        shouldBeNone = true;
                    }
                }

                if (shouldBeNone && !hasFillRule && !isAutoFill) {
                    el.classList.add("fill-none-el");
                    if (!isVenue || isBgFill) {
                        el.setAttribute("stroke", "none");
                        (el as HTMLElement).style.stroke = "none";
                    }
                } else if (isMultiSeater) {
                    const elMetrics = getElementMetrics(el);
                    let isTable = false;
                    let isVeryLarge = false;
                    if (elMetrics) {
                        const distToCenter = Math.hypot(elMetrics.cx - contentCenterX, elMetrics.cy - contentCenterY);
                        const isCentral = distToCenter < contentWidth * 0.15;
                        isVeryLarge = elMetrics.width > contentWidth * 0.4 || elMetrics.height > contentHeight * 0.4;
                        isTable = isCentral && getGDepth(el) < 3;
                    }
                    if (isTable) {
                        el.classList.add(isAutoFill ? "table-auto-fill-el" : "table-fill-el");
                    } else {
                        el.classList.add(isAutoFill ? "chair-auto-fill-el" : "chair-fill-el");
                    }
                    if (isVeryLarge && !isTable) {
                        el.setAttribute("stroke", "none");
                        el.removeAttribute("stroke-width");
                        (el as HTMLElement).style.stroke = "none";
                    }
                } else if (isAutoFill) {
                    el.classList.add("auto-fill-el");
                } else {
                    el.classList.add("fill-inherit-el");
                }
            });

            // ── VENUE STROKE-WIDTH SCALING ────────────────────────────────────────
            // Venue SVGs use mm-scale stroke-widths (0.5 for exterior walls, 0.35 for
            // interior walls, 0.25 for doors, etc.) that are too thin at display size.
            // Scale them up by a factor so the relative differences are clearly visible.
            // Eko Individual Halls ships micro widths (0.001–0.0197); *10 leaves them
            // sub-pixel under non-scaling-stroke, so that file gets a larger factor.
            // Equal-stroke view: measured from the raw source above (the child loop
            // already stripped stroke-width from every element by this point), so this
            // block only writes the per-layer widths when the toggle is off.
            if (preserveVenueStrokes) {
                const isEkoIndividualHalls = definition?.path?.toLowerCase().includes('individual halls');
                const STROKE_SCALE = isEkoIndividualHalls ? 300 : 10;
                const allEls = doc.querySelectorAll('path, circle, rect, line, polyline, ellipse');
                allEls.forEach(el => {
                    // Resolve the source width from the presentation attribute or inline style.
                    let parsed = NaN;
                    const attrSW = el.getAttribute('stroke-width');
                    if (attrSW) parsed = parseFloat(attrSW);
                    if (isNaN(parsed)) {
                        const styleSW = el.getAttribute('style');
                        const m = styleSW && styleSW.match(/stroke-width\s*:\s*([\d.]+)/i);
                        if (m) parsed = parseFloat(m[1]);
                    }
                    if (!isNaN(parsed) && parsed > 0) {
                        // Written as an inline !important declaration: other SVGs on the
                        // same page (furniture, thumbnails) inject document-wide
                        // `stroke-width: inherit !important` rules for their fill-none-el
                        // elements, which would otherwise override these per-path widths
                        // and flatten the whole venue to a single inherited width.
                        (el as SVGElement).style.setProperty('stroke-width', String(parsed * STROKE_SCALE), 'important');
                        el.removeAttribute('stroke-width');
                    }
                });
            }
            // ────────────────────────────────────────────────────────────────────────

            // ── Z-ORDER FIX ─────────────────────────────────────────────────────────
            // Move details to top layer
            const rootGroup = svg.querySelector('g');
            if (rootGroup) {
                const strokeOnlyEls = Array.from(rootGroup.querySelectorAll('.fill-none-el'));
                if (strokeOnlyEls.length > 0) {
                    const topLayer = doc.createElementNS("http://www.w3.org/2000/svg", "g");
                    topLayer.setAttribute("class", "stroke-top-layer");
                    strokeOnlyEls.forEach(el => topLayer.appendChild(el));
                    rootGroup.appendChild(topLayer);
                }
            }
            // ────────────────────────────────────────────────────────────────────────

            svg.removeAttribute("style");
            svg.removeAttribute("fill");
            svg.removeAttribute("stroke");
            svg.removeAttribute("xmlns:qs");
            if (!isVenueAsset) {
                svg.removeAttribute("stroke-width");
            }
            // Equal-stroke view: stamp the single width on the root so every layer
            // inherits it through the `stroke-width: inherit` rules above.
            if (isVenueAsset && !preserveVenueStrokes && isFinite(venueUniformStrokeWidth)) {
                svg.setAttribute("stroke-width", String(venueUniformStrokeWidth));
            }
            svg.removeAttribute("width");
            svg.removeAttribute("height");
            if (metrics.shouldCropToContent && metrics.contentX !== null && metrics.contentY !== null && metrics.contentWidth && metrics.contentHeight) {
                svg.setAttribute("viewBox", `${metrics.contentX} ${metrics.contentY} ${metrics.contentWidth} ${metrics.contentHeight}`);
            } else if (!isVenueAsset) {
                const existingVB = svg.getAttribute("viewBox");
                if (existingVB) {
                    const parts = existingVB.trim().split(/[\s,]+/).map(parseFloat);
                    if (parts.length === 4 && parts.every(Number.isFinite)) {
                        const [vbX, vbY, vbW, vbH] = parts;
                        svg.setAttribute("viewBox", `${vbX} ${vbY} ${vbW} ${vbH}`);
                    }
                }
            }

            // Fix for resizable assets (Marquees, Dance Floors, Layout Elements):
            // By default, SVG <use> tags preserve the aspect ratio of their referenced <svg>.
            // When a user resizes a dance floor to a custom ratio (e.g. 200x50), if the SVG
            // forces "meet", it shrinks the drawing to 50x50 inside the 200x50 box, leaving a gap.
            // Setting preserveAspectRatio="none" forces the vectors to stretch to the bounding box exactly like the WebP does.
            if (!isVenueAsset) {
                svg.setAttribute("preserveAspectRatio", "none");
            }

            const result = new XMLSerializer().serializeToString(doc);
            if (baseCacheKey) processedSvgCache[baseCacheKey] = result;
            if (defId) injectSvgDef(defId, result);
            return result;
        } catch (e) {
            console.error("Error processing base SVG in AssetRenderer", e);
            return rawSvgContent;
        }
    }, [rawSvgContent, definition?.path, asset.type, actuallyUseFastImage, equalVenueStrokeWidth, baseCacheKey, defId]);



    const rawStrokeWidth = asset.strokeWidth !== undefined ? asset.strokeWidth : defaultStrokeWidth;
    const currentStrokeWidth = rawStrokeWidth <= 0 ? 0 : rawStrokeWidth;
    const currentStroke = rawStrokeWidth <= 0 ? 'none' : (asset.strokeColor || '#000000');
    const displayWidth = asset.width || definition?.width || 100;
    const displayHeight = asset.height || definition?.height || 100;

    // 3. (Removed processedSvg useMemo - we use <use> tags instead!)

    if (asset.isExploded) return null;
    const rotation = asset.rotation || 0;
    const baseScale = asset.scale !== undefined ? asset.scale : 1;
    const scaleX = (asset as any).flipX ? -baseScale : baseScale;
    const scaleY = (asset as any).flipY ? -baseScale : baseScale;
    const transform = `translate(${asset.x}, ${asset.y}) rotate(${rotation}) scale(${scaleX}, ${scaleY})`;

    const flipX = !!(asset as any).flipX;

    let tableLabel: React.ReactNode = null;
    if (asset.tableName && !isHighlightOnly && tableNumberingVisible) {
        const pos = (asset as any).tableNumberingPosition || globalPos || 'center';
        const orientation = (asset as any).tableNumberingOrientation || globalOrientation || 'horizontal';
        const labelFontSize = (asset as any).tableNumberingFontSize || globalTableFontSize || Math.max(14, (asset.width || 100) * 0.14);
        const labelFontFamily = (asset as any).tableNumberingFontFamily || globalTableFontFamily || 'Inter, sans-serif';
        const labelFontWeight = (asset as any).tableNumberingFontWeight || globalTableFontWeight || '900';
        const labelFontStyle = (asset as any).tableNumberingFontStyle || globalTableFontStyle || 'normal';
        const labelTextDecoration = (asset as any).tableNumberingTextDecoration || globalTableTextDecoration || 'none';
        const labelColor = (asset as any).tableNumberingColor || globalTableColor || '#000000';
        const circleR = Math.max(16, (asset.width || 100) * 0.12);
        const padding = circleR * 1.5;
        const halfW = (asset.width || 100) / 2;
        const halfH = (asset.height || 100) / 2;

        let tx = 0;
        let ty = 0;
        
        const rad = rotation * Math.PI / 180;
        const cosR = Math.cos(rad);
        const sinR = Math.sin(rad);

        // Compute the rotated visual bounding box
        const visHalfW = Math.abs(halfW * cosR) + Math.abs(halfH * sinR);
        const visHalfH = Math.abs(halfW * sinR) + Math.abs(halfH * cosR);

        switch (pos) {
            case 'top': ty = -visHalfH - padding; break;
            case 'bottom': ty = visHalfH + padding; break;
            case 'top-left': tx = -visHalfW; ty = -visHalfH - padding; break;
            case 'top-right': tx = visHalfW; ty = -visHalfH - padding; break;
            case 'bottom-left': tx = -visHalfW; ty = visHalfH + padding; break;
            case 'bottom-right': tx = visHalfW; ty = visHalfH + padding; break;
            case 'middle-left': tx = -visHalfW - padding; break;
            case 'middle-right': tx = visHalfW + padding; break;
            default: break;
        }

        // Do not apply flipX, flipY, or rotation to the label position itself,
        // because we want the label to always stay in the absolute visual direction requested.
        const worldX = asset.x + baseScale * tx;
        const worldY = asset.y + baseScale * ty;
        // Label always stays upright - do not rotate with the asset
        let worldRotation = 0;
        if (orientation === 'vertical') worldRotation = 90;

        tableLabel = (
            <g transform={`translate(${worldX}, ${worldY}) rotate(${worldRotation})`}>
                <text
                    x={0}
                    y={0}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={labelFontSize}
                    fill={labelColor}
                    fontWeight={labelFontWeight}
                    fontStyle={labelFontStyle}
                    textDecoration={labelTextDecoration}
                    pointerEvents="none"
                    style={{
                        userSelect: 'none',
                        fontFamily: labelFontFamily
                    }}
                >
                    {asset.tableName}
                </text>
            </g>
        );
    }


    return (
        <>
        <g
            transform={transform}
            style={{ 
                cursor: 'pointer', 
                ...(isCanvasBacked && canUseFastImage ? { display: 'none' } : {}),
                '--table-color': (asset as any).tableColor || currentFill,
                '--chair-color': (asset as any).chairColor || currentFill
            } as any}
            onMouseEnter={() => definition && onMouseEnter?.(definition.label)}
            onMouseLeave={() => onMouseLeave?.()}
            data-id={asset.id}
            data-canvas-backed-asset={isCanvasBacked && canUseFastImage ? 'true' : undefined}
        >
            {isHighlightOnly ? (
                showHighlight && (
                    <rect
                        x={-(asset.width || 100) / 2}
                        y={-(asset.height || 100) / 2}
                        width={asset.width || 100}
                        height={asset.height || 100}
                        fill="none"
                        stroke={highlightColor}
                        strokeWidth={2}
                        rx={8}
                        style={{
                            filter: `drop-shadow(0 0 6px ${highlightColor}) drop-shadow(0 0 2px ${highlightColor})`
                        }}
                    />
                )
            ) : (
                <>
                    {isCad && dwgSvgData ? (
                        <image
                            href={dwgSvgData}
                            x={-displayWidth / 2}
                            y={-displayHeight / 2}
                            width={displayWidth}
                            height={displayHeight}
                            preserveAspectRatio="xMidYMid meet"
                            style={{ outline: 'none', filter: 'none', pointerEvents: 'none' }}
                        />
                    ) : isRasterFile && assetPath ? (
                        <image
                            href={assetPath}
                            x={-displayWidth / 2}
                            y={-displayHeight / 2}
                            width={displayWidth}
                            height={displayHeight}
                            preserveAspectRatio="xMidYMid meet"
                            style={{ outline: 'none', filter: 'none', pointerEvents: 'none' }}
                        />
                    ) : baseSvg && defId ? (
                        <use
                            href={`#${defId}`}
                            data-venue="true"
                            x={-displayWidth / 2}
                            y={-displayHeight / 2}
                            width={displayWidth}
                            height={displayHeight}
                            fill={preserveVenueStrokes ? undefined : currentFill}
                            stroke={preserveVenueStrokes ? undefined : currentStroke}
                            strokeWidth={preserveVenueStrokes ? undefined : currentStrokeWidth}
                            style={{ 
                                ...(preserveVenueStrokes ? {} : { 
                                    fill: currentFill, 
                                    stroke: currentStroke, 
                                    strokeWidth: currentStrokeWidth,
                                    '--asset-stroke-width': asset.strokeWidth !== undefined ? asset.strokeWidth : 'unset'
                                } as any),
                                filter: 'none',
                                overflow: 'visible',
                                pointerEvents: 'none'
                            }}
                        />
                    ) : (
                        fastImageHref && (() => {
                            const isVenueImage = definition?.category === 'Venue' || definition?.path?.toLowerCase().includes('preloaded-venues');
                            if (isVenueImage) {
                                // Venue SVGs: wait for baseSvg to avoid flicker between
                                // image fallback and inline SVG at different sizes.
                                return null;
                            }
                            return (
                                <image
                                    href={fastImageHref}
                                    x={-displayWidth / 2}
                                    y={-displayHeight / 2}
                                    width={displayWidth}
                                    height={displayHeight}
                                    preserveAspectRatio="none"
                                    onError={() => {
                                        if (canUseFastImage && fastImageHref !== assetPath) {
                                            setRasterImageFailed(true);
                                        }
                                    }}
                                    style={{ outline: 'none', filter: 'none', pointerEvents: 'none' }}
                                />
                            );
                        })()
                    )}

                    <rect
                        x={-(asset.width || 100) / 2}
                        y={-(asset.height || 100) / 2}
                        width={asset.width || 100}
                        height={asset.height || 100}
                        fill="transparent"
                        stroke="none"
                        pointerEvents="all"
                    />


                    {!definition && (
                        <g>
                            <rect
                                x={-(asset.width || 100) / 2}
                                y={-(asset.height || 100) / 2}
                                width={asset.width || 100}
                                height={asset.height || 100}
                                fill={currentFill}
                                stroke={asset.strokeColor || '#000000'}
                                strokeWidth={asset.strokeWidth ?? DEFAULT_ASSET_STROKE_WIDTH}
                                style={{ filter: 'none' }}
                            />
                            <text
                                x={0}
                                y={0}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fontSize={12}
                                fill="#374151"
                                pointerEvents="none"
                                opacity={0.5}
                            >
                                {asset.type}
                            </text>
                        </g>
                    )}
                </>
            )}
        </g>
        {tableLabel}
        </>
    );
};

// Exporting as a named constant that is memoized
const AssetRenderer = React.memo(AssetRendererBase);

// Set display name for better debugging
AssetRenderer.displayName = 'AssetRenderer';

export default AssetRenderer;
