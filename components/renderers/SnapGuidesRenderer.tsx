import React from 'react';
import { useSceneStore } from '@/store/sceneStore';

export default function SnapGuidesRenderer({ zoom = 1 }: { zoom?: number }) {
    const snapGuides = useSceneStore(s => s.snapGuides);

    if (!snapGuides || snapGuides.length === 0) return null;

    return (
        <g pointerEvents="none">
            {snapGuides.map((guide, index) => (
                <line
                    key={index}
                    x1={guide.x1}
                    y1={guide.y1}
                    x2={guide.x2}
                    y2={guide.y2}
                    stroke={guide.type === 'horizontal' ? '#22c55e' : '#ef4444'} // Horizontal = Green, Vertical = Red
                    strokeWidth={1}
                    strokeDasharray="4 4"
                    vectorEffect="non-scaling-stroke"
                />
            ))}
        </g>
    );
}
