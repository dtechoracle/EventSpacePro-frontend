"use client";

import React from 'react';
import { TextAnnotation } from '@/store/projectStore';

interface TextAnnotationRendererProps {
    annotation: TextAnnotation;
    zoom: number;
}

export default function TextAnnotationRenderer({ annotation, zoom }: TextAnnotationRendererProps) {
    const rotation = annotation.rotation || 0;
    const fontSize = annotation.fontSize || 250;

    const lines = annotation.text ? annotation.text.split('\n') : [''];
    const lineHeight = annotation.lineHeight || 1.2;
    const approxWidth = Math.max(...lines.map(l => l.length)) * fontSize * 0.55;
    const padding = fontSize * 0.2;
    const bgWidth = approxWidth + padding * 2;
    const bgHeight = lines.length * fontSize * lineHeight + padding * 2;
    const bgX = -bgWidth / 2;
    const bgY = -bgHeight / 2;

    const textX = annotation.textAlign === 'left' ? bgX + padding : annotation.textAlign === 'right' ? bgX + bgWidth - padding : "0";

    return (
        <g transform={`translate(${annotation.x}, ${annotation.y}) rotate(${rotation})`} data-id={annotation.id}>
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
                x={textX}
                y={-(lines.length - 1) * (fontSize * lineHeight) / 2}
                fontSize={fontSize}
                fill={annotation.color || '#000000'}
                fontFamily={annotation.fontFamily || 'Inter, sans-serif'}
                fontWeight={annotation.fontWeight || 'normal'}
                fontStyle={annotation.fontStyle || 'normal'}
                textDecoration={annotation.textDecoration || 'none'}
                dominantBaseline="middle"
                textAnchor={annotation.textAlign === 'left' ? 'start' : annotation.textAlign === 'right' ? 'end' : 'middle'}
                style={{ cursor: 'pointer', pointerEvents: 'all' }}
            >
                {lines.map((line, i) => (
                    <tspan
                        key={i}
                        x={textX}
                        dy={i === 0 ? "0" : fontSize * lineHeight}
                    >
                        {line}
                    </tspan>
                ))}
            </text>
        </g>
    );
}

