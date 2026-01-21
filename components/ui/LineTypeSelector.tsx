// LineTypeSelector.tsx - Visual line type selector component
import React from 'react';

interface LineTypeSelectorProps {
    currentType: 'solid' | 'dashed' | 'dotted' | 'double';
    onChange: (type: 'solid' | 'dashed' | 'dotted' | 'double', dashArray?: string) => void;
}

export default function LineTypeSelector({ currentType, onChange }: LineTypeSelectorProps) {
    const lineTypes = [
        {
            value: 'solid' as const,
            label: 'Solid',
            svg: <line x1="2" y1="10" x2="58" y2="10" stroke="currentColor" strokeWidth="2" />
        },
        {
            value: 'dashed' as const,
            label: 'Dashed',
            svg: <line x1="2" y1="10" x2="58" y2="10" stroke="currentColor" strokeWidth="2" strokeDasharray="8,4" />
        },
        {
            value: 'dotted' as const,
            label: 'Dotted',
            svg: <line x1="2" y1="10" x2="58" y2="10" stroke="currentColor" strokeWidth="2" strokeDasharray="2,4" />
        },
        {
            value: 'double' as const,
            label: 'Double',
            svg: (
                <g>
                    <line x1="2" y1="7" x2="58" y2="7" stroke="currentColor" strokeWidth="1.5" />
                    <line x1="2" y1="13" x2="58" y2="13" stroke="currentColor" strokeWidth="1.5" />
                </g>
            )
        },
    ];

    return (
        <div className="mb-3">
            <label className="block text-xs text-gray-500 mb-2">Line Type</label>
            <div className="grid grid-cols-2 gap-2">
                {lineTypes.map((type) => (
                    <button
                        key={type.value}
                        onClick={() => {
                            let dashArray = undefined;
                            if (type.value === 'dashed') dashArray = '10,10';
                            if (type.value === 'dotted') dashArray = '2,5';
                            onChange(type.value, dashArray);
                        }}
                        className={`h-12 border rounded flex flex-col items-center justify-center hover:bg-gray-50 transition-colors ${currentType === type.value
                                ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-50'
                                : 'border-gray-200'
                            }`}
                        title={type.label}
                    >
                        <svg width="60" height="20" viewBox="0 0 60 20" className="text-gray-700 mb-1">
                            {type.svg}
                        </svg>
                        <span className="text-[10px] text-gray-600">{type.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}
