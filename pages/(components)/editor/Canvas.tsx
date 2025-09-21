"use client";

import { useEffect, useRef, useState } from "react";
import { useSceneStore } from "@/store/sceneStore";
import { ASSET_LIBRARY } from "@/lib/assets";
import { RotateCw, RotateCcw } from "lucide-react";

type CanvasProps = {
  workspaceZoom: number;
  mmToPx: number;
  canvasPos: { x: number; y: number };
  setCanvasPos: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
};

export default function Canvas({ workspaceZoom, mmToPx, canvasPos, setCanvasPos }: CanvasProps) {
  const canvas = useSceneStore((s) => s.canvas);
  const assets = useSceneStore((s) => s.assets);
  const addAsset = useSceneStore((s) => s.addAsset);
  const addAssetObject = useSceneStore((s) => s.addAssetObject);
  const updateAsset = useSceneStore((s) => s.updateAsset);
  const selectedAssetId = useSceneStore((s) => s.selectedAssetId);
  const selectAsset = useSceneStore((s) => s.selectAsset);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const draggingAssetRef = useRef<string | null>(null);
  const isMovingCanvas = useRef(false);
  const lastCanvasPointer = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const [rotation, setRotation] = useState<number>(0);
  const canvasPxW = (canvas?.width ?? 0) * mmToPx;
  const canvasPxH = (canvas?.height ?? 0) * mmToPx;

  const clientToCanvasMM = (clientX: number, clientY: number) => {
    if (!canvasRef.current || !canvas) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const theta = (-rotation * Math.PI) / 180;
    const ux = dx * Math.cos(theta) - dy * Math.sin(theta);
    const uy = dx * Math.sin(theta) + dy * Math.cos(theta);
    const halfWscreen = (canvasPxW * workspaceZoom) / 2;
    const halfHscreen = (canvasPxH * workspaceZoom) / 2;
    const xMm = (ux + halfWscreen) / (mmToPx * workspaceZoom);
    const yMm = (uy + halfHscreen) / (mmToPx * workspaceZoom);
    return { x: xMm, y: yMm };
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (draggingAssetRef.current) {
        const { x, y } = clientToCanvasMM(e.clientX, e.clientY);
        updateAsset(draggingAssetRef.current, { x, y });
        return;
      }
      if (isMovingCanvas.current) {
        const dx = e.clientX - lastCanvasPointer.current.x;
        const dy = e.clientY - lastCanvasPointer.current.y;
        setCanvasPos((p) => ({ x: p.x + dx / workspaceZoom, y: p.y + dy / workspaceZoom }));
        lastCanvasPointer.current = { x: e.clientX, y: e.clientY };
      }
    };

    const onUp = () => {
      draggingAssetRef.current = null;
      isMovingCanvas.current = false;
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [workspaceZoom, mmToPx, rotation, updateAsset, setCanvasPos]);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("assetType");
    if (!type || !canvasRef.current || !canvas) return;
    const { x, y } = clientToCanvasMM(e.clientX, e.clientY);
    addAsset(type, x, y);
  };

  if (!canvas) return null;

  const rotateCW = () => setRotation((r) => (r + 90) % 360);
  const rotateCCW = () => setRotation((r) => (r - 90 + 360) % 360);

  const onAssetMouseDown = (e: React.MouseEvent, assetId: string) => {
    e.stopPropagation();
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) return;

    let draggingId = asset.id;

    if (e.ctrlKey || e.metaKey) {
      const newAsset = {
        ...asset,
        id: crypto.randomUUID(),
        x: asset.x + 5,
        y: asset.y + 5,
      };
      addAssetObject(newAsset);
      draggingId = newAsset.id;
    }

    selectAsset(draggingId);
    draggingAssetRef.current = draggingId;
  };

  return (
    <div
      ref={canvasRef}
      className="relative bg-white border shadow-md"
      style={{ width: canvasPxW, height: canvasPxH, transform: `rotate(${rotation}deg)`, transformOrigin: "center center" }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      onMouseDown={(e) => {
        if (e.button !== 0) return;
        if (e.target === canvasRef.current) {
          selectAsset(null);
          e.stopPropagation();
          isMovingCanvas.current = true;
          lastCanvasPointer.current = { x: e.clientX, y: e.clientY };
        }
      }}
    >
      {/* Rotate Buttons */}
      {selectedAssetId === null && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex gap-2 z-10 pointer-events-auto">
          <button onClick={(ev) => { ev.stopPropagation(); rotateCCW(); }} className="p-2 bg-gray-200 rounded-full shadow hover:bg-gray-300" title="Rotate CCW"><RotateCcw size={16} /></button>
          <button onClick={(ev) => { ev.stopPropagation(); rotateCW(); }} className="p-2 bg-gray-200 rounded-full shadow hover:bg-gray-300" title="Rotate CW"><RotateCw size={16} /></button>
        </div>
      )}

      {/* Render Assets */}
      {assets.map((asset) => {
        const def = ASSET_LIBRARY.find((a) => a.id === asset.type);
        const isSelected = asset.id === selectedAssetId;
        const leftPx = asset.x * mmToPx;
        const topPx = asset.y * mmToPx;
        const totalRotation = asset.rotation;

        if (asset.type === "square" || asset.type === "circle") {
          return (
            <div
              key={asset.id}
              onMouseDown={(e) => onAssetMouseDown(e, asset.id)}
              style={{
                position: "absolute",
                left: leftPx,
                top: topPx,
                width: (asset.width ?? 50) * asset.scale,
                height: (asset.height ?? 50) * asset.scale,
                backgroundColor: asset.fillColor,
                borderRadius: asset.type === "circle" ? "50%" : "0%",
                transform: `translate(-50%, -50%) rotate(${totalRotation}deg)`,
                cursor: "move",
              }}
              className={isSelected ? "ring-2 ring-blue-500" : ""}
            />
          );
        }

        if (asset.type === "line") {
          return (
            <div
              key={asset.id}
              onMouseDown={(e) => onAssetMouseDown(e, asset.id)}
              style={{
                position: "absolute",
                left: leftPx,
                top: topPx,
                width: (asset.width ?? 100) * asset.scale,
                height: (asset.strokeWidth ?? 2) * asset.scale,
                backgroundColor: asset.strokeColor,
                transform: `translate(-50%, -50%) rotate(${totalRotation}deg)`,
                cursor: "move",
              }}
              className={isSelected ? "ring-2 ring-blue-500" : ""}
            />
          );
        }

        if (!def) return null;
        const Icon = def.icon;
        return (
          <div
            key={asset.id}
            onMouseDown={(e) => onAssetMouseDown(e, asset.id)}
            style={{
              position: "absolute",
              left: leftPx,
              top: topPx,
              transform: `translate(-50%, -50%) rotate(${totalRotation}deg) scale(${asset.scale})`,
            }}
            className={isSelected ? "ring-2 ring-blue-500 bg-blue-50 p-1 rounded" : "text-[var(--accent)]"}
          >
            <Icon size={24} />
          </div>
        );
      })}

      <span className="absolute bottom-2 right-2 text-xs text-gray-400 pointer-events-none">
        {canvas.size} ({canvas.width}×{canvas.height} mm)
      </span>
    </div>
  );
}

