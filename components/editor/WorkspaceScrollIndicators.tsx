"use client";

import React, { useCallback, useRef, useState, useEffect, useMemo } from "react";
import { useEditorStore } from "@/store/editorStore";
import { useProjectStore } from "@/store/projectStore";

const BAR_SIZE = 8;
const THUMB_COLOR = "rgba(150,150,150,0.5)";
const THUMB_ACTIVE_COLOR = "rgba(100,100,100,0.7)";

function getContentBounds() {
  const { shapes, walls, assets, textAnnotations, dimensions, labelArrows } = useProjectStore.getState();
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let hasContent = false;

  for (const s of shapes) {
    if (s.hidden) continue;
    hasContent = true;
    const x1 = s.x;
    const y1 = s.y;
    const x2 = s.x + (s.width || 0);
    const y2 = s.y + (s.height || 0);
    minX = Math.min(minX, x1, x2);
    minY = Math.min(minY, y1, y2);
    maxX = Math.max(maxX, x1, x2);
    maxY = Math.max(maxY, y1, y2);
  }

  for (const a of assets) {
    if (a.hidden) continue;
    hasContent = true;
    minX = Math.min(minX, a.x);
    minY = Math.min(minY, a.y);
    maxX = Math.max(maxX, a.x + (a.width || 0));
    maxY = Math.max(maxY, a.y + (a.height || 0));
  }

  for (const w of walls) {
    if (w.hidden) continue;
    const nodeMap = new Map<string, { x: number; y: number }>();
    for (const node of w.nodes) {
      nodeMap.set(node.id, node);
      hasContent = true;
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x);
      maxY = Math.max(maxY, node.y);
    }
    for (const edge of w.edges) {
      const a = nodeMap.get(edge.nodeA);
      const b = nodeMap.get(edge.nodeB);
      if (a && b) {
        hasContent = true;
        minX = Math.min(minX, a.x, b.x);
        minY = Math.min(minY, a.y, b.y);
        maxX = Math.max(maxX, a.x, b.x);
        maxY = Math.max(maxY, a.y, b.y);
      }
    }
  }

  if (textAnnotations) {
    for (const t of textAnnotations) {
      if (t.hidden) continue;
      hasContent = true;
      minX = Math.min(minX, t.x);
      minY = Math.min(minY, t.y);
      maxX = Math.max(maxX, t.x + 200);
      maxY = Math.max(maxY, t.y + 40);
    }
  }

  if (dimensions) {
    for (const d of dimensions) {
      if (d.hidden) continue;
      hasContent = true;
      minX = Math.min(minX, d.startPoint.x, d.endPoint.x);
      minY = Math.min(minY, d.startPoint.y, d.endPoint.y);
      maxX = Math.max(maxX, d.startPoint.x, d.endPoint.x);
      maxY = Math.max(maxY, d.startPoint.y, d.endPoint.y);
    }
  }

  if (labelArrows) {
    for (const l of labelArrows) {
      if (l.hidden) continue;
      hasContent = true;
      minX = Math.min(minX, l.startPoint.x, l.endPoint.x);
      minY = Math.min(minY, l.startPoint.y, l.endPoint.y);
      maxX = Math.max(maxX, l.startPoint.x, l.endPoint.x);
      maxY = Math.max(maxY, l.startPoint.y, l.endPoint.y);
    }
  }

  if (!hasContent) return null;
  return { minX, minY, maxX, maxY };
}

