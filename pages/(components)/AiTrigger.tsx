"use client";

import { useEffect, useState, useRef } from "react";
import { FiSearch } from "react-icons/fi";
import { FaArrowUp } from "react-icons/fa";
import { GoPaperclip } from "react-icons/go";
import { motion, AnimatePresence } from "framer-motion";

export default function AiTrigger() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Handle keyboard shortcut (Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen(true);
        inputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSubmit = () => {
    if (!inputValue.trim()) return;
    console.log("Submitted:", inputValue);
    setInputValue("");
    setIsOpen(false);
  };

  return (
    <>
      <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg">
        <div className="relative">
          {/* Left icon */}
          <div className="absolute left-3 top-1/2 -translate-y-1/2 bg-gray-200 p-2 rounded-full">
            {isOpen ? (
              <GoPaperclip className="text-gray-600 w-4 h-4" />
            ) : (
              <FiSearch className="text-gray-600 w-4 h-4" />
            )}
          </div>

          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="What do you need help with?"
            onFocus={() => setIsOpen(true)}
            className="w-full pl-10 pr-16 py-4 rounded-full placeholder:opacity-100 shadow-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] text-[var(--accent)] bg-white"
          />

          {inputValue ? (
            <button
              onClick={handleSubmit}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-[var(--accent)] text-white rounded-full p-2 hover:bg-[var(--accent)] transition"
            >
              <FaArrowUp className="w-3 h-3" />
            </button>
          ) : (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs bg-gray-100 border border-gray-300 rounded-full px-2 py-1 text-gray-600 select-none">
              Ctrl + K
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 flex items-center justify-center backdrop-blur-sm bg-black/30"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-[80vw] h-[90vh] bg-white shadow-xl rounded-lg p-6 flex flex-col items-center justify-center text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-2xl font-bold">Hello John</h2>
              <p className="text-lg text-gray-600 mt-2">
                What are we planning today?
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

