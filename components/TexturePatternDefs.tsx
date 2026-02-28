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
    // 1. Identify all unique scales used for each pattern ID in the scene
    const usedScales = useMemo(() => {
        const scales = new Map<string, Set<{ scale: number; thickness: number }>>();

        // Helper
        const addParams = (textureId: string | undefined, scale: number | undefined, thickness: number | undefined) => {
            if (!textureId) return;
            if (!scales.has(textureId)) scales.set(textureId, new Set());

            const set = scales.get(textureId)!;
            const s = scale || 1;
            const t = thickness || 1;

            // Check existence to avoid dupe objects (Set checks ref equality)
            let exists = false;
            set.forEach(item => {
                if (item.scale === s && item.thickness === t) exists = true;
            });

            if (!exists) set.add({ scale: s, thickness: t });
        };

        // Check shapes
        shapes.forEach(shape => {
            if (shape.fillType === 'texture' && shape.fillTexture) {
                addParams(shape.fillTexture, shape.fillTextureScale, shape.fillTextureThickness);
            }
        });

        // Check walls
        walls.forEach(wall => {
            if (wall.fillType === 'texture' && wall.fillTexture) {
                addParams(wall.fillTexture, wall.fillTextureScale, wall.fillTextureThickness);
            }
        });

        // Ensure default 1,1 is always available for all patterns (for palette previews etc)
        texturePatterns.forEach(p => addParams(p.id, 1, 1));

        return scales;
    }, [shapes, walls]);


    // 2. Generate pattern variants
    const patternVariants = useMemo(() => {
        const variants: React.ReactNode[] = [];

        texturePatterns.forEach(pattern => {
            const patternScales = usedScales.get(pattern.id) || new Set([{ scale: 1, thickness: 1 }]);

            patternScales.forEach(({ scale, thickness }) => {
                const scaledId = `${pattern.id}-scale-${scale}-thick-${thickness}`;

                if (pattern.id === 'grass' || pattern.id === 'sand') {
                    // Procedural handled below
                } else {
                    let svgStr = pattern.svg;
                    // Replace ID
                    svgStr = svgStr.replace(/id="[^"]*"/, `id="${scaledId}"`);

                    // Apply thickness scaling to stroke-width
                    // This regex finds stroke-width="X" and multiplies X by thickness
                    if (thickness !== 1) {
                        svgStr = svgStr.replace(/stroke-width="([\d.]+)"/g, (match, p1) => {
                            return `stroke-width="${parseFloat(p1) * thickness}"`;
                        });
                        // Also scale circle radius for dots/etc if needed, though stroke-width is main target
                        // If patterns use circles for "dots", they might use 'r' attribute
                        svgStr = svgStr.replace(/r="([\d.]+)"/g, (match, p1) => {
                            return `r="${parseFloat(p1) * thickness}"`;
                        });
                    }

                    // Add/Replace patternTransform
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
    const grassParams = Array.from(usedScales.get('grass') || [{ scale: 1, thickness: 1 }]);
    const sandParams = Array.from(usedScales.get('sand') || [{ scale: 1, thickness: 1 }]);

    return (
        <defs>
            {/* Standard Patterns (Scaled) */}
            {patternVariants}

            {/* Procedural Grass Pattern variants */}
            {/* Procedural Grass Pattern variants - Now using External SVG Asset */}
            {grassParams.map(({ scale, thickness }) => (
                <pattern
                    key={`grass-${scale}-${thickness}`}
                    id={`grass-scale-${scale}-thick-${thickness}`}
                    patternUnits="userSpaceOnUse"
                    width="512"
                    height="512"
                    patternTransform={`scale(${scale})`}
                >
                    <image
                        href="/assets/grass-texture.svg"
                        width="512"
                        height="512"
                        preserveAspectRatio="none"
                    />
                </pattern>
            ))}

            {/* Procedural Sand Pattern variants */}
            {sandParams.map(({ scale, thickness }) => (
                <pattern key={`sand-${scale}-${thickness}`} id={`sand-scale-${scale}-thick-${thickness}`} patternUnits="userSpaceOnUse" width="128" height="128" patternTransform={`scale(${scale})`}>
                    <rect width="128" height="128" fill="#e6c288" />
                    <filter id={`sandNoise-${scale}-${thickness}`}>
                        <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="4" stitchTiles="stitch" />
                        <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 3 -1" />
                    </filter>
                    <rect width="128" height="128" filter={`url(#sandNoise-${scale}-${thickness})`} opacity="0.35" />
                    {/* Larger, more visible particles */}
                    <circle cx="25" cy="25" r={3 * thickness} fill="#d4a76a" opacity="0.6" />
                    <circle cx="75" cy="45" r={4 * thickness} fill="#c69c6d" opacity="0.5" />
                    <circle cx="100" cy="100" r={3 * thickness} fill="#d4a76a" opacity="0.6" />
                    <circle cx="40" cy="90" r={2.5 * thickness} fill="#8b5e3c" opacity="0.4" />
                    <circle cx="110" cy="20" r={2.5 * thickness} fill="#8b5e3c" opacity="0.4" />
                </pattern>
            ))}
        </defs>
    );
}
