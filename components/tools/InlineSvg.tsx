import React, { useState, useEffect, useMemo } from "react";

const svgCache: Record<string, string> = {};

type InlineSvgProps = {
    src: string;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
};

export const InlineSvg = ({ src, fill, stroke, strokeWidth }: InlineSvgProps) => {
    const [rawSvg, setRawSvg] = useState<string | null>(svgCache[src] || null);

    useEffect(() => {
        if (svgCache[src]) {
            setRawSvg(svgCache[src]);
            return;
        }

        let active = true;
        fetch(src)
            .then(res => res.text())
            .then(text => {
                if (!active) return;
                svgCache[src] = text;
                setRawSvg(text);
            })
            .catch(err => console.error("Failed to load SVG", src, err));
        return () => { active = false; };
    }, [src]);

    const svgContent = useMemo(() => {
        if (!rawSvg) return "";

        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(rawSvg, "image/svg+xml");

            const parserError = doc.querySelector("parsererror");
            if (parserError) return rawSvg;

            const svg = doc.querySelector("svg");
            if (!svg) return rawSvg;

            if (!svg.hasAttribute("width")) svg.setAttribute("width", "100%");
            if (!svg.hasAttribute("height")) svg.setAttribute("height", "100%");

            // "Scorched Earth" Policy: ALWAYS strip ALL paint attributes from EVERY element
            // This allows dynamic styling to work even when props are undefined
            const allElements = doc.querySelectorAll('*');
            allElements.forEach(el => {
                // Always remove hardcoded attributes to allow dynamic styling
                el.removeAttribute("fill");
                el.removeAttribute("stroke");
                el.removeAttribute("stroke-width");

                // Clean 'style' attribute of any paint properties
                const style = el.getAttribute("style");
                if (style) {
                    let cleanedStyle = style
                        .replace(/fill\s*:[^;]+;?/gi, "")
                        .replace(/stroke\s*:[^;]+;?/gi, "")
                        .replace(/stroke-width\s*:[^;]+;?/gi, "");

                    if (cleanedStyle.trim()) {
                        el.setAttribute("style", cleanedStyle);
                    } else {
                        el.removeAttribute("style");
                    }
                }
            });

            // Apply dynamic values to the ROOT SVG element ONLY (cascading style)
            // Use defaults if props are undefined to ensure visibility
            svg.setAttribute("fill", fill ?? "#000000");
            svg.setAttribute("stroke", stroke ?? "none");
            svg.setAttribute("stroke-width", String(strokeWidth ?? 0));

            return new XMLSerializer().serializeToString(doc);
        } catch (e) {
            console.error("Error parsing SVG", e);
            return rawSvg;
        }
    }, [rawSvg, fill, stroke, strokeWidth]);

    if (!svgContent) return null;
    return <div dangerouslySetInnerHTML={{ __html: svgContent }} style={{ width: '100%', height: '100%' }} />;
};

export default InlineSvg;
