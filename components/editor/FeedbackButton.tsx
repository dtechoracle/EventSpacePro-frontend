"use client";

import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaBug, FaLightbulb, FaCommentDots, FaTimes, FaPaperPlane, FaCheck } from "react-icons/fa";
import { apiRequest } from "@/helpers/Config";

type FeedbackType = "bug" | "feature" | "general";

interface FeedbackData {
  type: FeedbackType;
  message: string;
  email: string;
  page: string;
  timestamp: string;
}

const FEEDBACK_TYPES: { id: FeedbackType; label: string; icon: React.ReactNode; color: string }[] = [
  { id: "bug", label: "Bug Report", icon: <FaBug className="w-3.5 h-3.5" />, color: "text-red-500" },
  { id: "feature", label: "Feature Request", icon: <FaLightbulb className="w-3.5 h-3.5" />, color: "text-amber-500" },
  { id: "general", label: "General Feedback", icon: <FaCommentDots className="w-3.5 h-3.5" />, color: "text-blue-500" },
];

export default function FeedbackButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("bug");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    const handler = () => setIsOpen(true);
    window.addEventListener("esp-open-feedback", handler);
    return () => window.removeEventListener("esp-open-feedback", handler);
  }, []);

  const reset = () => {
    setType("bug");
    setMessage("");
    setEmail("");
    setSending(false);
    setSent(false);
    setError("");
  };

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(reset, 300);
  };

  const handleSubmit = async () => {
    if (!message.trim()) {
      setError("Please describe your feedback");
      return;
    }

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please enter a valid email address");
      return;
    }

    setSending(true);
    setError("");

    const payload: FeedbackData = {
      type,
      message: message.trim(),
      email: email.trim(),
      page: typeof window !== "undefined" ? window.location.pathname : "unknown",
      timestamp: new Date().toISOString(),
    };

    try {
      await apiRequest("/feedback", "POST", payload);

      setSent(true);
      setTimeout(handleClose, 2200);
    } catch (err) {
      setError("Failed to send. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(true)}
        data-tour="feedback-btn"
        title="Submit Feedback"
        className="fixed bottom-6 left-6 z-[9999] h-10 px-3 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg hover:from-purple-700 hover:to-indigo-700 transition-all flex items-center gap-2 text-sm font-medium"
      >
        <FaCommentDots className="w-4 h-4" />
        <span className="hidden sm:inline">Feedback</span>
      </button>

      {/* Modal */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[10000] bg-black/40"
              onClick={handleClose}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="fixed z-[10001] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[440px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden"
            >
              {sent ? (
                <div className="flex flex-col items-center justify-center py-12 px-6">
                  <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mb-4">
                    <FaCheck className="w-7 h-7 text-green-600" />
                  </div>
                  <p className="text-lg font-semibold text-gray-900">Thank you!</p>
                  <p className="text-sm text-gray-500 mt-1">Your feedback has been sent successfully.</p>
                </div>
              ) : (
                <>
                  {/* Header */}
                  <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <div>
                      <h3 className="font-semibold text-gray-900">Send Feedback</h3>
                      <p className="text-xs text-gray-400 mt-0.5">Report bugs, request features, or share ideas</p>
                    </div>
                    <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1">
                      <FaTimes className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Body */}
                  <div className="px-5 py-4 space-y-4">
                    {/* Type selector */}
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">Type</label>
                      <div className="flex gap-2">
                        {FEEDBACK_TYPES.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => setType(t.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                              type === t.id
                                ? "bg-blue-50 border-blue-300 text-blue-700"
                                : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                            }`}
                          >
                            <span className={t.color}>{t.icon}</span>
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Message */}
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">
                        Description <span className="text-red-400">*</span>
                      </label>
                      <textarea
                        ref={textareaRef}
                        value={message}
                        onChange={(e) => {
                          setMessage(e.target.value);
                          setError("");
                        }}
                        placeholder={
                          type === "bug"
                            ? "Describe the bug: what happened, what you expected, steps to reproduce..."
                            : type === "feature"
                            ? "Describe the feature you'd like to see..."
                            : "Share your thoughts or suggestions..."
                        }
                        className="w-full h-28 px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none placeholder:text-gray-400"
                      />
                      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
                    </div>

                    {/* Email */}
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">
                        Your Email <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400"
                      />
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-100 bg-gray-50">
                    <button
                      onClick={handleClose}
                      className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={sending || !message.trim() || !email.trim()}
                      className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium rounded-xl hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {sending ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <FaPaperPlane className="w-3.5 h-3.5" />
                          Send Feedback
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
