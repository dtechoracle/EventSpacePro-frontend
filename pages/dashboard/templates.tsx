"use client";
import React, { useState } from "react";
import DashboardSidebar from "@/pages/(components)/DashboardSidebar";
import CreateEventModal from "@/pages/(components)/projects/CreateEventModal";
import { motion } from "framer-motion";
import { TEMPLATES } from "@/lib/templates";

const Templates = () => {
    const [selectedTemplate, setSelectedTemplate] = useState<any>(null);

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">
            <DashboardSidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="bg-white/60 backdrop-blur-sm border-b border-gray-300/50 px-8 py-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-[var(--accent)]">
                                Templates
                            </h1>
                            <p className="text-sm text-gray-500 mt-1">Start faster with pre-made layouts</p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8">
                    {selectedTemplate && (
                        <CreateEventModal
                            onClose={() => setSelectedTemplate(null)}
                            initialTemplateData={selectedTemplate.canvasData}
                        />
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {TEMPLATES.map((template) => (
                            <motion.div
                                key={template.id}
                                onClick={() => setSelectedTemplate(template)}
                                whileHover={{ scale: 1.03, y: -4 }}
                                className="bg-white rounded-2xl border border-gray-200/60 overflow-hidden cursor-pointer hover:shadow-xl transition-all duration-300"
                            >
                                <div className={`h-40 flex items-center justify-center ${template.id === 'bedroom' ? 'bg-gradient-to-br from-orange-400 to-orange-600' :
                                        template.id === 'office' ? 'bg-gradient-to-br from-blue-400 to-blue-600' :
                                            'bg-gradient-to-br from-gray-200 to-gray-300'
                                    }`}>
                                    <div className={`${template.id === 'starter' ? 'text-gray-500' : 'text-white'} text-5xl`}>
                                        {template.icon}
                                    </div>
                                </div>
                                <div className="p-4">
                                    <h3 className="font-semibold text-sm text-gray-800">{template.name}</h3>
                                    <p className="text-xs text-gray-500 mt-1">{template.description}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Templates;
