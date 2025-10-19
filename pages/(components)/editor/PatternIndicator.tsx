"use client";

import { useSceneStore } from "@/store/sceneStore";

export default function PatternIndicator() {
  const duplicationPattern = useSceneStore((s) => s.duplicationPattern);
  const lastDuplicatedAsset = useSceneStore((s) => s.lastDuplicatedAsset);

  if (!duplicationPattern || !lastDuplicatedAsset) return null;

  return (
    <div className="fixed top-4 right-4 bg-blue-500 text-white px-3 py-2 rounded-lg shadow-lg z-50">
      <div className="text-sm font-medium">
        Pattern: {duplicationPattern.type}
      </div>
      <div className="text-xs opacity-80">
        Next duplication will follow this pattern
      </div>
    </div>
  );
}
