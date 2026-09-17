"use client";

import React from "react";
import dynamic from "next/dynamic";
import { useSceneStore } from "@/store/sceneStore";

// Dynamically import Scene3D to avoid SSR issues
const Scene3D = dynamic(() => import("@/components/Scene3D"), { ssr: false });

export default function ThreeDOverlay() {
  const assets = useSceneStore((s) => s.assets);
  const isOpen = useSceneStore((s) => s.is3DOverlayOpen);
  const close = useSceneStore((s) => s.close3DOverlay);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999]"
      style={{ background: "rgba(0,0,0,0.6)" }}
    >
      <div className="absolute inset-6 bg-white rounded-lg shadow-xl overflow-hidden">
        <div className="absolute top-2 right-2 z-10">
          <button
            onClick={() => close && close()}
            className="px-3 py-1.5 text-xs bg-gray-800 text-white rounded hover:bg-gray-700"
          >
            Close
          </button>
        </div>
        <Scene3D assets={assets} width={typeof window !== 'undefined' ? window.innerWidth - 48 : 800} height={typeof window !== 'undefined' ? window.innerHeight - 48 : 600} />
      </div>
    </div>
  );
}


