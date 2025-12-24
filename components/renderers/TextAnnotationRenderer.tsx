"use client";

import React from 'react';
import { TextAnnotation } from '@/store/projectStore';

interface TextAnnotationRendererProps {
    annotation: TextAnnotation;
    zoom: number;
}

export default function TextAnnotationRenderer({ annotation, zoom }: TextAnnotationRendererProps) {
    const rotation = annotation.rotation || 0;
    
    return (
        <g transform={`translate(${annotation.x}, ${annotation.y}) rotate(${rotation})`}>
            <text
                x="0"
                y="0"
                fontSize={annotation.fontSize || 200}
                fill={annotation.color || '#000000'}
                fontFamily={annotation.fontFamily || 'Arial'}
                dominantBaseline="middle"
                textAnchor="start"
                style={{ cursor: 'pointer', pointerEvents: 'all' }}
            >
                {annotation.text}
            </text>
        </g>
    );
}

