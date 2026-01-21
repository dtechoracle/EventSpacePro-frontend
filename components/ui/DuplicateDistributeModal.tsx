"use client";

import React, { useState } from 'react';
import { X } from 'lucide-react';

interface DuplicateDistributeModalProps {
    isOpen: boolean;
    mode: 'duplicate' | 'distribute'; // 'duplicate' = Duplicate & Distribute
    onClose: () => void;
    onConfirm: (data: { count?: number; type?: 'horizontal' | 'vertical' | 'circular'; spacing?: number; diameter?: number }) => void;
}

export default function DuplicateDistributeModal({ isOpen, mode, onClose, onConfirm }: DuplicateDistributeModalProps) {
    const [duplicateCount, setDuplicateCount] = useState<number>(1);
    const [distributeType, setDistributeType] = useState<'horizontal' | 'vertical' | 'circular'>('horizontal');
    const [spacing, setSpacing] = useState<number>(100);
    const [diameter, setDiameter] = useState<number>(500);

    if (!isOpen) return null;

    const handleSubmit = () => {
        if (mode === 'duplicate') {
            // Duplicate & Distribute
            onConfirm({
                count: duplicateCount,
                type: distributeType,
                spacing: distributeType !== 'circular' ? spacing : undefined,
                diameter: distributeType === 'circular' ? diameter : undefined
            });
        } else {
            // Distribute only
            onConfirm({
                type: distributeType,
                spacing: distributeType !== 'circular' ? spacing : undefined,
                diameter: distributeType === 'circular' ? diameter : undefined
            });
        }
        onClose();
    };

    return (
        <div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[10000]"
        >
            <div
                className="bg-white rounded-lg shadow-xl p-6 w-96 max-w-[90vw]"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onMouseUp={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">
                        {mode === 'duplicate' ? 'Duplicate & Distribute' : 'Distribute Items'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="space-y-4">
                    {mode === 'duplicate' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Number of Duplicates
                            </label>
                            <input
                                type="number"
                                min={1}
                                max={100}
                                value={duplicateCount}
                                onChange={(e) => setDuplicateCount(Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Distribution Type
                        </label>
                        <select
                            value={distributeType}
                            onChange={(e) => setDistributeType(e.target.value as any)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="horizontal">Horizontal</option>
                            <option value="vertical">Vertical</option>
                            <option value="circular">Circular</option>
                        </select>
                    </div>

                    {distributeType === 'circular' ? (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Diameter (mm)
                            </label>
                            <input
                                type="number"
                                min={10}
                                value={diameter}
                                onChange={(e) => setDiameter(Math.max(10, parseFloat(e.target.value) || 500))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    ) : (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Space Between (mm)
                            </label>
                            <input
                                type="number"
                                min={0}
                                value={spacing}
                                onChange={(e) => setSpacing(Math.max(0, parseFloat(e.target.value) || 100))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    )}
                </div>

                <div className="flex gap-3 mt-6">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                        {mode === 'duplicate' ? 'Duplicate & Distribute' : 'Distribute'}
                    </button>
                </div>
            </div>
        </div>
    );
}

