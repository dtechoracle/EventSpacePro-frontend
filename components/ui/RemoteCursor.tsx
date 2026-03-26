"use client";

import React from 'react';

interface RemoteCursorProps {
  userId: string;
  userName: string;
  userAvatar?: string;
  x: number;
  y: number;
  color: string;
}

export const RemoteCursor = ({ userName, x, y, color, userAvatar }: RemoteCursorProps) => {
  return (
    <div
      className="absolute pointer-events-none z-[1000] flex flex-col items-center transition-all duration-75 ease-out"
      style={{
        left: x,
        top: y,
      }}
    >
      <div className="relative">
        {/* Cursor Arrow */}
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ transform: 'rotate(-15deg)' }}
        >
          <path
            d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.500002 16.8829L0.500002 1.19841L11.7841 12.3673H5.65376Z"
            fill={color}
            stroke="white"
            strokeWidth="1.5"
          />
        </svg>

        {/* User Badge */}
        <div 
          className="absolute left-4 top-4 px-2 py-1 rounded-full text-white text-[10px] font-bold whitespace-nowrap shadow-sm border border-white/20 flex items-center gap-1"
          style={{ backgroundColor: color }}
        >
          {userAvatar && (
            <img 
              src={userAvatar} 
              alt={userName} 
              className="w-3 h-3 rounded-full object-cover" 
            />
          )}
          {userName}
        </div>
      </div>
    </div>
  );
};
