import React, { useState, useEffect, useMemo } from "react";
import { DEFAULT_ASSET_STROKE_WIDTH } from "@/utils/assetRenderMode";

const svgCache: Record<string, string> = {};
const processedSvgCache: Record<string, string> = {};
const failedSvgCache: Record<string, true> = {};
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

const getSvgMetrics = (svgText: string): SvgMetrics => {
    const widthMatch = svgText.match(/width=["']([\d.]+)[a-z%]*["']/i);
    const heightMatch = svgText.match(/height=["']([\d.]+)[a-z%]*["']/i);
    const viewBoxMatch = svgText.match(/viewBox=["']([\d\s.,-]+)["']/i);

    let width = widthMatch ? parseFloat(widthMatch[1]) : null;
    let height = heightMatch ? parseFloat(heightMatch[1]) : null;
    let viewBoxX = 0;
    let viewBoxY = 0;

    if (viewBoxMatch) {
        const parts = viewBoxMatch[1].trim().split(/[\s,]+/).map(parseFloat);
        if (parts.length === 4 && parts.every(Number.isFinite)) {
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

    if (typeof document === "undefined") {
        return result;
    }

    const tempHost = document.createElement("div");
    tempHost.style.position = "absolute";
    tempHost.style.left = "-100000px";
    tempHost.style.top = "-100000px";
    tempHost.style.width = "0";
    tempHost.style.height = "0";
    tempHost.style.opacity = "0";
    tempHost.style.pointerEvents = "none";
    tempHost.style.overflow = "hidden";
    tempHost.innerHTML = svgText;
    document.body.appendChild(tempHost);

    try {
        const tempSvg = tempHost.querySelector("svg") as SVGSVGElement | null;
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

            const graphics = Array.from(tempSvg.querySelectorAll("*")).filter((node): node is SVGGraphicsElement => {
                if (!(node instanceof SVGGraphicsElement)) return false;
                if (node.closest("defs, clipPath, mask, pattern, marker, symbol, title, desc, style, script")) return false;
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

        return {
            artboardWidth: width,
            artboardHeight: height,
            contentX,
            contentY,
            contentWidth,
            contentHeight,
            shouldCropToContent:
                !width ||
                !height ||
                xOffset > 0.01 ||
                yOffset > 0.01 ||
                (widthRatio !== null && widthRatio < 0.95) ||
                (heightRatio !== null && heightRatio < 0.95),
        };
    } finally {
        tempHost.remove();
    }
};

export const isKnownMissingSvg = (src: string) => Boolean(failedSvgCache[src]);
export const validateSvgPath = async (src: string) => {
    if (!src) return false;
    if (svgCache[src]) return true;
    if (failedSvgCache[src]) return false;
    try {
        const res = await fetch(encodeURI(src));
        if (!res.ok) {
            failedSvgCache[src] = true;
            return false;
        }
        const text = await res.text();
        svgCache[src] = text;
        return true;
    } catch {
        failedSvgCache[src] = true;
        return false;
    }
};

type InlineSvgProps = {
    src: string;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    category?: string;
    onLoadError?: () => void;
};

export const InlineSvg = ({ src, fill, stroke, strokeWidth, category, onLoadError }: InlineSvgProps) => {
    const [rawSvg, setRawSvg] = useState<string | null>(svgCache[src] || null);
    const [loadFailed, setLoadFailed] = useState<boolean>(Boolean(failedSvgCache[src]));

    useEffect(() => {
        setLoadFailed(Boolean(failedSvgCache[src]));
        if (svgCache[src]) {
            setRawSvg(svgCache[src]);
            return;
        }
        if (failedSvgCache[src]) {
            setRawSvg(null);
            return;
        }

        let active = true;
        fetch(encodeURI(src))
            .then(res => {
                if (!res.ok) {
                    throw new Error(`Failed to load SVG: ${res.status}`);
                }
                return res.text();
            })
            .then(text => {
                if (!active) return;
                svgCache[src] = text;
                setRawSvg(text);
                setLoadFailed(false);
            })
            .catch(err => {
                failedSvgCache[src] = true;
                if (!active) return;
                console.warn("Missing or unreadable SVG asset", src, err);
                setRawSvg(null);
                setLoadFailed(true);
                onLoadError?.();
            });
        return () => { active = false; };
    }, [src, onLoadError]);

    // 1. Base SVG processing (Heavy - runs once per unique SVG content + category combination)
    const baseSvg = useMemo(() => {
        if (!rawSvg || typeof window === "undefined") return "";
        
        const cacheKey = `${src}_${category || 'none'}_v3_viewbox_normalized`;
        if (processedSvgCache[cacheKey]) return processedSvgCache[cacheKey];

        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(rawSvg, "image/svg+xml");
            const svg = doc.querySelector("svg");
            if (!svg) return rawSvg;
            const metrics = svgMetricsCache[src] || getSvgMetrics(rawSvg);
            svgMetricsCache[src] = metrics;

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

            const hasExplicitAutoFill = !!doc.querySelector('[id="auto-fill"], .auto-fill, [data-auto-fill="true"]');

            const styleId = "dynamic-inline-style";
            if (!doc.getElementById(styleId)) {
                const styleEl = doc.createElementNS("http://www.w3.org/2000/svg", "style");
                styleEl.setAttribute("id", styleId);
                styleEl.textContent = `* { vector-effect: non-scaling-stroke !important; } .fill-none-el { fill: none !important; stroke: inherit !important; stroke-width: inherit !important; } .fill-inherit-el { fill: inherit !important; stroke: inherit !important; stroke-width: inherit !important; } .auto-fill-el { fill: inherit !important; stroke: none !important; }`;
                svg.prepend(styleEl);
            }

            const children = Array.from(doc.querySelectorAll('path, circle, rect, line, polyline, ellipse'));
            const circles = Array.from(doc.querySelectorAll('circle'));
            const innerCircles = new Set();
            
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
                
                const catLower = (category || "").toLowerCase();
                const isFurniture = catLower === 'furniture' || catLower === 'structure' || catLower === 'furniture asset';

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
                } else if (isAutoFill) {
                    el.classList.add("auto-fill-el");
                } else {
                    el.classList.add("fill-inherit-el");
                }
            });

            if (!hasExplicitAutoFill) {
                const allNodes = Array.from(doc.querySelectorAll('.fill-none-el'));
                allNodes.forEach(el => {
                    if (el.parentNode && el.parentNode.nodeType === 1) {
                        el.parentNode.appendChild(el);
                    }
                });
            }

            svg.removeAttribute("style");
            svg.removeAttribute("fill");
            svg.removeAttribute("stroke");
            svg.removeAttribute("stroke-width");
            svg.removeAttribute("width");
            svg.removeAttribute("height");
            if (metrics.shouldCropToContent && metrics.contentX !== null && metrics.contentY !== null && metrics.contentWidth && metrics.contentHeight) {
                svg.setAttribute("viewBox", `${metrics.contentX} ${metrics.contentY} ${metrics.contentWidth} ${metrics.contentHeight}`);
            } else if (!svg.getAttribute("viewBox") && metrics.artboardWidth && metrics.artboardHeight) {
                svg.setAttribute("viewBox", `0 0 ${metrics.artboardWidth} ${metrics.artboardHeight}`);
            }

            const result = new XMLSerializer().serializeToString(doc);
            processedSvgCache[cacheKey] = result;
            return result;
        } catch (e) {
            console.error("Error parsing base SVG", e);
            return rawSvg;
        }
    }, [rawSvg, src, category]);

    // 2. Instance-specific processing (Light - runs every render)
    const svgContent = useMemo(() => {
        if (!baseSvg) return "";

        const currentFill = fill ?? "transparent";
        const currentStroke = stroke ?? "#000000";
        const currentStrokeWidth = String(strokeWidth ?? DEFAULT_ASSET_STROKE_WIDTH);

        return baseSvg.replace(/<svg([^>]*)>/i, (_match: string, attrs: string) => {
            const cleanAttrs = attrs
                .replace(/\s+width\s*=\s*["'][^"']*["']/gi, '')
                .replace(/\s+height\s*=\s*["'][^"']*["']/gi, '')
                .replace(/\s+fill\s*=\s*["'][^"']*["']/gi, '')
                .replace(/\s+stroke\s*=\s*["'][^"']*["']/gi, '');
            return `<svg${cleanAttrs} fill="${currentFill}" stroke="${currentStroke}" stroke-width="${currentStrokeWidth}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style="display:block;width:100%;height:100%;">`;
        });
    }, [baseSvg, fill, stroke, strokeWidth]);

    if (!svgContent) {
        if (!loadFailed) return null;
        const fallbackStroke = stroke ?? "#94a3b8";
        return (
            <svg viewBox="0 0 64 64" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style={{ display: 'block', width: '100%', height: '100%' }}>
                <rect x="10" y="10" width="44" height="44" rx="8" ry="8" fill="none" stroke={fallbackStroke} strokeWidth="3" strokeDasharray="4 4" />
                <path d="M18 46 L46 18" fill="none" stroke={fallbackStroke} strokeWidth="3" strokeLinecap="round" />
            </svg>
        );
    }

    return <div dangerouslySetInnerHTML={{ __html: svgContent }} style={{ width: '100%', height: '100%' }} />;
};

export default InlineSvg;
