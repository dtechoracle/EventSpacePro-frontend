"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useSceneStore } from '@/store/sceneStore';
import { Asset, useProjectStore } from '@/store/projectStore';
import { ASSET_LIBRARY } from '@/lib/assets';
import { DEFAULT_ASSET_STROKE_WIDTH, canRenderAssetAsImage } from '@/utils/assetRenderMode';
import { getRasterAssetPath } from '@/utils/assetRasterPath';

// Global cache for SVGs - defined at module top level to prevent ReferenceErrors during evaluation
const svgCache: Record<string, string> = {};
const pendingSvgCache: Record<string, Promise<string>> = {};
const processedSvgCache: Record<string, string> = {};
const svgMetricsCache: Record<string, SvgMetrics> = {};

type SvgMetrics = {
    artboardWidth: number | null;
    artboardHeight: number | null;
    contentX: number | null;
    contentY: number | null;
    contentWidth: number | null;
    contentHeight: number | null;
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

    if (viewBoxMatch) {
        const parts = viewBoxMatch[1].split(/\s+/).map(parseFloat);
        if (parts.length === 4) {
            viewBoxX = parts[0];
            viewBoxY = parts[1];
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
        shouldCropToContent: false,
    };

    if (typeof document === 'undefined') {
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

        let bbox: DOMRect | null = null;

        try {
            const rootBox = tempSvg.getBBox();
            if (rootBox.width > 0 && rootBox.height > 0) {
                bbox = rootBox;
            }
        } catch {
            bbox = null;
        }

        if (!bbox) {
            let minX = Number.POSITIVE_INFINITY;
            let minY = Number.POSITIVE_INFINITY;
            let maxX = Number.NEGATIVE_INFINITY;
            let maxY = Number.NEGATIVE_INFINITY;

            const graphics = Array.from(tempSvg.querySelectorAll('*')).filter((node): node is SVGGraphicsElement => {
                if (!(node instanceof SVGGraphicsElement)) return false;
                if (node.closest('defs, clipPath, mask, pattern, marker, symbol, title, desc, style, script')) return false;
                return true;
            });

            graphics.forEach(node => {
                try {
                    const box = node.getBBox();
                    if (box.width <= 0 && box.height <= 0) return;

                    minX = Math.min(minX, box.x);
                    minY = Math.min(minY, box.y);
                    maxX = Math.max(maxX, box.x + box.width);
                    maxY = Math.max(maxY, box.y + box.height);
                } catch {
                    // Ignore nodes that cannot report bounds
                }
            });

            if (Number.isFinite(minX) && Number.isFinite(minY) && Number.isFinite(maxX) && Number.isFinite(maxY)) {
                bbox = {
                    x: minX,
                    y: minY,
                    width: maxX - minX,
                    height: maxY - minY,
                } as DOMRect;
            }
        }

        if (!bbox || bbox.width <= 0 || bbox.height <= 0) {
            return result;
        }

        const contentX = bbox.x;
        const contentY = bbox.y;
        const contentWidth = bbox.width;
        const contentHeight = bbox.height;

        const widthRatio = width ? contentWidth / width : null;
        const heightRatio = height ? contentHeight / height : null;
        const xOffset = width ? Math.abs(contentX - viewBoxX) / width : 0;
        const yOffset = height ? Math.abs(contentY - viewBoxY) / height : 0;
        const shouldCropToContent =
            !width ||
            !height ||
            xOffset > 0.01 ||
            yOffset > 0.01 ||
            (widthRatio !== null && widthRatio < 0.95) ||
            (heightRatio !== null && heightRatio < 0.95);

        return {
            artboardWidth: width,
            artboardHeight: height,
            contentX,
            contentY,
            contentWidth,
            contentHeight,
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
    const tag = el.tagName.toLowerCase();
    
    if (tag === 'circle') {
        const cx = parseFloat(el.getAttribute('cx') || '0');
        const cy = parseFloat(el.getAttribute('cy') || '0');
        const r = parseFloat(el.getAttribute('r') || '0');
        return { cx, cy, width: r * 2, height: r * 2 };
    } else if (tag === 'ellipse') {
        const cx = parseFloat(el.getAttribute('cx') || '0');
        const cy = parseFloat(el.getAttribute('cy') || '0');
        const rx = parseFloat(el.getAttribute('rx') || '0');
        const ry = parseFloat(el.getAttribute('ry') || '0');
        return { cx, cy, width: rx * 2, height: ry * 2 };
    } else if (tag === 'rect') {
        const x = parseFloat(el.getAttribute('x') || '0');
        const y = parseFloat(el.getAttribute('y') || '0');
        const w = parseFloat(el.getAttribute('width') || '0');
        const h = parseFloat(el.getAttribute('height') || '0');
        return { cx: x + w / 2, cy: y + h / 2, width: w, height: h };
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
            return {
                cx: (minX + maxX) / 2,
                cy: (minY + maxY) / 2,
                width: maxX - minX,
                height: maxY - minY
            };
        }
    }
    return null;
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
    const updateAsset = useSceneStore(s => s.updateAsset);

    // Global numbering settings from store
    const globalPos = useProjectStore(s => s.globalTableNumberingPosition);
    const globalOrientation = useProjectStore(s => s.globalTableNumberingOrientation);
    const globalTableFontSize = useProjectStore(s => s.globalTableNumberingFontSize);
    const globalTableFontFamily = useProjectStore(s => s.globalTableNumberingFontFamily);
    const globalTableFontWeight = useProjectStore(s => s.globalTableNumberingFontWeight);
    const globalTableFontStyle = useProjectStore(s => s.globalTableNumberingFontStyle);
    const globalTableTextDecoration = useProjectStore(s => s.globalTableNumberingTextDecoration);
    const globalTableColor = useProjectStore(s => s.globalTableNumberingColor);

    // Find the definition for this asset type
    const definition = ASSET_LIBRARY.find(item => item.id === asset.type);
    const isMarquee = definition?.category === 'Marquee';
    const assetPath = definition?.path ? encodeURI(definition.path) : null;
    const rasterAssetPath = definition?.path ? encodeURI(getRasterAssetPath(definition.path) || '') : null;

    const showHighlight = isSelected || isHovered;
    const highlightColor = isSelected ? '#3b82f6' : '#60a5fa';
    const defaultStrokeWidth = isPreview ? 0.4 : DEFAULT_ASSET_STROKE_WIDTH;
    const disableFastImageForAsset =
        !!definition?.path &&
        (
            definition.path.toLowerCase().includes('10 seater round table 02.svg') ||
            definition.path.toLowerCase().includes('6 seater l shaped sofa.svg')
        );
    const prefersLiveSvgAtDefaultStroke =
        !isPreview &&
        ((asset.strokeWidth !== undefined && Math.abs(asset.strokeWidth - DEFAULT_ASSET_STROKE_WIDTH) <= 0.001) ||
            asset.strokeWidth === undefined);
    const hasCustomSubColors = Boolean((asset as any).tableColor || (asset as any).chairColor);
    const canUseFastImage =
        !!assetPath &&
        !asset.isExploded &&
        !disableFastImageForAsset &&
        !prefersLiveSvgAtDefaultStroke &&
        !hasCustomSubColors &&
        canRenderAssetAsImage(asset, isPreview);
    const fastImageHref = canUseFastImage && rasterAssetPath && !rasterImageFailed ? rasterAssetPath : assetPath;

    useEffect(() => {
        setRasterImageFailed(false);
    }, [rasterAssetPath]);

    // Fetch SVG content
    useEffect(() => {
        if (!definition?.path) return;

        const currentW = asset.width;
        const currentH = asset.height;
        const hasLegacyTwentySeaterSize =
            asset.type === '20-seater-doughtnut-table' &&
            currentW !== undefined &&
            currentH !== undefined &&
            (
                (Math.abs(currentW - 23978) < 1 && Math.abs(currentH - 33854) < 1) ||
                (Math.abs(currentW - 4600) < 1 && Math.abs(currentH - 4600) < 1)
            );

        const needsDimensionRepair = !currentW || !currentH || hasLegacyTwentySeaterSize;

        if (canUseFastImage && !needsDimensionRepair) {
            setRawSvgContent(null);
            return;
        }

        const handleSvgText = (text: string) => {
            const metrics = getSvgMetrics(text);
            svgMetricsCache[definition.path] = metrics;
            setRawSvgContent(text);

            const svgWidth = metrics.shouldCropToContent ? metrics.contentWidth : metrics.artboardWidth;
            const svgHeight = metrics.shouldCropToContent ? metrics.contentHeight : metrics.artboardHeight;

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
                const hasLegacyTwentySeaterSize =
                    asset.type === '20-seater-doughtnut-table' &&
                    currentW !== undefined &&
                    currentH !== undefined &&
                    (
                        (Math.abs(currentW - 23978) < 1 && Math.abs(currentH - 33854) < 1) ||
                        (Math.abs(currentW - 4600) < 1 && Math.abs(currentH - 4600) < 1)
                    );
                const needsUpdate =
                    !currentW ||
                    !currentH ||
                    hasLegacyTwentySeaterSize ||
                    (metrics.shouldCropToContent && currentMatchesArtboard);

                if (needsUpdate) {
                    setTimeout(() => {
                        updateAsset(asset.id, { width: svgWidth, height: svgHeight });
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
    }, [assetPath, definition?.path, definition?.width, definition?.height, asset.id, asset.width, asset.height, asset.type, canUseFastImage, updateAsset]);

    // 1. Base SVG processing (Heavy - matches InlineSvg logic)
    const baseSvg = useMemo(() => {
        if (canUseFastImage) return null;
        if (!rawSvgContent || typeof window === 'undefined' || !definition?.path) return null;

        const cacheKey = `${definition.path}_workspace_v42_content_bounds_normalized`;
        if (processedSvgCache[cacheKey]) return processedSvgCache[cacheKey];

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
                    processedSvgCache[cacheKey] = result;
                    return result;
                }
            }

            // IMPORTANT:
            // Some QCAD SVGs put fill="none" on a parent <g>.
            // If we only set fill on the outer <svg>, that inner group blocks the fill,
            // so circles / auto-fill paths still render as unfilled.
            // Remove inherited fill/stroke blockers from containers only.
            doc.querySelectorAll("svg, g").forEach(container => {
                container.removeAttribute("fill");
                container.removeAttribute("stroke");
                container.removeAttribute("stroke-width");

                const styleAttr = container.getAttribute("style");
                if (styleAttr) {
                    const cleaned = styleAttr
                        .replace(/fill\s*:[^;]+;?/gi, "")
                        .replace(/stroke\s*:[^;]+;?/gi, "")
                        .replace(/stroke-width\s*:[^;]+;?/gi, "");

                    if (cleaned.trim()) container.setAttribute("style", cleaned);
                    else container.removeAttribute("style");
                }
            });

            let hasExplicitAutoFill = !!doc.querySelector('[id="auto-fill"], .auto-fill, [data-auto-fill="true"]');

            const styleId = "dynamic-asset-style";
            if (!doc.getElementById(styleId)) {
                const styleEl = doc.createElementNS("http://www.w3.org/2000/svg", "style");
                styleEl.setAttribute("id", styleId);
                const isLayoutAsset = definition?.category === "Layout";
                const vectorEffectRule = isLayoutAsset ? "" : "svg path, svg circle, svg rect, svg line, svg polyline, svg ellipse { vector-effect: non-scaling-stroke !important; }";
                styleEl.textContent = `${vectorEffectRule} svg .fill-none-el { fill: none !important; stroke: inherit !important; stroke-width: inherit !important; } svg .fill-inherit-el { fill: inherit !important; stroke: inherit !important; stroke-width: inherit !important; } svg .auto-fill-el { fill: inherit !important; stroke: none !important; } svg .stroke-top-layer { pointer-events: none; } svg .table-fill-el { fill: var(--table-color, inherit) !important; stroke: inherit !important; stroke-width: inherit !important; } svg .table-auto-fill-el { fill: var(--table-color, inherit) !important; stroke: none !important; } svg .chair-fill-el { fill: var(--chair-color, inherit) !important; stroke: inherit !important; stroke-width: inherit !important; } svg .chair-auto-fill-el { fill: var(--chair-color, inherit) !important; stroke: none !important; }`;
                svg.prepend(styleEl);
            }

            // Auto-generate auto-fill rect for SVGs that have no fillable elements
            // (e.g. QCAD wireframe exports with only open paths). Adds a fillable
            // background rect so fill/stroke controls work without editing the SVG.
            if (!hasExplicitAutoFill && definition?.path && (
                definition.path.toLowerCase().includes('seater') ||
                definition.path.toLowerCase().includes('sofa') ||
                definition.path.toLowerCase().includes('doughtnut') ||
                definition.path.toLowerCase().includes('chair') ||
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


            const children = Array.from(doc.querySelectorAll('path, circle, rect, line, polyline, ellipse'));
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

                let shouldBeNone = wasExplicitlyNone || isLineElement || isOpenPath;

                if (hasExplicitAutoFill && tag === 'path' && !isAutoFill) {
                    shouldBeNone = true;
                }

                if (!isFurniture) {
                    const isConsentricOuter = tag === 'circle' && circles.length > 1 && !innerCircles.has(el);
                    if (isConsentricOuter) {
                        shouldBeNone = true;
                    }
                }

                if (shouldBeNone && !hasFillRule && !isAutoFill) {
                    el.classList.add("fill-none-el");
                } else if (isMultiSeater) {
                    const elMetrics = getElementMetrics(el);
                    let isTable = false;
                    if (elMetrics) {
                        const distToCenter = Math.hypot(elMetrics.cx - contentCenterX, elMetrics.cy - contentCenterY);
                        const isCentral = distToCenter < contentWidth * 0.15;
                        const isVeryLarge = elMetrics.width > contentWidth * 0.4 || elMetrics.height > contentHeight * 0.4;
                        isTable = (isCentral || isVeryLarge) && getGDepth(el) < 3;
                    }
                    if (isTable) {
                        el.classList.add(isAutoFill ? "table-auto-fill-el" : "table-fill-el");
                    } else {
                        el.classList.add(isAutoFill ? "chair-auto-fill-el" : "chair-fill-el");
                    }
                } else if (isAutoFill) {
                    el.classList.add("auto-fill-el");
                } else {
                    el.classList.add("fill-inherit-el");
                }
            });

            // ── Z-ORDER FIX ─────────────────────────────────────────────────────────
            // Move details to top layer
            const rootGroup = svg.querySelector('g');
            if (rootGroup && !hasExplicitAutoFill) {
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
            svg.removeAttribute("stroke-width");
            svg.removeAttribute("width");
            svg.removeAttribute("height");
            if (metrics.shouldCropToContent && metrics.contentX !== null && metrics.contentY !== null && metrics.contentWidth && metrics.contentHeight) {
                svg.setAttribute("viewBox", `${metrics.contentX} ${metrics.contentY} ${metrics.contentWidth} ${metrics.contentHeight}`);
            }

            const result = new XMLSerializer().serializeToString(doc);
            processedSvgCache[cacheKey] = result;
            return result;
        } catch (e) {
            console.error("Error processing base SVG in AssetRenderer", e);
            return rawSvgContent;
        }
    }, [rawSvgContent, definition?.path, asset.type, canUseFastImage]);

    // 2. Fill resolution logic
    const currentFill = useMemo(() => {
        let fill = asset.fillColor || 'transparent'; // Standard default
        const a = asset as any;
        if (a.fillType === 'texture' || a.fillType === 'hatch' || a.fillType === 'hash') {
            const scale = a.fillTextureScale || 4;
            const thickness = a.fillTextureThickness || 1;
            if (a.fillTexture) {
                const rotation = a.hatchRotation || 0;
                return `url(#${a.fillTexture}-scale-${scale}-thick-${thickness}-rot-${rotation})`;
            }
        }
        return fill;
    }, [asset.fillColor, (asset as any).fillType, (asset as any).fillTexture, (asset as any).fillTextureScale, (asset as any).fillTextureThickness]);

    const currentStroke = asset.strokeColor || '#000000';
    const currentStrokeWidth = asset.strokeWidth !== undefined ? asset.strokeWidth : defaultStrokeWidth;
    const displayWidth = asset.width || definition?.width || 100;
    const displayHeight = asset.height || definition?.height || 100;

    // 3. Final Instance Processing
    const processedSvg = useMemo(() => {
        if (canUseFastImage) return null;
        if (!baseSvg) return null;

        return baseSvg.replace(/<svg([^>]*)>/i, (_match, attrs) => {
            const cleanAttrs = attrs
                .replace(/\s+width\s*=\s*["'][^"']*["']/gi, '')
                .replace(/\s+height\s*=\s*["'][^"']*["']/gi, '')
                .replace(/\s+x\s*=\s*["'][^"']*["']/gi, '')
                .replace(/\s+y\s*=\s*["'][^"']*["']/gi, '')
                .replace(/\s+fill\s*=\s*["'][^"']*["']/gi, '')
                .replace(/\s+stroke\s*=\s*["'][^"']*["']/gi, '');

            return `<svg${cleanAttrs} fill="${currentFill}" stroke="${currentStroke}" stroke-width="${currentStrokeWidth}" width="${displayWidth}" height="${displayHeight}" x="${-displayWidth / 2}" y="${-displayHeight / 2}" preserveAspectRatio="none" style="overflow: visible; pointer-events: none; width:100%; height:100%;">`;
        });
    }, [baseSvg, canUseFastImage, currentFill, currentStroke, currentStrokeWidth, displayWidth, displayHeight]);

    if (asset.isExploded) return null;
    const rotation = asset.rotation || 0;
    const baseScale = asset.scale !== undefined ? asset.scale : 1;
    const scaleX = (asset as any).flipX ? -baseScale : baseScale;
    const scaleY = (asset as any).flipY ? -baseScale : baseScale;
    const transform = `translate(${asset.x}, ${asset.y}) rotate(${rotation}) scale(${scaleX}, ${scaleY})`;


    return (
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
                    {processedSvg ? (
                        <g
                            dangerouslySetInnerHTML={{ __html: processedSvg }}
                            style={{ filter: 'none' }}
                        />
                    ) : (
                        fastImageHref && (
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
                        )
                    )}

                    <rect
                        x={-(asset.width || 100) / 2}
                        y={-(asset.height || 100) / 2}
                        width={asset.width || 100}
                        height={asset.height || 100}
                        fill="transparent"
                        stroke="none"
                        pointerEvents={definition?.category === 'Marquee' ? 'none' : 'all'}
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

                    {asset.tableName && (
                        (() => {
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

                            switch (pos) {
                                case 'top': ty = -halfH - padding; break;
                                case 'bottom': ty = halfH + padding; break;
                                case 'top-left': tx = -halfW; ty = -halfH - padding; break;
                                case 'top-right': tx = halfW; ty = -halfH - padding; break;
                                case 'bottom-left': tx = -halfW; ty = halfH + padding; break;
                                case 'bottom-right': tx = halfW; ty = halfH + padding; break;
                                case 'middle-left': tx = -halfW - padding; break;
                                case 'middle-right': tx = halfW + padding; break;
                                default: break; // center
                            }

                            let finalRotation = -rotation;
                            if (orientation === 'vertical') {
                                finalRotation += 90;
                            }

                            return (
                                <g transform={`translate(${tx}, ${ty}) rotate(${finalRotation})`}>
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
                        })()
                    )}
                </>
            )}
        </g>
    );
};

// Exporting as a named constant that is memoized
const AssetRenderer = React.memo(AssetRendererBase);

// Set display name for better debugging
AssetRenderer.displayName = 'AssetRenderer';

export default AssetRenderer;
