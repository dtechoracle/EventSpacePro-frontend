"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import Canvas from "./Canvas";
import { EventData } from "@/store/sceneStore";

// Type for API response that wraps EventData
type EventDataResponse =
  | {
      data: EventData;
    }
  | EventData;

const MM_TO_PX = 2; // must match the constant used in Canvas for mm -> px
const ZOOM_SENSITIVITY = 0.001;

interface CanvasWorkspaceProps {
  eventData?: EventDataResponse | null;
}

export default function CanvasWorkspace({ eventData }: CanvasWorkspaceProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // workspace (viewport) transform (pan & zoom)
  const [zoom, setZoom] = useState(1); // current zoom (displayed)
  const targetZoom = useRef(1); // desired zoom (set by wheel)
  const [offset, setOffset] = useState({ x: 0, y: 0 }); // workspace pan (px)
  const targetOffset = useRef({ x: 0, y: 0 }); // for smooth zoom animation

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
  const actualData = useMemo(() => {
    if (!eventData) return null;
    return "data" in eventData ? eventData.data : eventData;
  }, [eventData]);

  const canvas = useMemo(() => {
    return actualData?.canvases?.[0]
      ? {
          size: actualData.canvases[0].size,
          width: actualData.canvases[0].width,
          height: actualData.canvases[0].height,
        }
      : {
          size: "layout",
          width: 1000,
          height: 1000,
        };
  }, [actualData]);

  // Calculate canvas dimensions in pixels
  const canvasPxW = canvas.width * MM_TO_PX;
  const canvasPxH = canvas.height * MM_TO_PX;

  // center the canvas inside the viewport on first mount
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();

    // Position canvas at center of viewport
    setCanvasPos({
      x: rect.width / 2,
      y: rect.height / 2,
    });

    // Reset offset to zero (no initial pan)
    setOffset({ x: 0, y: 0 });
    targetOffset.current = { x: 0, y: 0 };
  }, [canvas, actualData]);

  // Smooth zoom animation using requestAnimationFrame
  useEffect(() => {
    let raf: number;
    const tick = () => {
      setZoom((z) => {
        const diff = targetZoom.current - z;
        if (Math.abs(diff) < 0.001) return targetZoom.current;
        return z + diff * 0.2;
      });
      setOffset((o) => {
        const dx = targetOffset.current.x - o.x;
        const dy = targetOffset.current.y - o.y;
        if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1)
          return targetOffset.current;
        return { x: o.x + dx * 0.2, y: o.y + dy * 0.2 };
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ✅ Cursor-centered zoom (the point under the cursor remains fixed)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const clamp = (v: number) => Math.min(3, Math.max(0.2, v));

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();

        const rect = el.getBoundingClientRect();
        const cursor = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        };

        // Step 1: Convert cursor to scene coordinates before zoom
        const sceneX = (cursor.x - targetOffset.current.x) / targetZoom.current;
        const sceneY = (cursor.y - targetOffset.current.y) / targetZoom.current;

        // Step 2: Compute new zoom
        const delta = -e.deltaY * ZOOM_SENSITIVITY;
        const newZoom = clamp(targetZoom.current + delta);

        // Step 3: Compute new offset so that scene point under cursor stays fixed
        const newOffset = {
          x: cursor.x - sceneX * newZoom,
          y: cursor.y - sceneY * newZoom,
        };

        // Step 4: Apply targets (smoothly animated in RAF loop)
        targetZoom.current = newZoom;
        targetOffset.current = newOffset;
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
        setOffset((o) => {
          const newOffset = { x: o.x + dx, y: o.y + dy };
          targetOffset.current = newOffset;
          return newOffset;
        });
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
    >
      {/* Scene container */}
      <div
        className="relative w-full h-full"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
          transformOrigin: "top left",
        }}
      >
        {/* Canvas (paper) */}
        <div
          style={{
            position: "fixed",
            left: canvasPos.x - canvasPxW / 2,
            top: canvasPos.y - canvasPxH / 2,
          }}
        >
          <Canvas
            workspaceZoom={zoom}
            mmToPx={MM_TO_PX}
            canvasPos={canvasPos}
            setCanvasPos={setCanvasPos}
            canvas={canvas}
            assets={actualData?.canvasAssets || []}
          />
        </div>
      </div>
    </div>
  );
}

