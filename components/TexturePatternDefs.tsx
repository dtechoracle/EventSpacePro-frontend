import React, { useMemo } from 'react';
import { texturePatterns } from '@/utils/texturePatterns';
import { useProjectStore } from '@/store/projectStore';

/**
 * TexturePatternDefs component
 * Renders SVG pattern definitions for texture fills
 * Supports dynamic scaling based on usage in the scene
 */
export default function TexturePatternDefs() {
    const { shapes, walls } = useProjectStore();

    // 1. Identify all unique scales used for each pattern ID in the scene
    const usedScales = useMemo(() => {
        const scales = new Map<string, Set<number>>();

        // Helper
        const addScale = (textureId: string | undefined, scale: number | undefined) => {
            if (!textureId) return;
            if (!scales.has(textureId)) scales.set(textureId, new Set());
            // Default scale is 1 if undefined
            scales.get(textureId)!.add(scale || 1);
        };

        // Check shapes
        shapes.forEach(shape => {
            if (shape.fillType === 'texture' && shape.fillTexture) {
                addScale(shape.fillTexture, shape.fillTextureScale);
            }
        });

        // Check walls
        walls.forEach(wall => {
            if (wall.fillType === 'texture' && wall.fillTexture) {
                addScale(wall.fillTexture, wall.fillTextureScale);
            }
        });

        // Ensure default scale 1 is always available for all patterns (for palette previews etc)
        texturePatterns.forEach(p => addScale(p.id, 1));

        return scales;
    }, [shapes, walls]);


    // 2. Generate pattern variants
    const patternVariants = useMemo(() => {
        const variants: React.ReactNode[] = [];

        texturePatterns.forEach(pattern => {
            const patternScales = usedScales.get(pattern.id) || new Set([1]);

            patternScales.forEach(scale => {
                const scaledId = `${pattern.id}-scale-${scale}`;

                // Base size is 256 for grass/sand, but we need to check the SVG content or standardize
                // Most texturePatterns in utils have viewBox="0 0 256 256" implicitly or explicitly
                // We'll trust the pattern definition
                // BUT: To scale a pattern in SVG, we use patternTransform="scale(S)"
                // Note: unique ID is required

                if (pattern.id === 'grass' || pattern.id === 'sand') {
                    // Special procedural patterns
                    // We need to clone the logic but apply scale
                    // Ideally we'd refactor grass/sand to be part of the standard list, but they have complex filters
                    // For now, let's just support scaling them if they were in the standard list,
                    // but since they are hardcoded below, we handle them separately or refactor.
                    // Refactoring them to be generated variants is better.
                } else {
                    // Standard SVG string patterns
                    // We need to inject the ID and patternTransform
                    // The stored SVG string usually contains <pattern id="...">...</pattern>
                    // We need to parse/replace it.
                    // This is brittle with Regex. A better approach in `utils/texturePatterns` would be returning the inner content.
                    // Assuming `pattern.svg` is the `<pattern ...> ... </pattern>` string.

                    let svgStr = pattern.svg;
                    // Replace ID
                    svgStr = svgStr.replace(/id="[^"]*"/, `id="${scaledId}"`);
                    // Add/Replace patternTransform
                    // Apply a 0.5 multiplier to standard patterns for finer default tiling
                    const finalScale = scale * 0.5;
                    if (svgStr.includes('patternTransform=')) {
                        svgStr = svgStr.replace(/patternTransform="[^"]*"/, `patternTransform="scale(${finalScale})"`);
                    } else {
                        svgStr = svgStr.replace('<pattern', `<pattern patternTransform="scale(${finalScale})"`);
                    }

                    variants.push(
                        <g key={scaledId} dangerouslySetInnerHTML={{ __html: svgStr }} />
                    );
                }
            });
        });

        return variants;
    }, [usedScales]);

    // Scales for procedural patterns (grass/sand)
    const grassScales = Array.from(usedScales.get('grass') || [1]);
    const sandScales = Array.from(usedScales.get('sand') || [1]);

    return (
        <defs>
            {/* Standard Patterns (Scaled) */}
            {patternVariants}

            {/* Procedural Grass Pattern variants */}
            {grassScales.map(scale => (
                <pattern key={`grass-${scale}`} id={`grass-scale-${scale}`} patternUnits="userSpaceOnUse" width="128" height="128" patternTransform={`scale(${scale})`}>
                    <rect width="128" height="128" fill="#228B22" />
                    <filter id={`grassNoise-${scale}`}>
                        <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="4" stitchTiles="stitch" />
                        <feColorMatrix type="matrix" values="0 0 0 0 0, 0 0 0 0 0, 0 0 0 0 0, 0 0 0 1 0" />
                    </filter>
                    <rect width="128" height="128" filter={`url(#grassNoise-${scale})`} opacity="0.4" style={{ mixBlendMode: 'overlay' }} />
                    <path d="M10,120 Q15,90 25,100 M40,120 Q45,80 35,90 M80,120 Q85,70 70,80 M110,120 Q105,80 120,90"
                        stroke="#2d5a02" strokeWidth="2" fill="none" opacity="0.3" />
                </pattern>
            ))}

            {/* Procedural Sand Pattern variants */}
            {sandScales.map(scale => (
                <pattern key={`sand-${scale}`} id={`sand-scale-${scale}`} patternUnits="userSpaceOnUse" width="128" height="128" patternTransform={`scale(${scale})`}>
                    <rect width="128" height="128" fill="#e6c288" />
                    <filter id={`sandNoise-${scale}`}>
                        <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="4" stitchTiles="stitch" />
                        <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 3 -1" />
                    </filter>
                    <rect width="128" height="128" filter={`url(#sandNoise-${scale})`} opacity="0.35" />
                    {/* Larger, more visible particles */}
                    <circle cx="25" cy="25" r="3" fill="#d4a76a" opacity="0.6" />
                    <circle cx="75" cy="45" r="4" fill="#c69c6d" opacity="0.5" />
                    <circle cx="100" cy="100" r="3" fill="#d4a76a" opacity="0.6" />
                    <circle cx="40" cy="90" r="2.5" fill="#8b5e3c" opacity="0.4" />
                    <circle cx="110" cy="20" r="2.5" fill="#8b5e3c" opacity="0.4" />
                </pattern>
            ))}
        </defs>
    );
}
