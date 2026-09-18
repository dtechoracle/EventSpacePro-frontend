"use client";

import React, { useCallback, useRef, useState } from "react";
import { useEditorStore } from "@/store/editorStore";

const BAR_SIZE = 8;
const THUMB_COLOR = "rgba(150,150,150,0.5)";
const THUMB_ACTIVE_COLOR = "rgba(100,100,100,0.7)";
const TRACK_COLOR = "rgba(0,0,0,0.04)";

export default function WorkspaceScrollIndicators() {
  const zoom = useEditorStore(s => s.zoom);
  const panX = useEditorStore(s => s.panX);
  const panY = useEditorStore(s => s.panY);
  const panBy = useEditorStore(s => s.panBy);
  const [activeAxis, setActiveAxis] = useState<"h" | "v" | null>(null);
  const dragRef = useRef({ startX: 0, startY: 0 });
  const trackLenRef = useRef({ w: 0, h: 0 });

  const handleMouseDown = useCallback((axis: "h" | "v", e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveAxis(axis);
    dragRef.current = { startX: e.clientX, startY: e.clientY };

    const handleMouseMove = (me: MouseEvent) => {
      const dx = me.clientX - dragRef.current.startX;
      const dy = me.clientY - dragRef.current.startY;
      dragRef.current = { startX: me.clientX, startY: me.clientY };
      const z = useEditorStore.getState().zoom;
      if (axis === "h") panBy(-dx / z, 0);
      else panBy(0, -dy / z);
    };

    const handleMouseUp = () => {
      setActiveAxis(null);
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
      {/* Horizontal scrollbar — bottom edge */}
      <div
        ref={makeTrackRef("h")}
        className="absolute bottom-0 left-0 right-0 z-40"
        style={{ height: BAR_SIZE, background: TRACK_COLOR, cursor: "default" }}
        onMouseDown={(e) => handleMouseDown("h", e)}
      >
        <Thumb trackRef={trackLenRef} axis="h" zoom={zoom} panX={panX} panY={panY} activeAxis={activeAxis} onMouseDown={handleMouseDown} />
      </div>

      {/* Vertical scrollbar — right edge */}
      <div
        ref={makeTrackRef("v")}
        className="absolute top-0 right-0 bottom-0 z-40"
        style={{ width: BAR_SIZE, background: TRACK_COLOR, cursor: "default" }}
        onMouseDown={(e) => handleMouseDown("v", e)}
      >
        <Thumb trackRef={trackLenRef} axis="v" zoom={zoom} panX={panX} panY={panY} activeAxis={activeAxis} onMouseDown={handleMouseDown} />
      </div>
    </>
  );
}

function Thumb({ trackRef, axis, zoom, panX, panY, activeAxis, onMouseDown }: {
  trackRef: React.MutableRefObject<{ w: number; h: number }>;
  axis: "h" | "v";
  zoom: number;
  panX: number;
  panY: number;
  activeAxis: "h" | "v" | null;
  onMouseDown: (axis: "h" | "v", e: React.MouseEvent) => void;
}) {
  const trackLen = axis === "h" ? trackRef.current.w : trackRef.current.h;
  if (trackLen === 0) return null;

  const viewSize = axis === "h"
    ? (typeof window !== 'undefined' ? window.innerWidth : 1200) / zoom
    : (typeof window !== 'undefined' ? window.innerHeight : 800) / zoom;

  // Virtual workspace = 5x viewport, so thumb is at least 1/5 of track
  const virtualSize = Math.max(viewSize * 5, 10000);
  const thumbRatio = Math.min(1, viewSize / virtualSize);
  const thumbSize = Math.max(20, thumbRatio * trackLen);

  // Pan position as fraction
  const pan = axis === "h" ? panX : panY;
  const panFraction = -pan / virtualSize;
  const thumbPos = Math.max(0, Math.min(trackLen - thumbSize, panFraction * (trackLen - thumbSize)));

  const isH = axis === "h";
  const isActive = activeAxis === axis;

  return (
    <div
      style={{
        position: "absolute",
        left: isH ? thumbPos : (BAR_SIZE - 5) / 2,
        top: isH ? (BAR_SIZE - 5) / 2 : thumbPos,
        width: isH ? thumbSize : 5,
        height: isH ? 5 : thumbSize,
        borderRadius: 2.5,
        background: isActive ? THUMB_ACTIVE_COLOR : THUMB_COLOR,
        cursor: "grab",
        pointerEvents: "auto",
      }}
      onMouseDown={(e) => onMouseDown(axis, e)}
    />
  );
}
