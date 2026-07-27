"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest } from "@/helpers/Config";
import toast from "react-hot-toast";

interface RenameEventModalProps {
    event: any;
    onClose: () => void;
    onSuccess: (newName: string) => void;
}

export default function RenameEventModal({ event, onClose, onSuccess }: RenameEventModalProps) {
    const [name, setName] = useState(event?.name || "");
    const [isLoading, setIsLoading] = useState(false);

    if (!event) return null;

    const handleRename = async () => {
        if (!name.trim()) {
            toast.error("Please enter a name");
            return;
        }

        setIsLoading(true);
        try {
            await apiRequest(`/projects/${event.projectSlug}/events/${event._id}`, "PUT", {
                name: name.trim()
            }, true);
            
            toast.success("Event renamed successfully");
            onSuccess(name.trim());
            onClose();
        } catch (error) {
            console.error("Rename failed:", error);
            toast.error("Failed to rename event");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[99999]"
                onClick={onClose}
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 15 }}
                    className="bg-white text-gray-900 w-[26rem] rounded-xl p-7 shadow-xl border border-gray-200"
                    onClick={(e) => e.stopPropagation()}
                >
                    <h2 className="text-xl font-bold mb-1 tracking-tight">Rename Event</h2>
                    <p className="text-xs text-gray-500 mb-5">Enter a new name for your event.</p>

                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full h-11 px-4 rounded-xl bg-gray-50 text-gray-900 border border-gray-200 outline-none mb-6 text-xs focus:border-blue-500 placeholder:text-gray-400"
                        placeholder="Event name"
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                    />

                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 h-11 rounded-xl bg-gray-100 font-semibold text-gray-600 hover:bg-gray-200 transition-colors text-xs"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleRename}
                            disabled={isLoading || !name.trim() || name === event.name}
                            className="flex-1 h-11 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-500 disabled:opacity-40 transition-all text-xs flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : "Save"}
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
