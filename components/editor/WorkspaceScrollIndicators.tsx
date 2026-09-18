"use client";

import React, { useCallback, useRef, useState } from "react";
import { useEditorStore } from "@/store/editorStore";

const BAR_THICKNESS = 10;
const THUMB_COLOR = "rgba(100,116,139,0.45)";
const THUMB_HOVER_COLOR = "rgba(100,116,139,0.7)";
const TRACK_COLOR = "rgba(0,0,0,0.06)";
const MIN_THUMB = 30;

export default function WorkspaceScrollIndicators() {
  const zoom = useEditorStore(s => s.zoom);
  const panX = useEditorStore(s => s.panX);
  const panY = useEditorStore(s => s.panY);
  const panBy = useEditorStore(s => s.panBy);
  const [dragging, setDragging] = useState<"h" | "v" | null>(null);
  const [hoverBar, setHoverBar] = useState<"h" | "v" | null>(null);
  const dragRef = useRef({ startX: 0, startY: 0 });
  const trackLenRef = useRef({ w: 0, h: 0 });

  const handleMouseDown = useCallback((axis: "h" | "v", e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(axis);
    dragRef.current = { startX: e.clientX, startY: e.clientY };

    const handleMouseMove = (me: MouseEvent) => {
      const dx = me.clientX - dragRef.current.startX;
      const dy = me.clientY - dragRef.current.startY;
      dragRef.current = { startX: me.clientX, startY: me.clientY };

      // Direct 1:1 mapping — moving the thumb 1px pans the canvas 1px in screen space
      // Convert screen pixels to world units by dividing by zoom
      const zoomState = useEditorStore.getState().zoom;
      if (axis === "h") {
        panBy(-dx / zoomState, 0);
      } else {
        panBy(0, -dy / zoomState);
      }
    };

    const handleMouseUp = () => {
      setDragging(null);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [panBy]);

  const makeTrackRef = useCallback((axis: "h" | "v") => (el: HTMLDivElement | null) => {
    if (el) {
      if (axis === "h") trackLenRef.current.w = el.clientWidth;
      else trackLenRef.current.h = el.clientHeight;
    }
  }, []);

  return (
    <>
      {/* Horizontal scrollbar — full width along bottom */}
      <div
        ref={makeTrackRef("h")}
        className="absolute bottom-0 left-0 right-0 z-40"
        style={{ height: BAR_THICKNESS, background: TRACK_COLOR, pointerEvents: "auto" }}
        onMouseEnter={() => setHoverBar("h")}
        onMouseLeave={() => { if (!dragging) setHoverBar(null); }}
        onMouseDown={(e) => handleMouseDown("h", e)}
      >
        <Thumb trackRef={trackLenRef} axis="h" zoom={zoom} panX={panX} panY={panY} dragging={dragging} hoverBar={hoverBar} onMouseDown={handleMouseDown} />
      </div>

      {/* Vertical scrollbar — full height along right */}
      <div
        ref={makeTrackRef("v")}
        className="absolute top-0 right-0 bottom-0 z-40"
        style={{ width: BAR_THICKNESS, background: TRACK_COLOR, pointerEvents: "auto" }}
        onMouseEnter={() => setHoverBar("v")}
        onMouseLeave={() => { if (!dragging) setHoverBar(null); }}
        onMouseDown={(e) => handleMouseDown("v", e)}
      >
        <Thumb trackRef={trackLenRef} axis="v" zoom={zoom} panX={panX} panY={panY} dragging={dragging} hoverBar={hoverBar} onMouseDown={handleMouseDown} />
      </div>
    </>
  );
}

function Thumb({ trackRef, axis, zoom, panX, panY, dragging, hoverBar, onMouseDown }: {
  trackRef: React.MutableRefObject<{ w: number; h: number }>;
  axis: "h" | "v";
  zoom: number;
  panX: number;
  panY: number;
  dragging: "h" | "v" | null;
  hoverBar: "h" | "v" | null;
  onMouseDown: (axis: "h" | "v", e: React.MouseEvent) => void;
}) {
  const trackLen = axis === "h" ? trackRef.current.w : trackRef.current.h;
  if (trackLen === 0) return null;

  // Thumb size = viewport fraction of a large virtual area, scaled by zoom
  // At zoom 1, thumb is ~1/3 of track. As you zoom in, thumb shrinks.
  const virtualSize = trackLen * 3;
  const viewportWorld = axis === "h"
    ? (typeof window !== 'undefined' ? window.innerWidth : 1200) / zoom
    : (typeof window !== 'undefined' ? window.innerHeight : 800) / zoom;
  const thumbSize = Math.max(MIN_THUMB, (viewportWorld / virtualSize) * trackLen);

  // Thumb position: pan maps to a position on the track
  // panX=0 means viewport starts at world 0. Negative panX = panned left.
  const pan = axis === "h" ? panX : panY;
  const pixelsPerWorld = zoom;
  const panPixels = -pan * pixelsPerWorld;
  // Normalize: 0 = start, trackLen - thumbSize = end
  const maxOffset = virtualSize - viewportWorld;
  const thumbPos = maxOffset > 0
    ? Math.max(0, Math.min(trackLen - thumbSize, (panPixels / (maxOffset * pixelsPerWorld)) * (trackLen - thumbSize)))
    : 0;

  const isH = axis === "h";
  const isActive = dragging === axis || hoverBar === axis;

  return (
    <div
      style={{
        position: "absolute",
        left: isH ? thumbPos : (BAR_THICKNESS - 6) / 2,
        top: isH ? 0 : thumbPos,
        width: isH ? thumbSize : 6,
        height: isH ? 6 : thumbSize,
        borderRadius: 3,
        background: isActive ? THUMB_HOVER_COLOR : THUMB_COLOR,
        cursor: "grab",
        transition: dragging ? "none" : "background 0.15s",
      }}
      onMouseDown={(e) => onMouseDown(axis, e)}
    />
  );
}
