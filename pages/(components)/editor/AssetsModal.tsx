"use client";

import {
  FaChair,
  FaUtensils,
  FaMusic,
  FaBeer,
  FaBirthdayCake,
  FaMicrophone,
  FaTable,
  FaWineGlassAlt,
  FaUsers,
  FaCamera,
} from "react-icons/fa";
import { IoClose } from "react-icons/io5";

type AssetsModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function AssetsModal({ isOpen, onClose }: AssetsModalProps) {
  const assets = [
    { icon: <FaChair size={24} />, label: "Chair" },
    { icon: <FaTable size={24} />, label: "Table" },
    { icon: <FaUsers size={24} />, label: "Guests" },
    { icon: <FaUtensils size={24} />, label: "Food" },
    { icon: <FaBeer size={24} />, label: "Drinks" },
    { icon: <FaMusic size={24} />, label: "Music" },
    { icon: <FaMicrophone size={24} />, label: "Mic" },
    { icon: <FaBirthdayCake size={24} />, label: "Cake" },
    { icon: <FaWineGlassAlt size={24} />, label: "Wine" },
    { icon: <FaCamera size={24} />, label: "Camera" },
  ];

  if (!isOpen) return null;

  console.log("Modal is running")

  return (
    <div className="fixed left-1/2 top-16 -translate-x-1/2 w-[27.75rem] h-[19.5rem] bg-[#FDFDFF] rounded-[2rem] p-5 shadow-lg z-[9999]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-[1.25rem] font-medium text-[#272235]">Assets</span>
        <div className="flex items-center gap-2">
          <select className="w-[16.5rem] h-[2.125rem] rounded-lg px-3 text-sm bg-[#00000008] outline-none">
            <option>Starter Layouts</option>
            <option>Layout 1</option>
            <option>Layout 2</option>
          </select>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-black"
          >
            <IoClose size={20} />
          </button>
        </div>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search for Assets"
        className="w-full h-[2.125rem] rounded-lg px-3 text-sm bg-[#00000008] outline-none mb-4"
      />

      {/* Grid */}
      <div className="grid grid-cols-5 gap-3">
        {assets.map((a, i) => (
          <div
            key={i}
            className="w-[4.5rem] h-[4.5rem] rounded-2xl bg-[#0933BB08] p-2 flex flex-col items-center justify-center"
          >
            <div className="text-[var(--accent)]">{a.icon}</div>
            <span className="text-[0.625rem] text-[var(--accent)] mt-1">
              {a.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

