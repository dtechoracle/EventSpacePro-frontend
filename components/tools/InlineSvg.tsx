import React, { useState, useEffect, useMemo } from "react";

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

    // 1. Base SVG processing (Heavy - runs once per unique SVG content)
    const baseSvg = useMemo(() => {
        if (!rawSvg || typeof window === "undefined") return "";
        
        // Cache check: src is our stable key for the raw content
        if (processedSvgCache[src]) return processedSvgCache[src];

        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(rawSvg, "image/svg+xml");
            const svg = doc.querySelector("svg");
            if (!svg) return rawSvg;

            const styleId = "dynamic-inline-style";
            if (!doc.getElementById(styleId)) {
                const styleEl = doc.createElementNS("http://www.w3.org/2000/svg", "style");
                styleEl.setAttribute("id", styleId);
                styleEl.textContent = `* { vector-effect: non-scaling-stroke !important; } .fill-none-el { fill: none !important; stroke: inherit !important; stroke-width: inherit !important; } .fill-inherit-el { fill: inherit !important; stroke: inherit !important; stroke-width: inherit !important; }`;
                svg.prepend(styleEl);
            }

            const allElements = Array.from(doc.querySelectorAll('*'));
            
            // Optimization: Detect concentric circles to only fill the inner one
            const circles = allElements.filter(el => el.tagName.toLowerCase() === 'circle');
            const innerCircles = new Set<Element>();
            if (circles.length > 1) {
                circles.forEach(c1 => {
                    const cx1 = c1.getAttribute('cx');
                    const cy1 = c1.getAttribute('cy');
                    const r1 = parseFloat(c1.getAttribute('r') || '0');
                    
                    circles.forEach(c2 => {
                        if (c1 === c2) return;
                        const cx2 = c2.getAttribute('cx');
                        const cy2 = c2.getAttribute('cy');
                        const r2 = parseFloat(c2.getAttribute('r') || '0');
                        
                        if (cx1 === cx2 && cy1 === cy2) {
                            if (r1 < r2) innerCircles.add(c1);
                        }
                    });
                });
            }

            allElements.forEach(el => {
                const tag = el.tagName.toLowerCase();
                if (tag === 'svg' || tag === 'style') return;

                const fillAttr = el.getAttribute("fill");
                const styleAttr = el.getAttribute("style");
                const dAttr = el.getAttribute("d") || "";

                const wasExplicitlyNone = fillAttr === 'none' || (styleAttr && /fill\s*:\s*none/i.test(styleAttr));
                const isLineElement = tag === 'line' || tag === 'polyline';
                const hasFillRule = el.hasAttribute("fill-rule") || (styleAttr && /fill-rule/i.test(styleAttr));
                
                const dClean = dAttr.trim();
                const isZClosed = dClean.toLowerCase().includes('z');
                
                let isCoordClosed = false;
                if (!isZClosed && dClean.startsWith('M')) {
                    const firstMatch = dClean.match(/^M\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)/i);
                    const lastMatch = dClean.match(/(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*$/);
                    if (firstMatch && lastMatch) {
                        const startX = parseFloat(firstMatch[1]);
                        const startY = parseFloat(firstMatch[2]);
                        const endX = parseFloat(lastMatch[1]);
                        const endY = parseFloat(lastMatch[2]);
                        isCoordClosed = Math.abs(startX - endX) < 0.1 && Math.abs(startY - endY) < 0.1;
                    }
                }

                const isClosed = isZClosed || isCoordClosed;
                const isOpenPath = tag === 'path' && !isClosed;
                const isAutoFill = el.getAttribute("id") === "auto-fill";
                const isConsentricOuter = tag === 'circle' && circles.length > 1 && !innerCircles.has(el);

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

                if ((wasExplicitlyNone || isLineElement || isOpenPath || isConsentricOuter) && !hasFillRule && !isAutoFill) {
                    el.classList.add("fill-none-el");
                } else {
                    el.classList.add("fill-inherit-el");
                }
            });

            const allNodes = Array.from(doc.querySelectorAll('.fill-none-el'));
            allNodes.forEach(el => {
                if (el.parentNode && el.parentNode.nodeType === 1) { 
                    el.parentNode.appendChild(el);
                }
            });

            svg.removeAttribute("style");
            svg.removeAttribute("fill");
            svg.removeAttribute("stroke");
            svg.removeAttribute("stroke-width");
            svg.removeAttribute("width");
            svg.removeAttribute("height");

            const result = new XMLSerializer().serializeToString(doc);
            processedSvgCache[src] = result;
            return result;
        } catch (e) {
            console.error("Error parsing base SVG", e);
            return rawSvg;
        }
    }, [rawSvg, src]);

    const svgContent = useMemo(() => {
        if (!baseSvg) return "";

        const currentFill = fill ?? "transparent";
        const currentStroke = stroke ?? "#000000";
        const currentStrokeWidth = String(strokeWidth ?? 1.2);

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
