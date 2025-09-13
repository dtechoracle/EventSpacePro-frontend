"use client";

import PropertiesSidebar from "@/pages/(components)/editor/PropertiesSidebar";
import Toolbar from "@/pages/(components)/editor/ToolBar";
import MainLayout from "@/pages/layouts/MainLayout";


export default function Editor() {
  return (
    <MainLayout>
      <div className="h-screen flex overflow-hidden">
        {/* Fixed Toolbar */}
        <div className="flex-shrink-0 w-64 bg-white">
          <Toolbar />
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
          <div className="max-w-4xl mx-auto">
          </div>
        </div>

        <div className="flex-shrink-0 w-64 bg-white">
          <PropertiesSidebar />
        </div>
      </div>
    </MainLayout>
  );
}

