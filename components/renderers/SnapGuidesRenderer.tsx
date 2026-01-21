import React from 'react';
import { useSceneStore } from '@/store/sceneStore';

export default function SnapGuidesRenderer() {
    const snapGuides = useSceneStore(s => s.snapGuides);

    if (!snapGuides || snapGuides.length === 0) return null;

    return (
        <svg
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 9999, // High z-index to be on top
                overflow: 'visible'
            }}
        >
            {snapGuides.map((guide, index) => (
                <line
                    key={index}
                    x1={guide.x1}
                    y1={guide.y1}
                    x2={guide.x2}
                    y2={guide.y2}
                    stroke="#ef4444" // Red color for guides
                    strokeWidth="1"
                    strokeDasharray="4 2"
                />
            ))}
        </svg>
    );
}
