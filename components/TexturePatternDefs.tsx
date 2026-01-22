import React from 'react';
import { texturePatterns } from '@/utils/texturePatterns';

/**
 * TexturePatternDefs component
 * Renders SVG pattern definitions for texture fills
 * Should be included once in the main SVG container
 */
export default function TexturePatternDefs() {
    const otherPatterns = texturePatterns
        .filter(p => p.id !== 'grass' && p.id !== 'sand')
        .map(p => p.svg)
        .join('');

    return (
        <defs>
            {/* Realistic Grass Pattern using SVG Filters */}
            <pattern id="grass" patternUnits="userSpaceOnUse" width="256" height="256">
                {/* Base Green Color */}
                <rect width="256" height="256" fill="#4a8505" />

                {/* Noise Filter Definition Inline (or could be in defs, but here for self-containment) */}
                <filter id="grassNoise">
                    <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="4" stitchTiles="stitch" />
                    <feColorMatrix type="matrix" values="0 0 0 0 0, 0 0 0 0 0, 0 0 0 0 0, 0 0 0 1 0" />
                </filter>

                {/* Texture Overlay */}
                <rect width="256" height="256" filter="url(#grassNoise)" opacity="0.4" style={{ mixBlendMode: 'overlay' }} />

                {/* Detailed blades for depth */}
                <path d="M10,250 Q15,220 25,230 M40,250 Q45,210 35,220 M100,250 Q105,200 90,210 M200,250 Q195,210 210,220"
                    stroke="#2d5a02" strokeWidth="2" fill="none" opacity="0.3" />
            </pattern>

            {/* Realistic Sand Pattern */}
            <pattern id="sand" patternUnits="userSpaceOnUse" width="256" height="256">
                <rect width="256" height="256" fill="#e6c288" />

                <filter id="sandNoise">
                    <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch" />
                </filter>

                <rect width="256" height="256" filter="url(#sandNoise)" opacity="0.15" />

                {/* Pebbles */}
                <circle cx="50" cy="50" r="2" fill="#d4a76a" opacity="0.5" />
                <circle cx="150" cy="90" r="3" fill="#c69c6d" opacity="0.4" />
                <circle cx="200" cy="200" r="2" fill="#d4a76a" opacity="0.5" />
            </pattern>

            {/* Inject others safely */}
            <g dangerouslySetInnerHTML={{ __html: otherPatterns }} />
        </defs>
    );
}
