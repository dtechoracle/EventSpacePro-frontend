"use client";

import React from 'react';
import { useSceneStore } from '@/store/sceneStore';
import { Asset } from '@/store/projectStore';
import { ASSET_LIBRARY } from '@/lib/assets';

// Helper to extract dimensions from SVG string
function getSvgSize(svgText: string) {
    const widthMatch = svgText.match(/width=["']([\d.]+)["']/);
    const heightMatch = svgText.match(/height=["']([\d.]+)["']/);
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

            // If the asset in the store has no dimensions (or they differ significantly), update the store.
            // This ensures the asset uses the "real" SVG size.
            if (svgWidth && svgHeight) {
                const currentW = asset.width;
                const currentH = asset.height;

                // Check if update is needed (if missing or different by > 1px)
                const needsUpdate = !currentW || !currentH ||
                    Math.abs(currentW - svgWidth) > 1 ||
                    Math.abs(currentH - svgHeight) > 1;

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

        fetch(definition.path)
            .then(res => res.text())
            .then(text => {
                svgCache[definition.path] = text;
                handleSvgText(text);
            })
            .catch(err => console.error("Failed to load SVG", err));
    }, [definition?.path, asset.id, asset.width, asset.height, updateAsset]);

    // Process SVG content
    const processedSvg = React.useMemo(() => {
        if (!svgContent) return null;
        let svg = svgContent;
        const uniqueId = `asset-svg-${asset.id}`;

        // Inject width, height, x, y, id and preserveAspectRatio into the root svg tag
        // We remove existing width/height/x/y to avoid conflicts
        svg = svg.replace(/<svg([^>]*)>/, (match, attrs) => {
            let newAttrs = attrs.replace(/\s(width|height|x|y|id)="[^"]*"/gi, '');

            // Build attributes string
            let style = "overflow: visible;";
            if (asset.fillColor) style += ` fill: ${asset.fillColor};`;
            if (asset.strokeColor) style += ` stroke: ${asset.strokeColor}; color: ${asset.strokeColor};`; // Set color for currentColor
            if (asset.strokeWidth) style += ` stroke-width: ${asset.strokeWidth};`;

            let injectedAttrs = ` id="${uniqueId}" style="${style}"`;

            // Only inject width/height if they are defined
            if (asset.width && asset.height) {
                injectedAttrs += ` width="${asset.width}" height="${asset.height}" x="${-asset.width / 2}" y="${-asset.height / 2}" preserveAspectRatio="none"`;
            } else {
                // If dimensions are missing, we don't inject width/height/x/y
                // The SVG will render at its intrinsic size.
            }

            return `<svg${newAttrs}${injectedAttrs}>`;
        });

        // Force fully override attributes to ensure colors are applied
        if (asset.fillColor) {
            svg = svg.replace(/fill="([^"]*)"/gi, (match, value) => value === 'none' ? match : `fill="${asset.fillColor}"`);
            svg = svg.replace(/fill='([^']*)'/gi, (match, value) => value === 'none' ? match : `fill='${asset.fillColor}'`);
        }
        if (asset.strokeColor) {
            svg = svg.replace(/stroke="([^"]*)"/gi, (match, value) => value === 'none' ? match : `stroke="${asset.strokeColor}"`);
            svg = svg.replace(/stroke='([^']*)'/gi, (match, value) => value === 'none' ? match : `stroke='${asset.strokeColor}'`);
        }
        if (asset.strokeWidth) {
            svg = svg.replace(/stroke-width="([^"]*)"/gi, `stroke-width="${asset.strokeWidth}"`);
            svg = svg.replace(/stroke-width='([^']*)'/gi, `stroke-width='${asset.strokeWidth}'`);
        }

        return svg;
    }, [svgContent, asset.width, asset.height, asset.fillColor, asset.strokeColor, asset.strokeWidth, asset.id]);

    if (asset.isExploded) return null;
    const transform = `translate(${asset.x}, ${asset.y}) rotate(${asset.rotation}) scale(${asset.scale})`;

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