export default function WorkspaceScrollIndicators() {
  const zoom = useEditorStore((s) => s.zoom);
  const panX = useEditorStore((s) => s.panX);
  const panY = useEditorStore((s) => s.panY);
  const [activeAxis, setActiveAxis] = useState<"h" | "v" | null>(null);
  const [trackLens, setTrackLens] = useState({ w: 0, h: 0 });
  const dragRef = useRef({ startX: 0, startY: 0, startPanX: 0, startPanY: 0 });

  // Re-compute content bounds whenever shapes change
  const shapes = useProjectStore((s) => s.shapes);
  const walls = useProjectStore((s) => s.walls);
  const assets = useProjectStore((s) => s.assets);
  const textAnnotations = useProjectStore((s) => s.textAnnotations);
  const dimensions = useProjectStore((s) => s.dimensions);
  const labelArrows = useProjectStore((s) => s.labelArrows);

  const contentBounds = useMemo(
    () => getContentBounds(),
    [shapes, walls, assets, textAnnotations, dimensions, labelArrows]
  );

  // Measure tracks on mount + resize
  const hRef = useCallback((el: HTMLDivElement | null) => {
    if (el) setTrackLens((prev) => ({ ...prev, w: el.clientWidth }));
  }, []);
  const vRef = useCallback((el: HTMLDivElement | null) => {
    if (el) setTrackLens((prev) => ({ ...prev, h: el.clientHeight }));
  }, []);

  useEffect(() => {
    const onResize = () => {
      const h = document.getElementById("sb-h");
      const v = document.getElementById("sb-v");
      setTrackLens({ w: h?.clientWidth || 0, h: v?.clientHeight || 0 });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Viewport size in world units
  const viewW = typeof window !== "undefined" ? window.innerWidth : 1200;
  const viewH = typeof window !== "undefined" ? window.innerHeight : 800;
  const worldViewW = viewW / zoom;
  const worldViewH = viewH / zoom;

  // Content bounds → scrollable range
  // The viewport left/top in world coordinates: -panX/zoom, -panY/zoom
  // We need to scroll so the content stays reachable
  // Scrollable range = how far the viewport can move before content goes off-screen
  const scrollRange = useMemo(() => {
    if (!contentBounds) return null;

    const padding = 100; // small padding around content
    const cMinX = contentBounds.minX - padding;
    const cMinY = contentBounds.minY - padding;
    const cMaxX = contentBounds.maxX + padding;
    const cMaxY = contentBounds.maxY + padding;
    const contentW = cMaxX - cMinX;
    const contentH = cMaxY - cMinY;

    // Viewport can scroll from showing cMinX (left edge of content) to showing cMaxX (right edge)
    // panX range: when viewport left = cMinX → -panX/zoom = cMinX → panX = -cMinX * zoom
    //            when viewport right = cMaxX → (-panX + viewW)/zoom = cMaxX → panX = -(cMaxX * zoom - viewW)
    const maxPanX = -cMinX * zoom;              // leftmost pan (showing left edge of content)
    const minPanX = -(cMaxX * zoom - viewW);     // rightmost pan (showing right edge of content)
    const maxPanY = -cMinY * zoom;
    const minPanY = -(cMaxY * zoom - viewH);

    // Content fits in viewport → no scrolling needed
    const needsScrollH = contentW > worldViewW;
    const needsScrollV = contentH > worldViewH;

    return { maxPanX, minPanX, maxPanY, minPanY, needsScrollH, needsScrollV };
  }, [contentBounds, zoom, viewW, viewH, worldViewW, worldViewH]);

  // Thumb calculations
  const thumbCalc = useMemo(() => {
    if (!scrollRange || !trackLens.w) return { thumbW: 0, thumbH: 0, thumbLeft: 0, thumbTop: 0 };

    let thumbW = 0, thumbH = 0, thumbLeft = 0, thumbTop = 0;

    if (scrollRange.needsScrollH && trackLens.w > 0) {
      const range = scrollRange.maxPanX - scrollRange.minPanX; // total pan range
      if (range > 0) {
        const fraction = worldViewW / (worldViewW + range); // viewport / total content
        thumbW = Math.max(24, fraction * trackLens.w);
        // Map panX to thumb position: panX goes from maxPanX (left) to minPanX (right)
        // When panX = maxPanX → thumb at left (0)
        // When panX = minPanX → thumb at right (trackLen - thumbW)
        const panFraction = (scrollRange.maxPanX - panX) / range;
        thumbLeft = Math.max(0, Math.min(trackLens.w - thumbW, panFraction * (trackLens.w - thumbW)));
      }
    }

    if (scrollRange.needsScrollV && trackLens.h > 0) {
      const range = scrollRange.maxPanY - scrollRange.minPanY;
      if (range > 0) {
        const fraction = worldViewH / (worldViewH + range);
        thumbH = Math.max(24, fraction * trackLens.h);
        const panFraction = (scrollRange.maxPanY - panY) / range;
        thumbTop = Math.max(0, Math.min(trackLens.h - thumbH, panFraction * (trackLens.h - thumbH)));
      }
    }

    return { thumbW, thumbH, thumbLeft, thumbTop };
  }, [scrollRange, panX, panY, worldViewW, worldViewH, trackLens]);

  // Drag: dragging thumb RIGHT → panX decreases (viewport moves right, showing right-side content)
  const handleMouseDown = useCallback(
    (axis: "h" | "v", e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setActiveAxis(axis);
      const store = useEditorStore.getState();
      dragRef.current = { startX: e.clientX, startY: e.clientY, startPanX: store.panX, startPanY: store.panY };

      const onMove = (me: MouseEvent) => {
        me.preventDefault();
        const dx = me.clientX - dragRef.current.startX;
        const dy = me.clientY - dragRef.current.startY;
        if (axis === "h") {
          // Dragging right (dx > 0) → panX should decrease
          useEditorStore.setState({ panX: dragRef.current.startPanX - dx });
        } else {
          useEditorStore.setState({ panY: dragRef.current.startPanY - dy });
        }
      };

      const onUp = () => {
        setActiveAxis(null);
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };

      document.addEventListener("mousemove", onMove, { passive: false });
      document.addEventListener("mouseup", onUp);
    },
    []
  );

  const stopProp = useCallback((e: React.MouseEvent) => e.stopPropagation(), []);

  // Track click → jump thumb to position then start drag
  const handleTrackClick = useCallback(
    (axis: "h" | "v", e: React.MouseEvent) => {
      if (!scrollRange) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const trackLen = axis === "h" ? rect.width : rect.height;
      if (trackLen <= 0) return;

      const ratio = axis === "h" ? (e.clientX - rect.left) / trackLen : (e.clientY - rect.top) / trackLen;

      if (axis === "h") {
        const range = scrollRange.maxPanX - scrollRange.minPanX;
        const newPan = scrollRange.maxPanX - ratio * range;
        useEditorStore.setState({ panX: Math.max(scrollRange.minPanX, Math.min(scrollRange.maxPanX, newPan)) });
      } else {
        const range = scrollRange.maxPanY - scrollRange.minPanY;
        const newPan = scrollRange.maxPanY - ratio * range;
        useEditorStore.setState({ panY: Math.max(scrollRange.minPanY, Math.min(scrollRange.maxPanY, newPan)) });
      }

      handleMouseDown(axis, e);
    },
    [scrollRange, handleMouseDown]
  );

  const showH = !!scrollRange?.needsScrollH && trackLens.w > 0 && thumbCalc.thumbW > 0;
  const showV = !!scrollRange?.needsScrollV && trackLens.h > 0 && thumbCalc.thumbH > 0;

  return (
    <>
      <div
        id="sb-h"
        ref={hRef}
        className="absolute bottom-0 left-0 right-0 z-40"
        style={{ height: BAR_SIZE, cursor: showH ? "default" : "default", opacity: showH ? 1 : 0, pointerEvents: showH ? "auto" : "none" }}
        onMouseDown={(e) => { stopProp(e); handleTrackClick("h", e); }}
        onMouseMove={stopProp}
      >
        {showH && (
          <div
            style={{
              position: "absolute",
              left: thumbCalc.thumbLeft,
              top: (BAR_SIZE - 5) / 2,
              width: thumbCalc.thumbW,
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
        style={{ width: BAR_SIZE, cursor: showV ? "default" : "default", opacity: showV ? 1 : 0, pointerEvents: showV ? "auto" : "none" }}
        onMouseDown={(e) => { stopProp(e); handleTrackClick("v", e); }}
        onMouseMove={stopProp}
      >
        {showV && (
          <div
            style={{
              position: "absolute",
              left: (BAR_SIZE - 5) / 2,
              top: thumbCalc.thumbTop,
              width: 5,
              height: thumbCalc.thumbH,
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
