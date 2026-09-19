"use client";

import React, { useCallback, useRef, useState, useEffect } from "react";
import { useEditorStore } from "@/store/editorStore";

const BAR_SIZE = 8;
const THUMB_COLOR = "rgba(150,150,150,0.5)";
const THUMB_ACTIVE_COLOR = "rgba(100,100,100,0.7)";

export default function WorkspaceScrollIndicators() {
  const zoom = useEditorStore(s => s.zoom);
  const panX = useEditorStore(s => s.panX);
  const panY = useEditorStore(s => s.panY);
  const [activeAxis, setActiveAxis] = useState<"h" | "v" | null>(null);
  const [trackLens, setTrackLens] = useState({ w: 0, h: 0 });
  const dragRef = useRef({ startX: 0, startY: 0, startPanX: 0, startPanY: 0 });

  // Measure tracks on mount + resize
  const hRef = useCallback((el: HTMLDivElement | null) => {
    if (el) setTrackLens(prev => ({ ...prev, w: el.clientWidth }));
  }, []);
  const vRef = useCallback((el: HTMLDivElement | null) => {
    if (el) setTrackLens(prev => ({ ...prev, h: el.clientHeight }));
  }, []);

  useEffect(() => {
    const onResize = () => {
      const h = document.getElementById('sb-h');
      const v = document.getElementById('sb-v');
      setTrackLens({ w: h?.clientWidth || 0, h: v?.clientHeight || 0 });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const handleMouseDown = useCallback((axis: "h" | "v", e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveAxis(axis);
    const store = useEditorStore.getState();
    dragRef.current = { startX: e.clientX, startY: e.clientY, startPanX: store.panX, startPanY: store.panY };

    const onMove = (me: MouseEvent) => {
      me.preventDefault();
      const dx = me.clientX - dragRef.current.startX;
      const dy = me.clientY - dragRef.current.startY;
      const s = useEditorStore.getState();
      if (axis === "h") {
        const newPan = dragRef.current.startPanX + dx;
        useEditorStore.setState({ panX: newPan });
      } else {
        const newPan = dragRef.current.startPanY + dy;
        useEditorStore.setState({ panY: newPan });
      }
    };

    const onUp = () => {
      setActiveAxis(null);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove, { passive: false });
    document.addEventListener("mouseup", onUp);
  }, []);

  const stopProp = useCallback((e: React.MouseEvent) => e.stopPropagation(), []);

  // Compute thumb info
  const viewW = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const viewH = typeof window !== 'undefined' ? window.innerHeight : 800;
  const worldViewW = viewW / zoom;
  const worldViewH = viewH / zoom;

  // Virtual workspace grows based on how far user has panned
  // Minimum = 3x viewport, but expands as panning increases
  const absPanW = Math.abs(panX);
  const absPanH = Math.abs(panY);
  const totalRangeW = viewW + absPanW + viewW; // viewport + pan distance + buffer
  const totalRangeH = viewH + absPanH + viewH;
  const refSizeW = Math.max(viewW * 3, totalRangeW);
  const refSizeH = Math.max(viewH * 3, totalRangeH);

  // Thumb size = fraction of track (viewport / total range)
  const thumbSizeW = trackLens.w > 0 ? Math.max(20, (worldViewW / refSizeW) * trackLens.w) : 0;
  const thumbSizeH = trackLens.h > 0 ? Math.max(20, (worldViewH / refSizeH) * trackLens.h) : 0;

  // Thumb position: panX is in world units (negative = panned left)
  // Map pan to fraction of track
  const fractionX = trackLens.w > thumbSizeW ? -panX / refSizeW : 0;
  const fractionY = trackLens.h > thumbSizeH ? -panY / refSizeH : 0;
  const thumbLeft = Math.max(0, Math.min(trackLens.w - thumbSizeW, fractionX * (trackLens.w - thumbSizeW)));
  const thumbTop = Math.max(0, Math.min(trackLens.h - thumbSizeH, fractionY * (trackLens.h - thumbSizeH)));

  const handleTrackClick = useCallback((axis: "h" | "v", e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const trackLen = axis === "h" ? rect.width : rect.height;
    const thumbPx = axis === "h" ? thumbSizeW : thumbSizeH;
    const ratio = axis === "h"
      ? (e.clientX - rect.left) / trackLen
      : (e.clientY - rect.top) / trackLen;
    const range = axis === "h" ? refSizeW : refSizeH;
    const newPan = -(ratio * range);
    const store = useEditorStore.getState();
    if (axis === "h") useEditorStore.setState({ panX: Math.max(-range, Math.min(0, newPan)) });
    else useEditorStore.setState({ panY: Math.max(-range, Math.min(0, newPan)) });
    handleMouseDown(axis, e);
  }, [thumbSizeW, thumbSizeH, refSizeW, refSizeH, handleMouseDown]);

  return (
    <>
      <div
        id="sb-h"
        ref={hRef}
        className="absolute bottom-0 left-0 right-0 z-40"
        style={{ height: BAR_SIZE, cursor: "default" }}
        onMouseDown={(e) => { stopProp(e); handleTrackClick("h", e); }}
        onMouseMove={stopProp}
      >
        {trackLens.w > 0 && (
          <div
            style={{
              position: "absolute",
              left: thumbLeft,
              top: (BAR_SIZE - 5) / 2,
              width: thumbSizeW,
              height: 5,
              borderRadius: 2.5,
              background: activeAxis === "h" ? THUMB_ACTIVE_COLOR : THUMB_COLOR,
              cursor: "default",
              pointerEvents: "auto",
            }}
            onMouseDown={(e) => { stopProp(e); handleMouseDown("h", e); }}
          />
        )}
      </div>

      <div
        id="sb-v"
        ref={vRef}
        className="absolute top-0 right-0 bottom-0 z-40"
        style={{ width: BAR_SIZE, cursor: "default" }}
        onMouseDown={(e) => { stopProp(e); handleTrackClick("v", e); }}
        onMouseMove={stopProp}
      >
        {trackLens.h > 0 && (
          <div
            style={{
              position: "absolute",
              left: (BAR_SIZE - 5) / 2,
              top: thumbTop,
              width: 5,
              height: thumbSizeH,
              borderRadius: 2.5,
              background: activeAxis === "v" ? THUMB_ACTIVE_COLOR : THUMB_COLOR,
              cursor: "default",
              pointerEvents: "auto",
            }}
            onMouseDown={(e) => { stopProp(e); handleMouseDown("v", e); }}
          />
        )}
      </div>
    </>
  );
}
