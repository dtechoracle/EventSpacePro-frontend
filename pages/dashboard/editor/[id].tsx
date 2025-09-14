"use client";

import AssetsModal from "@/pages/(components)/editor/AssetsModal";
import BottomToolbar from "@/pages/(components)/editor/BottomToolBar";
import PropertiesSidebar from "@/pages/(components)/editor/PropertiesSidebar";
import Toolbar from "@/pages/(components)/editor/ToolBar";
import MainLayout from "@/pages/layouts/MainLayout";
import { useState } from "react";


export default function Editor() {
  const [showAssetsModal, setShowAssetsModal] = useState(false)
  return (
    <MainLayout>
      <div className="h-screen flex overflow-hidden">
      <AssetsModal isOpen={showAssetsModal} onClose={() => setShowAssetsModal(false)}/>
        <BottomToolbar setShowAssetsModal={setShowAssetsModal} />
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

