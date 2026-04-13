"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useSceneStore } from '@/store/sceneStore';
import { Asset, useProjectStore } from '@/store/projectStore';
import { ASSET_LIBRARY } from '@/lib/assets';

// Global cache for SVGs - defined at module top level to prevent ReferenceErrors during evaluation
const svgCache: Record<string, string> = {};
const processedSvgCache: Record<string, string> = {};

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
    const [rawSvgContent, setRawSvgContent] = useState<string | null>(null);
    const updateAsset = useSceneStore(s => s.updateAsset);
    
    // Global numbering settings from store
    const globalPos = useProjectStore(s => s.globalTableNumberingPosition);
    const globalOrientation = useProjectStore(s => s.globalTableNumberingOrientation);

    // Find the definition for this asset type
    const definition = ASSET_LIBRARY.find(item => item.id === asset.type);
    const isMarquee = definition?.category === 'Marquee';
    const assetPath = definition?.path ? encodeURI(definition.path) : null;

    const showHighlight = isSelected || isHovered;
    const highlightColor = isSelected ? '#3b82f6' : '#60a5fa';

    // Fetch SVG content
    useEffect(() => {
        if (!definition?.path) return;

        const handleSvgText = (text: string) => {
            setRawSvgContent(text);

            // Extract dimensions from the SVG itself
            const { width: svgWidth, height: svgHeight } = getSvgSize(text);

            if (svgWidth && svgHeight) {
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
                const needsUpdate = !currentW || !currentH || hasLegacyTwentySeaterSize;

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

        fetch(assetPath || definition.path)
            .then(res => res.text())
            .then(text => {
                svgCache[definition.path] = text;
                handleSvgText(text);
            })
            .catch(err => console.error("Failed to load SVG", err));
    }, [assetPath, definition?.path, definition?.width, definition?.height, asset.id, asset.width, asset.height, updateAsset]);

    // 1. Base SVG processing (Heavy - matches InlineSvg logic)
    const baseSvg = useMemo(() => {
        if (!rawSvgContent || typeof window === 'undefined' || !definition?.path) return null;

        const cacheKey = `${definition.path}_workspace`;
        if (processedSvgCache[cacheKey]) return processedSvgCache[cacheKey];

        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(rawSvgContent, "image/svg+xml");
            const svg = doc.querySelector("svg");
            if (!svg) return rawSvgContent;

            const styleId = "dynamic-asset-style";
            if (!doc.getElementById(styleId)) {
                const styleEl = doc.createElementNS("http://www.w3.org/2000/svg", "style");
                styleEl.setAttribute("id", styleId);
                styleEl.textContent = `* { vector-effect: non-scaling-stroke !important; } .fill-none-el { fill: none !important; } .fill-inherit-el { fill: inherit !important; stroke: inherit !important; stroke-width: inherit !important; } .stroke-top-layer { pointer-events: none; }`;
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
                const isAutoFill = el.getAttribute("id") === "auto-fill";
                
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

                let shouldBeNone = wasExplicitlyNone || isLineElement;
                
                if (!isFurniture) {
                    const isConsentricOuter = tag === 'circle' && circles.length > 1 && !innerCircles.has(el);
                    if (isOpenPath || isConsentricOuter) {
                        shouldBeNone = true;
                    }
                }

                if (shouldBeNone && !hasFillRule && !isAutoFill) {
                    el.classList.add("fill-none-el");
                } else {
                    el.classList.add("fill-inherit-el");
                }
            });

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
            svg.removeAttribute("stroke-width");
            svg.removeAttribute("width");
            svg.removeAttribute("height");

            const result = new XMLSerializer().serializeToString(doc);
            processedSvgCache[cacheKey] = result;
            return result;
        } catch (e) {
            console.error("Error processing base SVG in AssetRenderer", e);
            return rawSvgContent;
        }
    }, [rawSvgContent, definition?.path, asset.type]);

    // 2. Fill resolution logic
    const currentFill = useMemo(() => {
        let fill = asset.fillColor || 'transparent'; // Standard default
        const a = asset as any;
        if (a.fillType === 'texture' || a.fillType === 'hatch' || a.fillType === 'hash') {
            const scale = a.fillTextureScale || 4;
            const thickness = a.fillTextureThickness || 1;
            if (a.fillTexture) {
                return `url(#${a.fillTexture}-scale-${scale}-thick-${thickness})`;
            }
        }
        return fill;
    }, [asset.fillColor, (asset as any).fillType, (asset as any).fillTexture, (asset as any).fillTextureScale, (asset as any).fillTextureThickness]);

    const currentStroke = asset.strokeColor || '#000000';
    const defaultStrokeWidth = isPreview ? 0.4 : 0.5;
    const currentStrokeWidth = asset.strokeWidth !== undefined ? asset.strokeWidth : defaultStrokeWidth;
    const displayWidth = asset.width || definition?.width || 100;
    const displayHeight = asset.height || definition?.height || 100;

    // 3. Final Instance Processing
    const processedSvg = useMemo(() => {
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
    }, [baseSvg, currentFill, currentStroke, currentStrokeWidth, displayWidth, displayHeight]);

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
                        assetPath && (
                            <image
                                href={assetPath}
                                x={-displayWidth / 2}
                                y={-displayHeight / 2}
                                width={displayWidth}
                                height={displayHeight}
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
