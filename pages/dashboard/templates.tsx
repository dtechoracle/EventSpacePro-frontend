"use client";
import React, { useState } from "react";
import DashboardSidebar from "@/pages/(components)/DashboardSidebar";
import { motion } from "framer-motion";
import { TEMPLATES } from "@/lib/templates";
import { apiRequest } from "@/helpers/Config";
import { useRouter } from "next/router";
import toast from "react-hot-toast";
import TemplatePreview from "@/components/dashboard/TemplatePreview";
import { BsSearch } from "react-icons/bs";

const Templates = () => {
    const router = useRouter();
    const [creating, setCreating] = useState<string | null>(null);
    const [hoveredTemplate, setHoveredTemplate] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    const filteredTemplates = TEMPLATES.filter(t => t.canvasAssets).filter(t => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return t.name.toLowerCase().includes(q) ||
            t.description.toLowerCase().includes(q) ||
            t.category?.toLowerCase().includes(q) ||
            t.tags?.some(tag => tag.toLowerCase().includes(q));
    });

    const handleUseTemplate = async (template: typeof TEMPLATES[0]) => {
        setCreating(template.id);
        try {
            const projectsRes = await apiRequest('/projects', 'GET');
            const list = Array.isArray(projectsRes) ? projectsRes : (projectsRes as any)?.data || [];
            const HIDDEN_PROJECT_NAME = "Personal Drafts";
            let target = list.find((p: any) => p.name === HIDDEN_PROJECT_NAME);
            let projectSlug: string;

            if (target) {
                projectSlug = target.slug;
            } else {
                const res = await apiRequest("/projects", "POST", { name: HIDDEN_PROJECT_NAME, description: "Your private workspace for drafts" }, true);
                projectSlug = res.data.slug;
            }

            const createRes = await apiRequest(`/projects/${projectSlug}/events`, "POST", {
                name: "Untitled Event",
                type: "Custom venue",
                canvases: template.canvases,
            }, true);

            const eventId = createRes.data._id;

            await apiRequest(`/projects/${projectSlug}/events/${eventId}`, "PUT", {
                canvasAssets: template.canvasAssets,
                canvases: template.canvases,
            }, true);

            router.push({
                pathname: `/dashboard/editor/${projectSlug}/${eventId}`,
                query: { fromTemplate: 'true' },
            });

            toast.success("Template loaded! Name your event when you save.");
        } catch (e: any) {
            console.error("Failed to create event from template", e);
            toast.error(e?.message || "Failed to load template");
        } finally {
            setCreating(null);
        }
    };

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">
            <DashboardSidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
                <div className="bg-white border-b border-gray-200 px-8 py-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Templates</h1>
                            <p className="text-xs text-gray-500 mt-0.5">Start faster with pre-made layouts</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <BsSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
                                <input
                                    type="text"
                                    placeholder="Search templates..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9 pr-4 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 w-60 bg-gray-50/50"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8">
                    {filteredTemplates.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                <BsSearch className="w-6 h-6 text-gray-400" />
                            </div>
                            <h3 className="text-sm font-semibold text-gray-900">No templates found</h3>
                            <p className="text-xs text-gray-500 mt-1">Try adjusting your search</p>
                        </div>
                    ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredTemplates.map((template) => (
                            <motion.div
                                key={template.id}
                                onHoverStart={() => setHoveredTemplate(template.id)}
                                onHoverEnd={() => setHoveredTemplate(null)}
                                className="bg-white rounded-2xl border border-gray-200/60 overflow-hidden cursor-pointer hover:shadow-2xl transition-all duration-300 group"
                            >
                                {/* Preview */}
                                <div className="relative h-48 bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden">
                                    <TemplatePreview items={template.canvasAssets || []} />
                                    {/* Hover overlay */}
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: hoveredTemplate === template.id ? 1 : 0 }}
                                        className="absolute inset-0 bg-black/20 flex items-center justify-center"
                                    >
                                        <motion.button
                                            initial={{ scale: 0.8 }}
                                            animate={{ scale: hoveredTemplate === template.id ? 1 : 0.8 }}
                    onClick={() => handleUseTemplate(template)}
                    disabled={creating === template.id}
                                            className="bg-white text-gray-900 font-semibold px-6 py-3 rounded-xl shadow-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                                        >
                                            {creating === template.id ? (
                                                <span className="flex items-center gap-2">
                                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                    </svg>
                                                    Creating...
                                                </span>
                                            ) : (
                                                "Use template"
                                            )}
                                        </motion.button>
                                    </motion.div>
                                    {/* Category badge */}
                                    {template.category && (
                                        <div className="absolute top-3 left-3">
                                            <span className="bg-white/90 backdrop-blur-sm text-xs font-medium text-gray-700 px-2.5 py-1 rounded-full shadow-sm">
                                                {template.category}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Content */}
                                <div className="p-4">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold text-sm text-gray-900 truncate">{template.name}</h3>
                                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{template.description}</p>
                                        </div>
                                    </div>

                                    {/* Author & Stats */}
                                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                                                <span className="text-[10px] font-bold text-white">{template.authorAvatar || "EP"}</span>
                                            </div>
                                            <span className="text-xs text-gray-600 font-medium">{template.author || "EventSpace Pro"}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {template.rating && (
                                                <div className="flex items-center gap-1">
                                                    <svg className="w-3.5 h-3.5 text-amber-400 fill-current" viewBox="0 0 20 20">
                                                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                    </svg>
                                                    <span className="text-xs font-medium text-gray-600">{template.rating}</span>
                                                </div>
                                            )}
                                            {template.usageCount && (
                                                <span className="text-xs text-gray-400">{template.usageCount.toLocaleString()} uses</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Templates;
