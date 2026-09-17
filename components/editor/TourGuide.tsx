"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUserStore } from "@/store/userStore";
import { apiRequest } from "@/helpers/Config";
import {
  FaMousePointer,
  FaPenNib,
  FaShapes,
  FaLayerGroup,
  FaFileExport,
  FaComment,
  FaTh,
  FaSave,
  FaArrowLeft,
  FaArrowRight,
  FaTimes,
  FaQuestionCircle,
  FaCompressArrowsAlt,
  FaArrowsAlt,
  FaHome,
} from "react-icons/fa";

interface TourStep {
  id: string;
  title: string;
  content: string;
  icon: React.ReactNode;
  selector: string;
  position: "top" | "bottom" | "left" | "right";
}

const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to EventSpacePro!",
    content:
      "This workspace lets you design event floor plans with walls, furniture, and assets. Let's take a quick tour of all the tools available.",
    icon: <FaHome className="w-4 h-4" />,
    selector: "",
    position: "bottom",
  },
  {
    id: "sidebar",
    title: "Navigation Sidebar",
    content:
      "Navigate between your projects, dashboard, calendar, templates, and settings from here. Collapse it by clicking the chevron to get more workspace.",
    icon: <FaLayerGroup className="w-4 h-4" />,
    selector: '[data-tour="sidebar"]',
    position: "right",
  },
  {
    id: "elements",
    title: "Elements Panel",
    content:
      "See every element in your plan — walls, shapes, assets, text labels, and dimensions. Click any item to select it, or drag to reorder layers. Use the + buttons to add new elements.",
    icon: <FaLayerGroup className="w-4 h-4" />,
    selector: '[data-tour="elements"]',
    position: "right",
  },
  {
    id: "canvas",
    title: "Workspace Canvas",
    content:
      "Your main drawing area. Scroll to zoom in/out, middle-click or hold Space + drag to pan. Right-click for context menu options like duplicate, copy, paste, and delete.",
    icon: <FaCompressArrowsAlt className="w-4 h-4" />,
    selector: '[data-tour="canvas"]',
    position: "top",
  },
  {
    id: "toolbar",
    title: "Drawing Toolbar",
    content:
      "Switch between tools here: Selection pointer, Pan tool, Rectangle marquee select, Wall drawing, Shape tools (rectangle, circle, line, arrow, freehand), and dimension annotations. Click a tool to activate it, click again or press Escape to deactivate.",
    icon: <FaPenNib className="w-4 h-4" />,
    selector: '[data-tour="toolbar"]',
    position: "top",
  },
  {
    id: "properties",
    title: "Properties Panel",
    content:
      "Edit the selected element's properties — position, size, rotation, color, stroke, opacity, and more. Also contains Comments tab for team collaboration, Grid & Snap controls, and the Export panel.",
    icon: <FaMousePointer className="w-4 h-4" />,
    selector: '[data-tour="properties"]',
    position: "left",
  },
  {
    id: "grid",
    title: "Grid & Snap",
    content:
      "Toggle the grid overlay, adjust grid size, change measurement units, and enable snap-to-grid for precise alignment. Found inside the Properties Panel.",
    icon: <FaTh className="w-4 h-4" />,
    selector: '[data-tour="grid-controls"]',
    position: "left",
  },
  {
    id: "canvas-controls",
    title: "Canvas Controls",
    content:
      "Rotate your workspace clockwise or counterclockwise. Canvas dimensions are shown here. Found at the top-center above the workspace.",
    icon: <FaArrowsAlt className="w-4 h-4" />,
    selector: '[data-tour="canvas-controls"]',
    position: "bottom",
  },
  {
    id: "ai",
    title: "AI Assistant",
    content:
      "Ask the AI to create walls, place furniture, generate layouts, or analyze your plan. Describe what you want in plain English and the AI will execute it. You can also attach images for venue analysis.",
    icon: <FaComment className="w-4 h-4" />,
    selector: '[data-tour="ai-trigger"]',
    position: "left",
  },
  {
    id: "export",
    title: "Export Your Plan",
    content:
      "Export your floor plan as PDF, PNG, JPG, or DXF. Choose paper sizes, select export areas, or do a full workspace export. Found in the Properties Panel's Export tab.",
    icon: <FaFileExport className="w-4 h-4" />,
    selector: '[data-tour="export-tab"]',
    position: "left",
  },
  {
    id: "share",
    title: "Share & Collaborate",
    content:
      "Invite team members to view or edit this plan in real-time. Set permissions, share links, and see who's currently working on the plan.",
    icon: <FaComment className="w-4 h-4" />,
    selector: '[data-tour="share-btn"]',
    position: "bottom",
  },
  {
    id: "shortcuts",
    title: "Keyboard Shortcuts",
    content:
      "Press Ctrl+Z to undo, Ctrl+Y to redo, Ctrl+C/V for copy/paste, Delete to remove selected elements, Ctrl+G to group, and Ctrl+A to select all. Press Escape to deselect.",
    icon: <FaSave className="w-4 h-4" />,
    selector: '[data-tour="canvas"]',
    position: "top",
  },
  {
    id: "save",
    title: "Auto-Save",
    content:
      "Your work is automatically saved. You can also press Ctrl+S to save immediately. All changes are persisted to the cloud in real-time.",
    icon: <FaSave className="w-4 h-4" />,
    selector: '[data-tour="autosave"]',
    position: "bottom",
  },
  {
    id: "done",
    title: "You're All Set!",
    content:
      "You now know the basics. Start by drawing walls, then add furniture from the asset library. Need help? Click the AI Assistant or this ? button anytime. Happy designing!",
    icon: <FaQuestionCircle className="w-4 h-4" />,
    selector: "",
    position: "bottom",
  },
];

