import React from 'react';
import { texturePatterns } from '@/utils/texturePatterns';

/**
 * TexturePatternDefs component
 * Renders SVG pattern definitions for texture fills
 * Should be included once in the main SVG container
 */
export default function TexturePatternDefs() {
    return (
        <defs>
            {texturePatterns.map((pattern) => (
                <g key={pattern.id} dangerouslySetInnerHTML={{ __html: pattern.svg }} />
            ))}
        </defs>
    );
}
