"use client";

import { motion, AnimatePresence } from "framer-motion";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  confirmColor?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  confirmColor = "bg-red-600 hover:bg-red-700",
  onConfirm,
  onCancel,
  isLoading = false,
}: ConfirmModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[99999]"
          onClick={onCancel}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="bg-white text-gray-900 w-[24rem] rounded-xl p-7 shadow-xl border border-gray-200"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold mb-1 tracking-tight">{title}</h2>
            <p className="text-xs text-gray-500 mb-6 leading-relaxed">{description}</p>

            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 h-10 rounded-lg bg-gray-100 font-semibold text-gray-600 hover:bg-gray-200 transition-colors text-xs"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={isLoading}
                className={`flex-1 h-10 rounded-lg text-white font-semibold disabled:opacity-40 transition-all text-xs flex items-center justify-center gap-2 ${confirmColor}`}
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  confirmLabel
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