const TOUR_KEY = "esp-tour-completed";

function getElRect(selector: string): DOMRect | null {
  if (!selector) return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  return el.getBoundingClientRect();
}

function computeTooltipPos(
  targetRect: DOMRect | null,
  step: TourStep,
  tooltipW: number,
  tooltipH: number
): { top: number; left: number } {
  const PAD = 12;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  if (!targetRect) {
    return { top: vh / 2 - tooltipH / 2, left: vw / 2 - tooltipW / 2 };
  }

  const cx = targetRect.left + targetRect.width / 2;
  const cy = targetRect.top + targetRect.height / 2;

  let top = 0;
  let left = 0;

  switch (step.position) {
    case "top":
      top = targetRect.top - tooltipH - PAD;
      left = cx - tooltipW / 2;
      break;
    case "bottom":
      top = targetRect.bottom + PAD;
      left = cx - tooltipW / 2;
      break;
    case "left":
      top = cy - tooltipH / 2;
      left = targetRect.left - tooltipW - PAD;
      break;
    case "right":
      top = cy - tooltipH / 2;
      left = targetRect.right + PAD;
      break;
  }

  left = Math.max(8, Math.min(left, vw - tooltipW - 8));
  top = Math.max(8, Math.min(top, vh - tooltipH - 8));

  return { top, left };
}

export default function TourGuide() {
  const [active, setActive] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [completed, setCompleted] = useState(true);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const user = useUserStore((s) => s.user);

  useEffect(() => {
    if (!user) return;
    const backendDone = user.isTourGuide === true;
    const localDone = localStorage.getItem(TOUR_KEY) === "1";
    if (!backendDone && !localDone) {
      setCompleted(false);
      setActive(true);
    }
  }, [user]);

  const markDone = useCallback(() => {
    try {
      localStorage.setItem(TOUR_KEY, "1");
    } catch {}
    setCompleted(true);
    setActive(false);
    // Persist to backend
    apiRequest("/user", "PUT", { isTourGuide: true }, true).then(() => {
      useUserStore.setState((s) => ({
        user: s.user ? { ...s.user, isTourGuide: true } : s.user,
      }));
    }).catch(() => {});
  }, []);

  const startTour = useCallback(() => {
    setStepIdx(0);
    setActive(true);
  }, []);

  const step = TOUR_STEPS[stepIdx];
  const targetRect = step ? getElRect(step.selector) : null;

  const tooltipW = 380;
  const tooltipH = 220;
  const pos = computeTooltipPos(targetRect, step, tooltipW, tooltipH);

  useEffect(() => {
    if (!active) return;
    if (targetRect) {
      const el = document.querySelector(step.selector);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [active, stepIdx]);

  const goNext = () => {
    if (stepIdx < TOUR_STEPS.length - 1) setStepIdx((i) => i + 1);
    else markDone();
  };
  const goPrev = () => {
    if (stepIdx > 0) setStepIdx((i) => i - 1);
  };

  if (completed && !active) return null;

  return (
    <>
      {/* ? button */}
      <button
        onClick={startTour}
        data-tour="help-btn"
        title="Take a tour of the workspace"
        className="fixed bottom-6 left-20 z-[9999] w-10 h-10 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
      >
        <FaQuestionCircle className="w-5 h-5" />
      </button>

      <AnimatePresence>
        {active && (
          <>
            {/* Overlay backdrop */}
            <motion.div
              key="tour-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[10000]"
              style={{ background: "rgba(0,0,0,0.45)" }}
              onClick={markDone}
            />

            {/* Spotlight cutout */}
            {targetRect && (
              <motion.div
                key="tour-spotlight"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed z-[10001] pointer-events-none rounded-lg"
                style={{
                  top: targetRect.top - 6,
                  left: targetRect.left - 6,
                  width: targetRect.width + 12,
                  height: targetRect.height + 12,
                  boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
                }}
              />
            )}

            {/* Tooltip */}
            <motion.div
              ref={tooltipRef}
              key="tour-tooltip"
              initial={{ opacity: 0, scale: 0.92, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 8 }}
              transition={{ duration: 0.2 }}
              className="fixed z-[10002] bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col"
              style={{
                top: pos.top,
                left: pos.left,
                width: tooltipW,
                maxHeight: "80vh",
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <span className="text-blue-600">{step.icon}</span>
                  <span className="font-semibold text-sm text-gray-900">{step.title}</span>
                </div>
                <button
                  onClick={markDone}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <FaTimes className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Body */}
              <div className="px-4 py-3 flex-1">
                <p className="text-sm text-gray-600 leading-relaxed">{step.content}</p>
              </div>

              {/* Progress dots */}
              <div className="px-4 py-2 flex items-center justify-center gap-1.5">
                {TOUR_STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={`rounded-full transition-all duration-200 ${
                      i === stepIdx
                        ? "w-5 h-1.5 bg-blue-600"
                        : i < stepIdx
                        ? "w-1.5 h-1.5 bg-blue-400"
                        : "w-1.5 h-1.5 bg-gray-300"
                    }`}
                  />
                ))}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50 rounded-b-xl">
                <button
                  onClick={goPrev}
                  disabled={stepIdx === 0}
                  className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <FaArrowLeft className="w-3 h-3" />
                  Back
                </button>
                <span className="text-[11px] text-gray-400">
                  {stepIdx + 1} / {TOUR_STEPS.length}
                </span>
                <button
                  onClick={goNext}
                  className="flex items-center gap-1.5 text-xs font-medium bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {stepIdx === TOUR_STEPS.length - 1 ? (
                    "Finish"
                  ) : (
                    <>
                      Next
                      <FaArrowRight className="w-3 h-3" />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
