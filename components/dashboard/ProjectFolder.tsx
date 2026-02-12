import React from 'react';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';

interface ProjectFolderProps {
    project: {
        name: string;
        slug: string;
        events?: any[];
        updatedAt?: string;
    };
}

export default function ProjectFolder({ project }: ProjectFolderProps) {
    const router = useRouter();

    const handleDoubleClick = () => {
        router.push(`/dashboard/projects/${project.slug}`);
    };

    return (
        <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex flex-col items-center justify-center p-4 cursor-pointer group h-full"
            onDoubleClick={handleDoubleClick}
            onClick={() => router.push(`/dashboard/projects/${project.slug}`)}
        >
            {/* Windows 11 Style Folder Icon (SVG) - Much Larger */}
            <div className="relative w-full aspect-[4/3] max-w-[140px] drop-shadow-sm group-hover:drop-shadow-lg transition-all mb-3">
                <svg viewBox="0 0 100 80" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="folderGrad" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="white" stopOpacity="0.2" />
                            <stop offset="100%" stopColor="black" stopOpacity="0.05" />
                        </linearGradient>
                    </defs>

                    {/* Back Folder Part */}
                    <path d="M5 10 L35 10 L40 18 L95 18 L95 75 L5 75 Z" fill="#Fcd34d" stroke="#F59E0B" strokeWidth="1" />

                    {/* Paper Content Preview (if items > 0) */}
                    {project.events && project.events.length > 0 && (
                        <rect x="15" y="15" width="70" height="50" fill="white" transform="rotate(-2 50 40)" stroke="#e5e7eb" strokeWidth="1" opacity="0.9" />
                    )}

                    {/* Front Folder Part */}
                    <path d="M5 25 L95 25 L95 75 L5 75 Z" fill="#Fde047" stroke="#F59E0B" strokeWidth="1" />
                    <path d="M5 25 L95 25 L95 75 L5 75 Z" fill="url(#folderGrad)" className="pointer-events-none" />
                </svg>

                {/* Count Badge - overlay on folder */}
                {project.events && project.events.length > 0 && (
                    <div className="absolute -bottom-1 -right-1 bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm border border-white">
                        {project.events.length}
                    </div>
                )}
            </div>

            {/* Text Label - Centered */}
            <div className="text-center w-full">
                <h3 className="text-base font-semibold text-gray-700 truncate px-2 group-hover:text-blue-600 transition-colors">
                    {project.name}
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                    {project.updatedAt ? new Date(project.updatedAt).toLocaleDateString() : 'Recently'}
                </p>
            </div>
        </motion.div>
    );
}
