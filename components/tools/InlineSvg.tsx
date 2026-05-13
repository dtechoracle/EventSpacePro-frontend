import React, { useState, useEffect, useMemo } from "react";
import { DEFAULT_ASSET_STROKE_WIDTH } from "@/utils/assetRenderMode";

const svgCache: Record<string, string> = {};
const processedSvgCache: Record<string, string> = {};

type InlineSvgProps = {
    src: string;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    category?: string;
};

export const InlineSvg = ({ src, fill, stroke, strokeWidth, category }: InlineSvgProps) => {
    const [rawSvg, setRawSvg] = useState<string | null>(svgCache[src] || null);

    useEffect(() => {
        if (svgCache[src]) {
            setRawSvg(svgCache[src]);
            return;
        }

        let active = true;
        fetch(encodeURI(src))
            .then(res => res.text())
            .then(text => {
                if (!active) return;
                svgCache[src] = text;
                setRawSvg(text);
            })
            .catch(err => console.error("Failed to load SVG", src, err));
        return () => { active = false; };
    }, [src]);

    // 1. Base SVG processing (Heavy - runs once per unique SVG content + category combination)
    const baseSvg = useMemo(() => {
        if (!rawSvg || typeof window === "undefined") return "";
        
        const cacheKey = `${src}_${category || 'none'}_v2_group_autofill`;
        if (processedSvgCache[cacheKey]) return processedSvgCache[cacheKey];

        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(rawSvg, "image/svg+xml");
            const svg = doc.querySelector("svg");
            if (!svg) return rawSvg;

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

    if (!svgContent) return null;

    return <div dangerouslySetInnerHTML={{ __html: svgContent }} style={{ width: '100%', height: '100%' }} />;
};

export default InlineSvg;
