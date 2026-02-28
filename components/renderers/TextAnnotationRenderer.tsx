"use client";

import React from 'react';
import { TextAnnotation } from '@/store/projectStore';

interface TextAnnotationRendererProps {
    annotation: TextAnnotation;
    zoom: number;
}

export default function TextAnnotationRenderer({ annotation, zoom }: TextAnnotationRendererProps) {
    const rotation = annotation.rotation || 0;
    const fontSize = annotation.fontSize || 200;

    // Approximate bounds for the background rect
    // This is a simple estimation as SVG doesn't naturally support text background
    const approxWidth = annotation.text.length * fontSize * 0.55;
    const padding = fontSize * 0.2;
    const bgWidth = approxWidth + padding * 2;
    const bgHeight = fontSize * 1.2 + padding * 2;
    const bgX = -padding;
    const bgY = -bgHeight / 2;

    return (
        <g transform={`translate(${annotation.x}, ${annotation.y}) rotate(${rotation})`}>
            {annotation.backgroundColor && annotation.backgroundColor !== 'transparent' && (
                <rect
                    x={bgX}
                    y={bgY}
                    width={bgWidth}
                    height={bgHeight}
                    fill={annotation.backgroundColor}
                    rx={fontSize * 0.1}
                />
            )}
            <text
                x="0"
                y="0"
                fontSize={fontSize}
                fill={annotation.color || '#000000'}
                fontFamily={annotation.fontFamily || 'Arial'}
                fontWeight={annotation.fontWeight || 'normal'}
                fontStyle={annotation.fontStyle || 'normal'}
                textDecoration={annotation.textDecoration || 'none'}
                dominantBaseline="middle"
                textAnchor="start"
                style={{ cursor: 'pointer', pointerEvents: 'all' }}
            >
                {annotation.text}
            </text>
        </g>
    );
}

