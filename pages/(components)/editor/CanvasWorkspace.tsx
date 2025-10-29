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
const MIN_ZOOM_BASE = 0.3; // base lowest zoom allowed
const MIN_ZOOM_PADDING = 1.12; // slight buffer so min zoom feels a bit larger
const OVERSCROLL_MAX = 120; // px maximum visual overscroll
const OVERSCROLL_RESIST = 0.45; // resistance factor for overscroll movement
const EDGE_PADDING_MM = 10; // padding in mm to keep canvas away from viewport edges

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
  const [canvasPos, setCanvasPos] = useState({ x: 200, y: 150 });

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

  // Compute canvas metadata (always provide a fallback)
  const canvas = useMemo(() => {
    if (actualData?.canvases?.[0]) {
      return {
        size: actualData.canvases[0].size,
        width: actualData.canvases[0].width,
        height: actualData.canvases[0].height,
      };
    }
    return {
      size: "layout",
      width: 1000, // mm fallback
      height: 700, // mm fallback
    };
  }, [actualData]);

  // Animate zoom/offset towards targets smoothly
  useEffect(() => {
    let raf = 0;

    const tick = () => {
      // Smooth zoom
      setZoom((z) => {
        const dz = targetZoom.current - z;
        if (Math.abs(dz) < 0.001) return targetZoom.current;
        return z + dz * 0.2;
      });

      // Smooth offset
      setOffset((o) => {
        const dx = targetOffset.current.x - o.x;
        const dy = targetOffset.current.y - o.y;
        if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) {
          // ensure final target is strictly clamped
          return clampOffset(targetOffset.current, targetZoom.current, false);
        }
        const candidate = { x: o.x + dx * 0.2, y: o.y + dy * 0.2 };
        // always clamp strictly here to avoid any chance of exposing background
        return clampOffset(candidate, targetZoom.current, false);
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
    // Compute a dynamic minimum zoom so the canvas at minimum fills the container
    const computeMinZoom = (): number => {
      const rect = el.getBoundingClientRect();
      // canvas dimensions in px (without workspace zoom)
      const canvasPxWNoZoom = canvas.width * MM_TO_PX;
      const canvasPxHNoZoom = canvas.height * MM_TO_PX;
      if (!canvasPxWNoZoom || !canvasPxHNoZoom) return MIN_ZOOM_BASE;
      const minW = rect.width / canvasPxWNoZoom;
      const minH = rect.height / canvasPxHNoZoom;
      const min = Math.min(minW, minH);
      // apply a small padding factor so minimum zoom is slightly larger than exact fit
      const padded = min * MIN_ZOOM_PADDING;
      // clamp to sensible bounds
      return Math.min(3, Math.max(MIN_ZOOM_BASE, padded));
    };

    const onWheel = (e: WheelEvent) => {
      // Use ctrl/cmd as zoom modifier (same as original)
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();

        const rect = el.getBoundingClientRect();
        const cursor = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        };

        // Convert cursor to scene coordinates before zoom
        const sceneX = (cursor.x - targetOffset.current.x) / targetZoom.current;
        const sceneY = (cursor.y - targetOffset.current.y) / targetZoom.current;

        // Compute new zoom and clamp to dynamic minimum
        const delta = -e.deltaY * ZOOM_SENSITIVITY;
        const desired = targetZoom.current + delta;
        const minZoom = computeMinZoom();
        const newZoom = Math.min(3, Math.max(minZoom, desired));

        // Compute new offset so that scene point under cursor stays fixed
        const newOffset = {
          x: cursor.x - sceneX * newZoom,
          y: cursor.y - sceneY * newZoom,
        };

        // Apply targets (smoothly animated in RAF loop)
        targetZoom.current = newZoom;
        // clamp offset immediately (no overscroll for zoom)
        targetOffset.current = clampOffset(newOffset, newZoom, false);
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Wheel-to-pan: when user scrolls without ctrl/meta, pan the workspace instead of scrolling the page
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheelPan = (e: WheelEvent) => {
      // if ctrl/meta -> zoom handler handles it
      if (e.ctrlKey || e.metaKey) return;
      // If the event target is an input or has scrollable children, let it scroll
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName?.toLowerCase();
        if (tag === "input" || tag === "textarea" || target.isContentEditable) return;
      }

      e.preventDefault();

      // deltaX/deltaY are in pixels; invert to move the scene in the expected direction
      const dx = e.deltaX;
      const dy = e.deltaY;

      // Update the target offset (allow overscroll while scrolling)
      const candidate = { x: targetOffset.current.x - dx, y: targetOffset.current.y - dy };
      // Strictly clamp while panning with wheel so canvas cannot be moved outside workspace
      targetOffset.current = clampOffset(candidate, targetZoom.current, false);
    };

    el.addEventListener("wheel", onWheelPan, { passive: false });
    return () => el.removeEventListener("wheel", onWheelPan);
  }, [canvas]);

  // enforce minimum zoom on resize/initial mount so canvas never appears smaller than workspace
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const enforceMin = () => {
      const rect = el.getBoundingClientRect();
      const canvasPxWNoZoom = canvas.width * MM_TO_PX;
      const canvasPxHNoZoom = canvas.height * MM_TO_PX;
      if (!canvasPxWNoZoom || !canvasPxHNoZoom) return;
  const minW = rect.width / canvasPxWNoZoom;
  const minH = rect.height / canvasPxHNoZoom;
  const minZoom = Math.min(minW, minH) * MIN_ZOOM_PADDING;
  const clampedMin = Math.min(3, Math.max(MIN_ZOOM_BASE, minZoom));
      if (targetZoom.current < clampedMin) {
        targetZoom.current = clampedMin;
        // center the canvas in viewport at this zoom and clamp to bounds
        const centeredOffset = {
          x: rect.width / 2 - (canvasPxWNoZoom * clampedMin) / 2,
          y: rect.height / 2 - (canvasPxHNoZoom * clampedMin) / 2,
        };
        targetOffset.current = clampOffset(centeredOffset, clampedMin);
      }
    };

    // enforce on mount and when window resizes
    enforceMin();
    window.addEventListener("resize", enforceMin);
    return () => window.removeEventListener("resize", enforceMin);
  }, [canvas]);

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
        // compute candidate and strictly clamp to padding - do not allow overscroll
        const candidate = { x: targetOffset.current.x + dx, y: targetOffset.current.y + dy };
        const clamped = clampOffset(candidate, targetZoom.current, false);
        // update both the live offset and the target so canvas cannot leave bounds
        setOffset(clamped);
        targetOffset.current = clamped;
      };

      const onDocUp = () => {
        isPanning.current = false;
        // when panning ends, animate offset back to strict bounds (no overscroll)
        targetOffset.current = clampOffset(targetOffset.current, targetZoom.current, false);
        document.removeEventListener("mousemove", onDocMove);
        document.removeEventListener("mouseup", onDocUp);
      };

      document.addEventListener("mousemove", onDocMove);
      document.addEventListener("mouseup", onDocUp);
    }
  };

  // Compute canvas pixel dimensions for positioning (mm -> px)
  const canvasPxWNoZoom = canvas.width * MM_TO_PX;
  const canvasPxHNoZoom = canvas.height * MM_TO_PX;
  const canvasPxW = canvasPxWNoZoom * zoom;
  const canvasPxH = canvasPxHNoZoom * zoom;

  // Clamp an offset so the canvas (after zoom) stays covering the viewport
  const clampOffset = (offsetCandidate: { x: number; y: number }, zoomVal: number, allowOverscroll = false) => {
    const el = containerRef.current;
    if (!el) return offsetCandidate;
    const rect = el.getBoundingClientRect();
    const vw = rect.width;
    const vh = rect.height;

    const canvasW = canvas.width * MM_TO_PX; // scene px
    const canvasH = canvas.height * MM_TO_PX; // scene px
    const leftScene = canvasPos.x - canvasW / 2;
    const topScene = canvasPos.y - canvasH / 2;

  // convert padding (mm) to screen px at this zoom so edges never come closer than EDGE_PADDING_MM
  const padPx = EDGE_PADDING_MM * MM_TO_PX * zoomVal;

  // allowed offset.x range so canvas covers viewport horizontally (with padding)
  // require canvas right edge >= padPx from viewport right, and left edge >= padPx from viewport left
  const minOffsetX = vw - padPx - (leftScene + canvasW) * zoomVal; // offset.x >= minOffsetX
  const maxOffsetX = padPx - leftScene * zoomVal; // offset.x <= maxOffsetX

    let x = offsetCandidate.x;
    if (minOffsetX > maxOffsetX) {
      // canvas narrower than viewport at this zoom -> center horizontally
      x = vw / 2 - (leftScene + canvasW / 2) * zoomVal;
    } else if (!allowOverscroll) {
      x = Math.min(maxOffsetX, Math.max(minOffsetX, x));
    } else {
      // allow a bit of overscroll with resistance
      if (x < minOffsetX) {
        const over = minOffsetX - x;
        x = minOffsetX - Math.min(OVERSCROLL_MAX, over * OVERSCROLL_RESIST);
      } else if (x > maxOffsetX) {
        const over = x - maxOffsetX;
        x = maxOffsetX + Math.min(OVERSCROLL_MAX, over * OVERSCROLL_RESIST);
      }
    }

    // vertical
  const minOffsetY = vh - padPx - (topScene + canvasH) * zoomVal;
  const maxOffsetY = padPx - topScene * zoomVal;
    let y = offsetCandidate.y;
    if (minOffsetY > maxOffsetY) {
      y = vh / 2 - (topScene + canvasH / 2) * zoomVal;
    } else if (!allowOverscroll) {
      y = Math.min(maxOffsetY, Math.max(minOffsetY, y));
    } else {
      if (y < minOffsetY) {
        const over = minOffsetY - y;
        y = minOffsetY - Math.min(OVERSCROLL_MAX, over * OVERSCROLL_RESIST);
      } else if (y > maxOffsetY) {
        const over = y - maxOffsetY;
        y = maxOffsetY + Math.min(OVERSCROLL_MAX, over * OVERSCROLL_RESIST);
      }
    }

    return { x, y };
  };

    // Strictly enforce bounds whenever offset/zoom/canvas changes to avoid exposing background
    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      const strict = clampOffset(offset, targetZoom.current, false);
      if (strict.x !== offset.x || strict.y !== offset.y) {
        // Always snap targetOffset to strict bounds to avoid exposure
        targetOffset.current = strict;
      }
    }, [offset, zoom, canvas.width, canvas.height, canvasPos.x, canvasPos.y]);

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
        {/* Canvas (paper) - positioned in scene coordinates. Use absolute positioning so it participates in parent's transform correctly. */}
        <div
          style={{
            position: "absolute",
            left: `${canvasPos.x - canvasPxWNoZoom / 2}px`,
            top: `${canvasPos.y - canvasPxHNoZoom / 2}px`,
            width: `${canvasPxWNoZoom}px`,
            height: `${canvasPxHNoZoom}px`,
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

