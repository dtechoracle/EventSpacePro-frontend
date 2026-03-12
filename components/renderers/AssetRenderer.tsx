"use client";

import React from 'react';
import { useSceneStore } from '@/store/sceneStore';
import { Asset } from '@/store/projectStore';
import { ASSET_LIBRARY } from '@/lib/assets';

// Helper to extract dimensions from SVG string
function getSvgSize(svgText: string) {
    const widthMatch = svgText.match(/width=["']([\d.]+)[a-z%]*["']/i);
    const heightMatch = svgText.match(/height=["']([\d.]+)[a-z%]*["']/i);
    const viewBoxMatch = svgText.match(/viewBox=["']([\d\s.-]+)["']/);

    let width = widthMatch ? parseFloat(widthMatch[1]) : null;
    let height = heightMatch ? parseFloat(heightMatch[1]) : null;

    if ((!width || !height) && viewBoxMatch) {
        const parts = viewBoxMatch[1].split(/\s+/).map(parseFloat);
        if (parts.length === 4) {
            width = width || parts[2];
            height = height || parts[3];
        }
    }

    return { width, height };
}

interface AssetRendererProps {
    asset: Asset;
    isSelected: boolean;
    isHovered: boolean;
}

export default function AssetRenderer({ asset, isSelected, isHovered }: AssetRendererProps) {
    const [svgContent, setSvgContent] = React.useState<string | null>(null);
    const updateAsset = useSceneStore(s => s.updateAsset);

    // Find the definition for this asset type
    const definition = ASSET_LIBRARY.find(item => item.id === asset.type);

    const showHighlight = isSelected || isHovered;
    const highlightColor = isSelected ? '#3b82f6' : '#60a5fa';

    // Fetch SVG content
    React.useEffect(() => {
        if (!definition?.path) return;

        const handleSvgText = (text: string) => {
            setSvgContent(text);

            // Extract dimensions from the SVG itself
            const { width: svgWidth, height: svgHeight } = getSvgSize(text);

            // If the asset in the store has no dimensions, update the store.
            // This ensures the asset uses the "real" SVG size only if no width/height was explicitly provided.
            if (svgWidth && svgHeight) {
                const currentW = asset.width;
                const currentH = asset.height;

                // Check if update is needed (only if missing)
                const needsUpdate = !currentW || !currentH;

                if (needsUpdate) {
                    console.log(`[AssetRenderer] Updating asset ${asset.id} dimensions from SVG: ${svgWidth}x${svgHeight}`);
                    // Use a timeout to avoid updating during render phase
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

        fetch(encodeURI(definition.path))
            .then(res => res.text())
            .then(text => {
                svgCache[definition.path] = text;
                handleSvgText(text);
            })
            .catch(err => console.error("Failed to load SVG", err));
    }, [definition?.path, asset.id, asset.width, asset.height, updateAsset]);

    // 1. Base SVG processing (Heavy - runs once per unique SVG content)
    // Tags each element with CSS classes based on STRUCTURAL properties only.
    // Color decisions happen in stage 2 via CSS inheritance from the root fill.
    const baseSvg = React.useMemo(() => {
        if (!svgContent || typeof window === 'undefined') return null;

        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(svgContent, "image/svg+xml");
            const svg = doc.querySelector("svg");
            if (!svg) return svgContent;

            // Inject CSS that handles inheritance and vector-effect in one pass
            const styleId = "dynamic-asset-style";
            if (!doc.getElementById(styleId)) {
                const styleEl = doc.createElementNS("http://www.w3.org/2000/svg", "style");
                styleEl.setAttribute("id", styleId);
                styleEl.textContent = `* { vector-effect: non-scaling-stroke !important; } .fill-none-el { fill: none !important; } .fill-inherit-el { fill: inherit !important; stroke: inherit !important; stroke-width: inherit !important; }`;
                svg.prepend(styleEl);
            }

            const allElements = Array.from(doc.querySelectorAll('*'));
            allElements.forEach(el => {
                const tag = el.tagName.toLowerCase();
                if (tag === 'svg' || tag === 'style') return;

                const fillAttr = el.getAttribute("fill");
                const styleAttr = el.getAttribute("style");
                const dAttr = el.getAttribute("d") || "";

                // Structural classification - does NOT depend on current fill color
                const wasExplicitlyNone = fillAttr === 'none' || (styleAttr && /fill\s*:\s*none/i.test(styleAttr));
                const isLineElement = tag === 'line' || tag === 'polyline';
                const hasFillRule = el.hasAttribute("fill-rule") || (styleAttr && /fill-rule/i.test(styleAttr));
                const isClosed = dAttr.toLowerCase().includes('z');
                const isOpenPath = tag === 'path' && !isClosed;
                const isAutoFill = el.getAttribute("id") === "auto-fill";

                // Strip hardcoded colors so CSS can take over
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

                // Class assignment based on STRUCTURE only. 
                // Transparent root fill + fill-inherit-el = correct transparent element.
                // Colored root fill + fill-inherit-el = correctly colored element.
                if ((wasExplicitlyNone || isLineElement || isOpenPath) && !hasFillRule && !isAutoFill) {
                    el.classList.add("fill-none-el");
                } else {
                    el.classList.add("fill-inherit-el");
                }
            });

            // Strip all paint from root SVG so stage 2 has full control
            svg.removeAttribute("style");
            svg.removeAttribute("fill");
            svg.removeAttribute("stroke");
            svg.removeAttribute("stroke-width");
            svg.removeAttribute("width");
            svg.removeAttribute("height");

            return new XMLSerializer().serializeToString(doc);
        } catch (e) {
            console.error("Error processing base SVG in AssetRenderer", e);
            return svgContent;
        }
    }, [svgContent]);

    // 2. Dynamic SVG processing (Light - string manipulation only)
    // Injects fill/stroke/dimensions directly into the root <svg> tag.
    // Since all child elements use fill:inherit, color changes are O(1).
    const processedSvg = React.useMemo(() => {
        if (!baseSvg) return null;

        const currentFill = asset.fillColor || 'none';
        const currentStroke = asset.strokeColor || '#000000';
        const currentStrokeWidth = asset.strokeWidth !== undefined ? asset.strokeWidth : 0.5;

        // Strip any stale width/height/x/y/fill/stroke from existing attrs to avoid conflicts,
        // then inject our precise pixel values so centering works correctly.
        return baseSvg.replace(/<svg([^>]*)>/i, (_match, attrs) => {
            const cleanAttrs = attrs
                .replace(/\s+width\s*=\s*["'][^"']*["']/gi, '')
                .replace(/\s+height\s*=\s*["'][^"']*["']/gi, '')
                .replace(/\s+x\s*=\s*["'][^"']*["']/gi, '')
                .replace(/\s+y\s*=\s*["'][^"']*["']/gi, '')
                .replace(/\s+fill\s*=\s*["'][^"']*["']/gi, '')
                .replace(/\s+stroke\s*=\s*["'][^"']*["']/gi, '');

            return `<svg${cleanAttrs} fill="${currentFill}" stroke="${currentStroke}" stroke-width="${currentStrokeWidth}" width="${asset.width || 100}" height="${asset.height || 100}" x="${-(asset.width || 0) / 2}" y="${-(asset.height || 0) / 2}" preserveAspectRatio="none" style="overflow: visible; pointer-events: none;">`;
        });
    }, [baseSvg, asset.fillColor, asset.strokeColor, asset.strokeWidth, asset.width, asset.height]);

    if (asset.isExploded) return null;
    const rotation = asset.rotation || 0;
    const scale = asset.scale !== undefined ? asset.scale : 1;
    const transform = `translate(${asset.x}, ${asset.y}) rotate(${rotation}) scale(${scale})`;

    return (
        <g transform={transform} style={{ cursor: 'pointer' }}>
            {/* Render Inline SVG */}
            {processedSvg ? (
                <g
                    dangerouslySetInnerHTML={{ __html: processedSvg }}
                    style={{
                        filter: showHighlight ? `drop-shadow(0 0 6px ${highlightColor}) drop-shadow(0 0 3px ${highlightColor}) drop-shadow(0 0 1px ${highlightColor})` : 'none'
                    }}
                />
            ) : (
                // Fallback to image if SVG not loaded yet or failed
                definition?.path && (
                    <image
                        href={definition.path}
                        x={-asset.width / 2}
                        y={-asset.height / 2}
                        width={asset.width}
                        height={asset.height}
                        style={{
                            outline: 'none',
                            filter: showHighlight ? `drop-shadow(0 0 6px ${highlightColor}) drop-shadow(0 0 3px ${highlightColor}) drop-shadow(0 0 1px ${highlightColor})` : 'none'
                        }}
                    />
                )
            )}

            {/* Invisible rect for hit-testing only (no visual outline) */}
            <rect
                x={-(asset.width || 0) / 2}
                y={-(asset.height || 0) / 2}
                width={asset.width || 0}
                height={asset.height || 0}
                fill="transparent"
                stroke="none"
                pointerEvents="all"
            />

            {/* Fallback label when definition is missing */}
            {!definition && (
                <text
                    x={0}
                    y={0}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={12}
                    fill="#374151"
                    pointerEvents="none"
                >
                    {asset.type}
                </text>
            )}
        </g>
    );
}

// Global cache for SVGs
const svgCache: Record<string, string> = {};
