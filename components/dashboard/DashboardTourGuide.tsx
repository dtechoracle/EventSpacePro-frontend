"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaHome,
  FaLayerGroup,
  FaSearch,
  FaPlus,
  FaRegCalendarAlt,
  FaTh,
  FaQuestionCircle,
  FaArrowLeft,
  FaArrowRight,
  FaTimes,
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
      "This is your dashboard — the home for everything you create. Let's take a quick tour of the key areas.",
    icon: <FaHome className="w-4 h-4" />,
    selector: "",
    position: "bottom",
  },
  {
    id: "sidebar",
    title: "Navigation Sidebar",
    content:
      "Jump between your projects, favorites, templates, AI Assistant, and Trash from here. Click your avatar to edit your profile, or the chevron to collapse the sidebar.",
    icon: <FaLayerGroup className="w-4 h-4" />,
    selector: '[data-tour="dash-sidebar"]',
    position: "right",
  },
  {
    id: "header",
    title: "Search & Quick Actions",
    content:
      "Search your projects and events by name, and use the New Event button on the right to start designing a fresh floor plan.",
    icon: <FaSearch className="w-4 h-4" />,
    selector: '[data-tour="dash-header"]',
    position: "bottom",
  },
  {
    id: "new-event",
    title: "Create a New Event",
    content:
      "Open the event creator to start from scratch or with AI — pick a preloaded venue, a marquee, or a blank canvas.",
    icon: <FaPlus className="w-4 h-4" />,
    selector: '[data-tour="dash-new-event"]',
    position: "bottom",
  },
  {
    id: "recent-events",
    title: "Recent Events",
    content:
      "Your latest events across all projects, sorted by when you last worked on them. Click any card to open it in the editor, or use View Projects for the full list.",
    icon: <FaRegCalendarAlt className="w-4 h-4" />,
    selector: '[data-tour="dash-recent-events"]',
    position: "bottom",
  },
  {
    id: "templates",
    title: "Templates",
    content:
      "Start faster with preloaded layouts. Hover a template and click Use template to create an event from it in one step.",
    icon: <FaTh className="w-4 h-4" />,
    selector: '[data-tour="dash-templates"]',
    position: "top",
  },
  {
    id: "done",
    title: "You're All Set!",
    content:
      "That's the dashboard tour. Click the ? button at the bottom-right anytime to revisit this guide. Let's get planning!",
    icon: <FaQuestionCircle className="w-4 h-4" />,
    selector: "",
    position: "bottom",
  },
];

const TOUR_KEY = "esp-dashboard-tour-completed";

function getElRect(selector: string): DOMRect | null {
  if (!selector || typeof document === "undefined") return null;
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
  if (typeof window === "undefined") return { top: 0, left: 0 };
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

export default function DashboardTourGuide() {
  const [active, setActive] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [completed, setCompleted] = useState(true);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const localDone = localStorage.getItem(TOUR_KEY) === "1";
    if (!localDone) {
      setCompleted(false);
      setActive(true);
    }
  }, []);

  const markDone = useCallback(() => {
    try {
      localStorage.setItem(TOUR_KEY, "1");
    } catch {}
    setCompleted(true);
    setActive(false);
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

  if (completed && !active) {
    return (
      <button
        onClick={startTour}
        data-tour="dash-help-btn"
        title="Revisit the tour guide"
        className="fixed bottom-6 right-6 z-[9999] w-10 h-10 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
      >
        <FaQuestionCircle className="w-5 h-5" />
      </button>
    );
  }

  return (
    <>
      {/* ? button */}
      <button
        onClick={startTour}
        data-tour="dash-help-btn"
        title="Take a tour of the dashboard"
        className="fixed bottom-6 right-6 z-[9999] w-10 h-10 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
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
