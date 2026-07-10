import React, { useMemo } from 'react';
import { texturePatterns } from '@/utils/texturePatterns';
import { useProjectStore } from '@/store/projectStore';

/**
 * TexturePatternDefs component
 * Renders SVG pattern definitions for texture fills using image-based assets.
 * Optimized for performance by using appropriate tiling and cache-friendly definitions.
 */
export default function TexturePatternDefs() {
    const shapes = useProjectStore(s => s.shapes);
    const walls = useProjectStore(s => s.walls);
    const assets = useProjectStore(s => s.assets);

    // Identify all unique scales used for each pattern ID in the scene
    const usedScales = useMemo(() => {
        const scales = new Map<string, Set<{ scale: number; thickness: number; rotation: number }>>();

        const addParams = (textureId: string | undefined, scale: number | undefined, thickness: number | undefined, rotation: number | undefined) => {
            if (!textureId) return;
            if (!scales.has(textureId)) scales.set(textureId, new Set());

            const set = scales.get(textureId)!;
            const s = scale === undefined ? 4 : scale;
            const t = thickness === undefined ? 1 : thickness;
            const r = rotation === undefined ? 0 : rotation;

            let exists = false;
            set.forEach(item => {
                if (item.scale === s && item.thickness === t && item.rotation === r) exists = true;
            });

            if (!exists) set.add({ scale: s, thickness: t, rotation: r });
        };

        // Check shapes
        shapes.forEach(shape => {
            if ((shape.fillType === 'texture' || shape.fillType === 'hatch') && shape.fillTexture) {
                addParams(shape.fillTexture, shape.fillTextureScale, shape.fillTextureThickness, shape.hatchRotation);
            }
        });

        // Check assets
        assets.forEach(asset => {
            const a = asset as any;
            if ((a.fillType === 'texture' || a.fillType === 'hatch') && a.fillTexture) {
                addParams(a.fillTexture, a.fillTextureScale, a.fillTextureThickness, a.hatchRotation);
            }
        });

        // Check walls
        walls.forEach(wall => {
            if ((wall.fillType === 'texture' || wall.fillType === 'hatch') && wall.fillTexture) {
                addParams(wall.fillTexture, wall.fillTextureScale, wall.fillTextureThickness, wall.hatchRotation);
            }
        });

        // Ensure default 1,1 available
        texturePatterns.forEach(p => addParams(p.id, 1, 1, 0));

        return scales;
    }, [shapes, walls, assets]);

    // Generate pattern variants
    const patternVariants = useMemo(() => {
        const variants: React.ReactNode[] = [];

        texturePatterns.forEach(pattern => {
            const pScales = usedScales.get(pattern.id) || new Set([{ scale: 1, thickness: 1, rotation: 0 }]);

            pScales.forEach(({ scale, thickness, rotation }) => {
                const scaledId = `${pattern.id}-scale-${scale}-thick-${thickness}-rot-${rotation}`;
                const baseTileSize = pattern.tileSize || 1024;

                if (pattern.isImage && pattern.path) {
                    // Optimization: Use a fixed pattern size but scale via transform to maintain quality
                    // 'image-rendering: crisp-edges' for textures can sometimes help, but 'auto' is usually better for photos.
                    variants.push(
                        <pattern
                            key={scaledId}
                            id={scaledId}
                            patternUnits="userSpaceOnUse"
                            width={baseTileSize}
                            height={baseTileSize}
                            patternTransform={`scale(${scale})`}
                            style={{ color: 'currentColor' }}
                        >
                            <image
                                href={pattern.path}
                                width={baseTileSize}
                                height={baseTileSize}
                                preserveAspectRatio="xMidYMid slice"
                            // Loading lazy isn't fully supported in SVG <image> in all browsers, 
                            // but we use standard href for caching.
                            />
                        </pattern>
                    );
                } else if (pattern.svg) {
                    // Handle legacy SVG patterns like 'grid'
                    let svgStr = pattern.svg;
                    svgStr = svgStr.replace(/id="[^"]*"/, `id="${scaledId}"`);

                    if (thickness !== 1) {
                        svgStr = svgStr.replace(/stroke-width="([\d.]+)"/g, (match, p1) => {
                            return `stroke-width="${parseFloat(p1) * thickness}"`;
                        });
                        svgStr = svgStr.replace(/r="([\d.]+)"/g, (match, p1) => {
                            return `r="${parseFloat(p1) * thickness}"`;
                        });
                    }

                    const finalScale = scale;
                    let existingRot = 0;
                    const rotMatch = pattern.svg.match(/patternTransform="rotate\((\d+)\)"/);
                    if (rotMatch) {
                        existingRot = parseInt(rotMatch[1], 10);
                    }
                    const totalRot = (rotation || 0) + existingRot;
                    const transformStr = `scale(${finalScale}) rotate(${totalRot})`;

                    if (svgStr.includes('patternTransform=')) {
                        svgStr = svgStr.replace(/patternTransform="[^"]*"/, `patternTransform="${transformStr}"`);
                    } else {
                        svgStr = svgStr.replace('<pattern', `<pattern patternTransform="${transformStr}"`);
                    }

                    variants.push(
                        <g key={scaledId} dangerouslySetInnerHTML={{ __html: svgStr }} />
                    );
                }
            });
        });

        return variants;
    }, [usedScales]);

    return (
        <defs>
            {patternVariants}

            {/* Hash Patterns */}
            <pattern id="hash-45" patternUnits="userSpaceOnUse" width="10" height="10">
                <rect width="10" height="10" fill="none" />
                <path d="M-1,1 l2,-2 M0,10 l10,-10 M9,11 l2,-2" stroke="#000000" strokeWidth="1" />
            </pattern>
            <pattern id="hash-135" patternUnits="userSpaceOnUse" width="10" height="10">
                <rect width="10" height="10" fill="none" />
                <path d="M-1,9 l2,2 M0,0 l10,10 M9,-1 l2,2" stroke="#000000" strokeWidth="1" />
            </pattern>
            <pattern id="hash-horizontal" patternUnits="userSpaceOnUse" width="10" height="5">
                <rect width="10" height="5" fill="none" />
                <path d="M0,2.5 h10" stroke="#000000" strokeWidth="1" />
            </pattern>
            <pattern id="hash-vertical" patternUnits="userSpaceOnUse" width="5" height="10">
                <rect width="5" height="10" fill="none" />
                <path d="M2.5,0 v10" stroke="#000000" strokeWidth="1" />
            </pattern>
            <pattern id="hash-cross" patternUnits="userSpaceOnUse" width="10" height="10">
                <rect width="10" height="10" fill="none" />
                <path d="M0,5 h10 M5,0 v10" stroke="#000000" strokeWidth="1" />
            </pattern>
        </defs>
    );
}
