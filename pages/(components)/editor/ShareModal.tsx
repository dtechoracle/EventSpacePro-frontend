"use client";

import { motion, AnimatePresence } from "framer-motion";
import { FaLink, FaImage, FaFilePdf } from "react-icons/fa";

export default function ShareModal({ onClose }: { onClose: () => void }) {
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
          className="bg-white w-[32rem] rounded-[2.25rem] p-6 flex flex-col gap-6 relative"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 1st line */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Share event</h2>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 text-[var(--accent)]"
            >
              <FaLink />
              <span className="text-sm font-medium">Copy link</span>
            </motion.button>
          </div>

          {/* 2nd line */}
          <div className="flex items-center gap-3">
            <input
              type="email"
              placeholder="Enter collaborator's email"
              className="w-full h-11 rounded-md px-3 py-2 bg-[#00000008] text-sm outline-none"
            />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-[var(--accent)] text-white h-full px-5 w-24 py-2 rounded-md text-sm font-medium"
            >
              Invite
            </motion.button>
          </div>

          {/* 3rd line */}
          <div className="flex items-center justify-between">
            <span className="font-medium">Save as</span>
            <button className="text-[var(--accent)] text-sm font-medium">
              Choose format
            </button>
          </div>

          <div className="flex gap-6 justify-center">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="w-52 h-40 rounded-2xl bg-[#F47A1D0D] flex flex-col items-center justify-center gap-2 cursor-pointer"
            >
              <FaImage className="text-[#F47A1D] text-[1.75rem]" size={60} />
              <span className="text-[#F47A1D] font-medium">PNG, JPG</span>
            </motion.div>

            {/* Box 2 */}
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="w-52 h-40 rounded-2xl bg-[#F41D700D] flex flex-col items-center justify-center gap-2 cursor-pointer"
            >
              <FaFilePdf className="text-[#F41D70] text-[1.75rem]" size={60} />
              <span className="text-[#F41D70] font-medium">PDF</span>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

