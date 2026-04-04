"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useSceneStore } from '@/store/sceneStore';
import { Asset, useProjectStore } from '@/store/projectStore';
import { ASSET_LIBRARY } from '@/lib/assets';

// Global cache for SVGs - defined at module top level to prevent ReferenceErrors during evaluation
const svgCache: Record<string, string> = {};

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
    isSelected?: boolean;
    isHovered?: boolean;
    isHighlightOnly?: boolean;
    isPreview?: boolean;
    onMouseEnter?: (name: string) => void;
    onMouseLeave?: () => void;
}

const AssetRendererBase = ({ asset, isSelected = false, isHovered = false, isHighlightOnly = false, isPreview, onMouseEnter, onMouseLeave }: AssetRendererProps) => {
    const [svgContent, setSvgContent] = useState<string | null>(null);
    const updateAsset = useSceneStore(s => s.updateAsset);
    
    // Global numbering settings from store
    const globalPos = useProjectStore(s => s.globalTableNumberingPosition);
    const globalOrientation = useProjectStore(s => s.globalTableNumberingOrientation);

    // Find the definition for this asset type
    const definition = ASSET_LIBRARY.find(item => item.id === asset.type);

    const showHighlight = isSelected || isHovered;
    const highlightColor = isSelected ? '#3b82f6' : '#60a5fa';

    // Fetch SVG content
    useEffect(() => {
        if (!definition?.path) return;

        const handleSvgText = (text: string) => {
            setSvgContent(text);

            // Extract dimensions from the SVG itself
            const { width: svgWidth, height: svgHeight } = getSvgSize(text);

            if (svgWidth && svgHeight) {
                const currentW = asset.width;
                const currentH = asset.height;
                const needsUpdate = !currentW || !currentH;

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

        fetch(encodeURI(definition.path))
            .then(res => res.text())
            .then(text => {
                svgCache[definition.path] = text;
                handleSvgText(text);
            })
            .catch(err => console.error("Failed to load SVG", err));
    }, [definition?.path, asset.id, asset.width, asset.height, updateAsset]);

    const baseSvg = useMemo(() => {
        if (!svgContent || typeof window === 'undefined') return null;

        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(svgContent, "image/svg+xml");
            const svg = doc.querySelector("svg");
            if (!svg) return svgContent;

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

                const wasExplicitlyNone = fillAttr === 'none' || (styleAttr && /fill\s*:\s*none/i.test(styleAttr));
                const isLineElement = tag === 'line' || tag === 'polyline';
                const hasFillRule = el.hasAttribute("fill-rule") || (styleAttr && /fill-rule/i.test(styleAttr));
                const isClosed = dAttr.toLowerCase().includes('z');
                const isOpenPath = tag === 'path' && !isClosed;
                const isAutoFill = el.getAttribute("id") === "auto-fill";

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

                if ((wasExplicitlyNone || isLineElement || isOpenPath) && !hasFillRule && !isAutoFill) {
                    el.classList.add("fill-none-el");
                } else {
                    el.classList.add("fill-inherit-el");
                }
            });

            // ── Z-ORDER FIX ─────────────────────────────────────────────────────────
            // Some CAD-exported SVGs (e.g. QCAD) emit chair detail stroke-groups
            // BEFORE the chair seat closed-path. When the seat gets a fill colour it
            // paints over the earlier detail strokes. To always keep detail/stroke-only
            // elements visible, gather every fill-none-el leaf element and move it into
            // a single new <g> appended LAST inside the root SVG group — so they always
            // render on top of any filled shapes regardless of source order.
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
            svg.removeAttribute("stroke-width");
            svg.removeAttribute("width");
            svg.removeAttribute("height");

            return new XMLSerializer().serializeToString(doc);
        } catch (e) {
            console.error("Error processing base SVG in AssetRenderer", e);
            return svgContent;
        }
    }, [svgContent]);

    // Fill resolution logic
    const currentFill = useMemo(() => {
        let fill = asset.fillColor || 'none';
        const a = asset as any;
        if (a.fillType === 'texture' || a.fillType === 'hatch') {
            const scale = a.fillTextureScale || 4;
            const thickness = a.fillTextureThickness || 1;
            if (a.fillTexture) {
                return `url(#${a.fillTexture}-scale-${scale}-thick-${thickness})`;
            }
        }
        return fill;
    }, [asset.fillColor, (asset as any).fillType, (asset as any).fillTexture, (asset as any).fillTextureScale, (asset as any).fillTextureThickness]);

    const processedSvg = useMemo(() => {
        if (!baseSvg) return null;

        const currentStroke = asset.strokeColor || '#000000';
        const defaultStrokeWidth = isPreview ? 0.4 : 0.5;
        const currentStrokeWidth = asset.strokeWidth !== undefined ? asset.strokeWidth : defaultStrokeWidth;

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
    }, [baseSvg, asset.fillColor, asset.strokeColor, asset.strokeWidth, asset.width, asset.height, isPreview, (asset as any).fillType, (asset as any).fillTexture, (asset as any).fillTextureScale, (asset as any).fillTextureThickness]);

    if (asset.isExploded) return null;
    const rotation = asset.rotation || 0;
    const scale = asset.scale !== undefined ? asset.scale : 1;
    const transform = `translate(${asset.x}, ${asset.y}) rotate(${rotation}) scale(${scale})`;

    return (
        <g
            transform={transform}
            style={{ cursor: 'pointer' }}
            onMouseEnter={() => definition && onMouseEnter?.(definition.label)}
            onMouseLeave={() => onMouseLeave?.()}
            data-id={asset.id}
        >
            {/* IN HIGHLIGHT ONLY MODE: Skip expensive SVG logic, just render the glow */}
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
                        definition?.path && (
                            <image
                                href={definition.path}
                                x={-asset.width / 2}
                                y={-asset.height / 2}
                                width={asset.width}
                                height={asset.height}
                                style={{ outline: 'none', filter: 'none' }}
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
                                strokeWidth={asset.strokeWidth || 1}
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
                                        fontSize={Math.max(14, (asset.width || 100) * 0.14)}
                                        fill="#000000"
                                        fontWeight="900"
                                        pointerEvents="none"
                                        style={{
                                            userSelect: 'none',
                                            fontFamily: 'Inter, sans-serif'
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
