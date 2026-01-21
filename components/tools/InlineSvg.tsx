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

            // "Scorched Earth" Policy: Recursively strip ALL paint attributes from EVERY element
            const allElements = doc.querySelectorAll('*');
            allElements.forEach(el => {
                // 1. Remove direct attributes ONLY if we have an override
                if (fill !== undefined) el.removeAttribute("fill");
                if (stroke !== undefined) el.removeAttribute("stroke");
                if (strokeWidth !== undefined) el.removeAttribute("stroke-width");

                // 2. Clean 'style' attribute of any paint properties
                const style = el.getAttribute("style");
                if (style) {
                    let cleanedStyle = style;

                    if (fill !== undefined) {
                        cleanedStyle = cleanedStyle.replace(/fill\s*:[^;]+;?/gi, "");
                    }
                    if (stroke !== undefined) {
                        cleanedStyle = cleanedStyle.replace(/stroke\s*:[^;]+;?/gi, "");
                    }
                    if (strokeWidth !== undefined) {
                        cleanedStyle = cleanedStyle.replace(/stroke-width\s*:[^;]+;?/gi, "");
                    }

                    if (cleanedStyle !== style) {
                        if (cleanedStyle.trim()) {
                            el.setAttribute("style", cleanedStyle);
                        } else {
                            el.removeAttribute("style");
                        }
                    }
                }
            });

            // 3. Apply dynamic values to the ROOT SVG element ONLY (cascading style)
            // This ensures the external props control the entire SVG
            if (fill !== undefined) svg.setAttribute("fill", fill);
            if (stroke !== undefined) svg.setAttribute("stroke", stroke);
            if (strokeWidth !== undefined) svg.setAttribute("stroke-width", String(strokeWidth));

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
