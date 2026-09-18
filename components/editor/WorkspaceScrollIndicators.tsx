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
  const trackLenRef = useRef({ w: 0, h: 0 });

  // Visible world-space size
  const viewW = (typeof window !== 'undefined' ? window.innerWidth : 1200) / zoom;
  const viewH = (typeof window !== 'undefined' ? window.innerHeight : 800) / zoom;

  // Thumb sizes (proportion of visible area to total workspace)
  const thumbWRatio = viewW / TOTAL_WORKSPACE;
  const thumbHRatio = viewH / TOTAL_WORKSPACE;

  // Thumb position (0..1 normalized)
  const maxPanX = TOTAL_WORKSPACE - viewW;
  const maxPanY = TOTAL_WORKSPACE - viewH;
  const normX = maxPanX > 0 ? Math.max(0, Math.min(1, (-panX) / maxPanX)) : 0;
  const normY = maxPanY > 0 ? Math.max(0, Math.min(1, (-panY) / maxPanY)) : 0;

  const handleMouseDown = useCallback((axis: "h" | "v", e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(axis);
    dragRef.current = { startX: e.clientX, startY: e.clientY, startPanX: panX, startPanY: panY };

    const handleMouseMove = (me: MouseEvent) => {
      const dx = me.clientX - dragRef.current.startX;
      const dy = me.clientY - dragRef.current.startY;
      const trackLen = axis === "h" ? trackLenRef.current.w : trackLenRef.current.h;
      const thumbSize = axis === "h" ? thumbWRatio * trackLen : thumbHRatio * trackLen;
      const thumbPx = Math.max(MIN_THUMB, thumbSize);
      const panRange = axis === "h" ? maxPanX : maxPanY;
      const pixelToPan = panRange / Math.max(1, trackLen - thumbPx);

      if (axis === "h") {
        const newPanX = dragRef.current.startPanX - dx * pixelToPan;
        setPan(Math.max(-TOTAL_WORKSPACE, Math.min(0, newPanX)), panY);
      } else {
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
  }, [panX, panY, setPan, maxPanX, maxPanY, thumbWRatio, thumbHRatio]);

  const makeTrackRef = useCallback((axis: "h" | "v") => (el: HTMLDivElement | null) => {
    if (el) {
      if (axis === "h") trackLenRef.current.w = el.clientWidth;
      else trackLenRef.current.h = el.clientHeight;
    }
  }, []);

  return (
    <>
      {/* Horizontal scrollbar - full width along bottom edge */}
      <div
        ref={makeTrackRef("h")}
        className="absolute bottom-0 left-0 right-0 z-40"
        style={{
          height: BAR_THICKNESS,
          background: TRACK_COLOR,
          cursor: "default",
          pointerEvents: "auto",
        }}
        onMouseEnter={() => setHoverBar("h")}
        onMouseLeave={() => { if (!dragging) setHoverBar(null); }}
        onMouseDown={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const trackLen = rect.width;
          const thumbPx = Math.max(MIN_THUMB, thumbWRatio * trackLen);
          const clickRatio = (e.clientX - rect.left) / trackLen;
          const newPanX = -(clickRatio * maxPanX);
          setPan(Math.max(-TOTAL_WORKSPACE, Math.min(0, newPanX)), panY);
          handleMouseDown("h", e);
        }}
      >
        <Thumb trackRef={trackLenRef} axis="h" norm={normX} ratio={thumbWRatio} dragging={dragging} hoverBar={hoverBar} onMouseDown={handleMouseDown} />
      </div>

      {/* Vertical scrollbar - full height along right edge */}
      <div
        ref={makeTrackRef("v")}
        className="absolute top-0 right-0 bottom-0 z-40"
        style={{
          width: BAR_THICKNESS,
          background: TRACK_COLOR,
          cursor: "default",
          pointerEvents: "auto",
        }}
        onMouseEnter={() => setHoverBar("v")}
        onMouseLeave={() => { if (!dragging) setHoverBar(null); }}
        onMouseDown={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const trackLen = rect.height;
          const thumbPx = Math.max(MIN_THUMB, thumbHRatio * trackLen);
          const clickRatio = (e.clientY - rect.top) / trackLen;
          const newPanY = -(clickRatio * maxPanY);
          setPan(panX, Math.max(-TOTAL_WORKSPACE, Math.min(0, newPanY)));
          handleMouseDown("v", e);
        }}
      >
        <Thumb trackRef={trackLenRef} axis="v" norm={normY} ratio={thumbHRatio} dragging={dragging} hoverBar={hoverBar} onMouseDown={handleMouseDown} />
      </div>
    </>
  );
}

function Thumb({ trackRef, axis, norm, ratio, dragging, hoverBar, onMouseDown }: {
  trackRef: React.MutableRefObject<{ w: number; h: number }>;
  axis: "h" | "v";
  norm: number;
  ratio: number;
  dragging: "h" | "v" | null;
  hoverBar: "h" | "v" | null;
  onMouseDown: (axis: "h" | "v", e: React.MouseEvent) => void;
}) {
  const trackLen = axis === "h" ? trackRef.current.w : trackRef.current.h;
  const thumbSize = Math.max(MIN_THUMB, ratio * trackLen);
  const thumbPos = norm * Math.max(0, trackLen - thumbSize);
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
