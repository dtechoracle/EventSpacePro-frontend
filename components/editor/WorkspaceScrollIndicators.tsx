"use client";

import React, { useCallback, useRef, useState } from "react";
import { useEditorStore } from "@/store/editorStore";

const TOTAL_WORKSPACE = 50000;
const MIN_THUMB = 40;
const BAR_THICKNESS = 10;
const THUMB_COLOR = "rgba(100,116,139,0.45)";
const THUMB_HOVER_COLOR = "rgba(100,116,139,0.7)";
const TRACK_COLOR = "rgba(0,0,0,0.06)";

export default function WorkspaceScrollIndicators() {
  const zoom = useEditorStore(s => s.zoom);
  const panX = useEditorStore(s => s.panX);
  const panY = useEditorStore(s => s.panY);
  const setPan = useEditorStore(s => s.setPan);
  const [dragging, setDragging] = useState<"h" | "v" | null>(null);
  const [hoverBar, setHoverBar] = useState<"h" | "v" | null>(null);
  const dragRef = useRef({ startX: 0, startY: 0, startPanX: 0, startPanY: 0 });

  // Visible world-space size
  const viewW = (typeof window !== 'undefined' ? window.innerWidth : 1200) / zoom;
  const viewH = (typeof window !== 'undefined' ? window.innerHeight : 800) / zoom;

  // Thumb sizes (proportion of visible area to total workspace)
  const thumbW = Math.max(MIN_THUMB, (viewW / TOTAL_WORKSPACE) * 200);
  const thumbH = Math.max(MIN_THUMB, (viewH / TOTAL_WORKSPACE) * 200);

  // Track lengths (CSS pixel length of the scrollbar track)
  const trackLen = 200;

  // Thumb position (0..1 normalized)
  const maxPanX = TOTAL_WORKSPACE - viewW;
  const maxPanY = TOTAL_WORKSPACE - viewH;
  const normX = maxPanX > 0 ? Math.max(0, Math.min(1, (-panX) / maxPanX)) : 0;
  const normY = maxPanY > 0 ? Math.max(0, Math.min(1, (-panY) / maxPanY)) : 0;

  const thumbLeft = normX * (trackLen - thumbW);
  const thumbTop = normY * (trackLen - thumbH);

  const handleMouseDown = useCallback((axis: "h" | "v", e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(axis);
    dragRef.current = { startX: e.clientX, startY: e.clientY, startPanX: panX, startPanY: panY };

    const handleMouseMove = (me: MouseEvent) => {
      const dx = me.clientX - dragRef.current.startX;
      const dy = me.clientY - dragRef.current.startY;

      if (axis === "h") {
        const panRange = maxPanX;
        const pixelToPan = panRange / (trackLen - thumbW);
        const newPanX = dragRef.current.startPanX - dx * pixelToPan;
        setPan(Math.max(-TOTAL_WORKSPACE, Math.min(0, newPanX)), panY);
      } else {
        const panRange = maxPanY;
        const pixelToPan = panRange / (trackLen - thumbH);
        const newPanY = dragRef.current.startPanY - dy * pixelToPan;
        setPan(panX, Math.max(-TOTAL_WORKSPACE, Math.min(0, newPanY)));
      }
    };

    const handleMouseUp = () => {
      setDragging(null);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [panX, panY, setPan, maxPanX, maxPanY, thumbW, thumbH]);

  return (
    <>
      {/* Horizontal scrollbar - bottom right */}
      <div
        className="absolute bottom-2 right-6 z-40"
        style={{
          width: trackLen,
          height: BAR_THICKNESS,
          borderRadius: 5,
          background: TRACK_COLOR,
          cursor: "default",
          pointerEvents: "auto",
        }}
        onMouseEnter={() => setHoverBar("h")}
        onMouseLeave={() => { if (!dragging) setHoverBar(null); }}
        onMouseDown={(e) => {
          // Click on track: jump thumb to click position
          const rect = e.currentTarget.getBoundingClientRect();
          const clickRatio = (e.clientX - rect.left) / rect.width;
          const newPanX = -(clickRatio * maxPanX);
          setPan(Math.max(-TOTAL_WORKSPACE, Math.min(0, newPanX)), panY);
          handleMouseDown("h", e);
        }}
      >
        <div
          style={{
            position: "absolute",
            left: thumbLeft,
            top: (BAR_THICKNESS - 6) / 2,
            width: thumbW,
            height: 6,
            borderRadius: 3,
            background: dragging === "h" || hoverBar === "h" ? THUMB_HOVER_COLOR : THUMB_COLOR,
            cursor: "grab",
            transition: dragging ? "none" : "background 0.15s",
          }}
          onMouseDown={(e) => handleMouseDown("h", e)}
        />
      </div>

      {/* Vertical scrollbar - bottom right */}
      <div
        className="absolute bottom-6 right-2 z-40"
        style={{
          width: BAR_THICKNESS,
          height: trackLen,
          borderRadius: 5,
          background: TRACK_COLOR,
          cursor: "default",
          pointerEvents: "auto",
        }}
        onMouseEnter={() => setHoverBar("v")}
        onMouseLeave={() => { if (!dragging) setHoverBar(null); }}
        onMouseDown={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const clickRatio = (e.clientY - rect.top) / rect.height;
          const newPanY = -(clickRatio * maxPanY);
          setPan(panX, Math.max(-TOTAL_WORKSPACE, Math.min(0, newPanY)));
          handleMouseDown("v", e);
        }}
      >
        <div
          style={{
            position: "absolute",
            left: (BAR_THICKNESS - 6) / 2,
            top: thumbTop,
            width: 6,
            height: thumbH,
            borderRadius: 3,
            background: dragging === "v" || hoverBar === "v" ? THUMB_HOVER_COLOR : THUMB_COLOR,
            cursor: "grab",
            transition: dragging ? "none" : "background 0.15s",
          }}
          onMouseDown={(e) => handleMouseDown("v", e)}
        />
      </div>
    </>
  );
}
