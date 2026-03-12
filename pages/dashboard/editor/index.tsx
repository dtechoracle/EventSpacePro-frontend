"use client";

import React, { useState } from 'react';
import Workspace2D from '@/components/Workspace2D';
import Toolbar from '@/components/Toolbar';
import Scene3D from '@/components/Scene3D';
import { useProjectStore } from '@/store/projectStore';


export default function EditorPage() {
    const { assets } = useProjectStore();
    const [show3D, setShow3D] = useState(false);

    return (
        <div className="flex flex-col h-screen bg-gray-50">
            {/* Toolbar */}
            <Toolbar />

            {/* Main Content */}
            <div className="flex-1 relative overflow-hidden">
                {/* 2D Workspace */}
                {!show3D && (
                    <div className="absolute inset-0">
                        <Workspace2D />
                    </div>
                )}

                {/* 3D Preview */}
                {show3D && (
                    <div className="absolute inset-0">
                        <Scene3D assets={assets as any} width={window.innerWidth} height={window.innerHeight - 60} />
                    </div>
                )}

                {/* View Toggle */}
                <div className="absolute bottom-4 right-4 z-10">
                    <button
                        onClick={() => setShow3D(!show3D)}
                        className="px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-lg hover:bg-gray-50 transition-colors font-medium"
                    >
                        {show3D ? '📐 2D View' : '🎨 3D Preview'}
                    </button>
                </div>
            </div>
        </div>
    );
}
