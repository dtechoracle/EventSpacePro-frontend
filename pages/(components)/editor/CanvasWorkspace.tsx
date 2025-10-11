"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import Canvas from "./Canvas";
import { useSceneStore, EventData } from "@/store/sceneStore";

// Type for API response that wraps EventData
type EventDataResponse = {
  data: EventData;
} | EventData;

const MM_TO_PX = 2; // must match the constant used in Canvas for mm -> px

interface CanvasWorkspaceProps {
  eventData?: EventDataResponse | null;
}

export default function CanvasWorkspace({ eventData }: CanvasWorkspaceProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // workspace (viewport) transform (pan & zoom)
  const [zoom, setZoom] = useState(1); // current zoom (displayed)
  const targetZoom = useRef(1); // desired zoom (set by wheel)
  const [offset, setOffset] = useState({ x: 0, y: 0 }); // workspace pan (px)

  const isPanning = useRef(false);
  const lastPanPos = useRef({ x: 0, y: 0 });

  // canvas (paper) position INSIDE the scene (scene coordinates, px)
  const [canvasPos, setCanvasPos] = useState({ x: 0, y: 0 });

  // detect spacebar pressed to pan
  const isSpaceDown = useRef(false);
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") isSpaceDown.current = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") isSpaceDown.current = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // Use event data directly instead of store
  // The eventData has a 'data' wrapper based on the API response
  const actualData = useMemo(() => {
    if (!eventData) return null;
    return 'data' in eventData ? eventData.data : eventData;
  }, [eventData]);
  
  const canvas = useMemo(() => {
    return actualData?.canvases?.[0] ? {
      size: actualData.canvases[0].size,
      width: actualData.canvases[0].width,
      height: actualData.canvases[0].height,
    } : null;
  }, [actualData]);

  // Calculate canvas dimensions in pixels
  const canvasPxW = canvas ? canvas.width * MM_TO_PX : 0;
  const canvasPxH = canvas ? canvas.height * MM_TO_PX : 0;

  // center the canvas inside the viewport on first mount
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !canvas) return;

    const rect = el.getBoundingClientRect();

    // Center the canvas in the viewport (relative to center transform origin)
    setCanvasPos({
      x: rect.width / 2,
      y: rect.height / 2,
    });
    
    // Reset offset to center the view
    setOffset({
      x: rect.width / 2,
      y: rect.height / 2,
    });
  }, [canvas]);

  // Smooth zoom animation using requestAnimationFrame
  useEffect(() => {
    let raf: number;
    const tick = () => {
      setZoom((z) => {
        const diff = targetZoom.current - z;
        if (Math.abs(diff) < 0.001) return targetZoom.current;
        return z + diff * 0.2; // easing factor
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Wheel zoom handler (updates targetZoom only)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = -e.deltaY * 0.001;
        targetZoom.current = Math.min(
          3,
          Math.max(0.2, targetZoom.current + delta)
        );
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Workspace pan
  const handlePointerDown = (e: React.MouseEvent) => {
    if (e.button === 1 || isSpaceDown.current) {
      e.preventDefault();
      isPanning.current = true;
      lastPanPos.current = { x: e.clientX, y: e.clientY };

      const onDocMove = (ev: MouseEvent) => {
        if (!isPanning.current) return;
        const dx = ev.clientX - lastPanPos.current.x;
        const dy = ev.clientY - lastPanPos.current.y;
        lastPanPos.current = { x: ev.clientX, y: ev.clientY };
        setOffset((o) => ({ x: o.x + dx, y: o.y + dy }));
      };

      const onDocUp = () => {
        isPanning.current = false;
        document.removeEventListener("mousemove", onDocMove);
        document.removeEventListener("mouseup", onDocUp);
      };

      document.addEventListener("mousemove", onDocMove);
      document.addEventListener("mouseup", onDocUp);
    }
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden bg-gray-100"
      onMouseDown={handlePointerDown}
      style={{
        backgroundImage:
          "linear-gradient(to right, #e5e7eb 1px, transparent 1px), linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)",
        backgroundSize: "20px 20px",
      }}
    >
      {/* Scene container */}
      <div
        className="relative w-full h-full"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
          transformOrigin: "center center",
        }}
      >
        {/* Canvas (paper) */}
        <div
          style={{
            position: "absolute",
            left: canvasPos.x - (canvasPxW || 0) / 2,
            top: canvasPos.y - (canvasPxH || 0) / 2,
          }}
        >
          <Canvas
            workspaceZoom={zoom}
            mmToPx={MM_TO_PX}
            canvasPos={canvasPos}
            setCanvasPos={setCanvasPos}
            canvas={canvas}
            assets={actualData?.canvasAssets || []}
            eventData={actualData}
          />
        </div>
      </div>
    </div>
  );
}

