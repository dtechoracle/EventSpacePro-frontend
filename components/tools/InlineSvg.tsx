import React, { useState, useEffect, useMemo } from "react";

const svgCache: Record<string, string> = {};

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
    // Classes are assigned based on STRUCTURAL properties only (open path? line element?).
    // The actual fill color is NOT consulted here, so baseSvg never goes stale when fill changes.
    const baseSvg = useMemo(() => {
        if (!rawSvg || typeof window === "undefined") return "";

        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(rawSvg, "image/svg+xml");
            const svg = doc.querySelector("svg");
            if (!svg) return rawSvg;

            const styleId = "dynamic-inline-style";
            if (!doc.getElementById(styleId)) {
                const styleEl = doc.createElementNS("http://www.w3.org/2000/svg", "style");
                styleEl.setAttribute("id", styleId);
                styleEl.textContent = `* { vector-effect: non-scaling-stroke !important; } .fill-none-el { fill: none !important; } .fill-inherit-el { fill: inherit !important; stroke: inherit !important; stroke-width: inherit !important; }`;
                svg.prepend(styleEl);
            }

            const allElements = doc.querySelectorAll('*');
            allElements.forEach(el => {
                const tag = el.tagName.toLowerCase();
                if (tag === 'svg' || tag === 'style') return;

                const fillAttr = el.getAttribute("fill");
                const styleAttr = el.getAttribute("style");
                const dAttr = el.getAttribute("d") || "";

                // Structural classification only - does NOT depend on the fill prop
                const wasExplicitlyNone = fillAttr === 'none' || (styleAttr && /fill\s*:\s*none/i.test(styleAttr));
                const isLineElement = tag === 'line' || tag === 'polyline';
                const hasFillRule = el.hasAttribute("fill-rule") || (styleAttr && /fill-rule/i.test(styleAttr));
                const isClosed = dAttr.toLowerCase().includes('z');
                const isOpenPath = tag === 'path' && !isClosed;
                const isAutoFill = el.getAttribute("id") === "auto-fill";

                // Strip hardcoded colors so CSS inheritance takes over
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

                // Structural class assignment:
                // fill-none-el  → always no fill (lines, open arcs)
                // fill-inherit-el → inherits fill from root svg (solid shapes)
                if ((wasExplicitlyNone || isLineElement || isOpenPath) && !hasFillRule && !isAutoFill) {
                    el.classList.add("fill-none-el");
                } else {
                    el.classList.add("fill-inherit-el");
                }
            });

            // Remove all paint attrs from root - stage 2 owns these
            svg.removeAttribute("style");
            svg.removeAttribute("fill");
            svg.removeAttribute("stroke");
            svg.removeAttribute("stroke-width");
            svg.removeAttribute("width");
            svg.removeAttribute("height");

            return new XMLSerializer().serializeToString(doc);
        } catch (e) {
            console.error("Error parsing base SVG", e);
            return rawSvg;
        }
    }, [rawSvg]);

    // 2. Dynamic SVG processing (Light - O(1) string replacement)
    // Sets fill/stroke on the root <svg>. CSS inheritance cascades to all fill-inherit-el children.
    const svgContent = useMemo(() => {
        if (!baseSvg) return "";

        const currentFill = fill ?? "transparent";
        const currentStroke = stroke ?? "#000000";
        const currentStrokeWidth = String(strokeWidth ?? 1.2);

        return baseSvg.replace(/<svg([^>]*)>/i, (_match, attrs) => {
            // Strip any stale width/height/fill/stroke to prevent conflicts with our values
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
