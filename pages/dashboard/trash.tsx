"use client";
import React from "react";
import DashboardSidebar from "@/pages/(components)/DashboardSidebar";
import { BsTrash, BsRecycle } from "react-icons/bs";

const Trash = () => {
    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">
            <DashboardSidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="bg-white border-b border-gray-200 px-8 py-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                                Trash
                            </h1>
                            <p className="text-xs text-gray-500 mt-0.5">Recover or permanently delete items</p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center justify-center text-center">
                    <div className="text-gray-400 mb-4">
                        <BsTrash className="text-6xl mx-auto opacity-20" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">Trash is Empty</h3>
                    <p className="text-gray-500 max-w-sm">
                        Items you delete will appear here. You can restore them or delete them permanently.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Trash;
