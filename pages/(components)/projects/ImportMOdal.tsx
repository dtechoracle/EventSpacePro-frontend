"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RiImage2Line, RiFilePdf2Line } from "react-icons/ri";
import { SiAutodesk } from "react-icons/si";

export default function ImportModal({ onClose }: { onClose: () => void }) {
  const [selectedType, setSelectedType] = useState<"image" | "pdf" | "autocad" | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleConfirm = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      console.log("Selected files:", Array.from(e.target.files));
      onClose();
    }
  };

  const acceptMap: Record<string, string> = {
    image: "image/*",
    pdf: "application/pdf",
    autocad: ".dwg,.dxf,.dwf",
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[9999]"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 30 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="bg-[#FDFDFF] w-[28rem] min-h-[16rem] rounded-[2.25rem] p-[2rem] flex flex-col gap-6 relative"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="text-[1.75rem] font-semibold text-[#272235]">Import Files</h2>

          <div className="grid grid-cols-3 gap-4">
            <button
              onClick={() => setSelectedType("image")}
              className={`flex flex-col items-center justify-center gap-2 p-4 border rounded-2xl ${
                selectedType === "image" ? "border-[var(--accent)] bg-[var(--accent)]/10" : "border-gray-300"
              }`}
            >
              <RiImage2Line size={28} className="text-[var(--accent)]" />
              <span className="text-sm">Images</span>
            </button>

            <button
              onClick={() => setSelectedType("pdf")}
              className={`flex flex-col items-center justify-center gap-2 p-4 border rounded-2xl ${
                selectedType === "pdf" ? "border-[var(--accent)] bg-[var(--accent)]/10" : "border-gray-300"
              }`}
            >
              <RiFilePdf2Line size={28} className="text-red-500" />
              <span className="text-sm">PDF</span>
            </button>

            <button
              onClick={() => setSelectedType("autocad")}
              className={`flex flex-col items-center justify-center gap-2 p-4 border rounded-2xl ${
                selectedType === "autocad" ? "border-[var(--accent)] bg-[var(--accent)]/10" : "border-gray-300"
              }`}
            >
              <SiAutodesk size={28} className="text-blue-600" />
              <span className="text-sm">AutoCAD</span>
            </button>
          </div>

          <button
            onClick={handleConfirm}
            disabled={!selectedType}
            className="w-full h-12 rounded-2xl text-white text-base font-medium bg-[var(--accent)] disabled:opacity-50"
          >
            Confirm
          </button>

          {/* hidden file input */}
          <input
            type="file"
            multiple
            ref={fileInputRef}
            className="hidden"
            accept={selectedType ? acceptMap[selectedType] : undefined}
            onChange={handleFileChange}
          />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

