"use client";

import React from "react";
import { motion } from "framer-motion";

export default function Preloader() {
  const dotCount = 6;
  const dots = Array.from({ length: dotCount });
  const radius = 72; // orbit radius
  const totalDuration = 1.6;
  const times = [0, 0.36, 0.56, 1];

  const svgSize = radius * 2 + 64;
  const cx = svgSize / 2;
  const cy = svgSize / 2;
  const r = radius;
  const circumference = 2 * Math.PI * r;

  const arcSets = [
    { deg: 140, offsetDeg: -10, strokeWidth: 21, opacity: 0.5 },
    { deg: 100, offsetDeg: -25, strokeWidth: 16.5, opacity: 0.35 },
    { deg: 70, offsetDeg: 8, strokeWidth: 12, opacity: 0.25 },
    { deg: 40, offsetDeg: -18, strokeWidth: 9, opacity: 0.15 },
  ];
  const rotateKeyframes = [0, 1440, 360, 360];
  const scaleKeyframes = [1, 1, 0.16, 1];
  const centerScaleKeyframes = [1, 0.9, 1.15, 1];

  return (
    <div className="w-screen h-screen fixed inset-0 z-[99999] bg-black/80 flex items-center justify-center backdrop-blur-md">
      <div className="relative" style={{ width: svgSize, height: svgSize }}>
        {/* pulsing center circle */}
        <motion.div
          aria-hidden
          className="absolute left-1/2 top-1/2 rounded-full bg-white z-20 -translate-x-1/2 -translate-y-1/2"
          style={{ width: 48, height: 48 }}
          animate={{ scale: centerScaleKeyframes }}
          transition={{
            duration: totalDuration,
            times,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        <motion.div
          className="absolute inset-0"
          style={{ transformOrigin: "50% 50%" }}
          animate={{
            rotate: rotateKeyframes,
            scale: scaleKeyframes,
          }}
          transition={{
            duration: totalDuration,
            times,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <svg
            className="absolute inset-0 pointer-events-none"
            width={svgSize}
            height={svgSize}
            viewBox={`0 0 ${svgSize} ${svgSize}`}
            xmlns="http://www.w3.org/2000/svg"
          >
            {dots.map((_, i) => {
              const baseAngleDeg = (i / dotCount) * 360;
              return (
                <g
                  key={`arcs-${i}`}
                  transform={`rotate(${baseAngleDeg} ${cx} ${cy})`}
                >
                  {arcSets.map((arc, ai) => {
                    const arcLen = (arc.deg / 360) * circumference;
                    const dashOffset = (-arc.offsetDeg / 360) * circumference;

                    return (
                      <motion.g
                        key={ai}
                        initial={{ opacity: 0 }}
                        animate={{
                          opacity: [0, arc.opacity, arc.opacity * 0.4, 0],
                        }}
                        transition={{
                          duration: totalDuration,
                          times,
                          repeat: Infinity,
                          ease: "easeInOut",
                          delay: i * 0.02,
                        }}
                      >
                        <circle
                          cx={cx}
                          cy={cy}
                          r={r}
                          fill="none"
                          stroke="white"
                          strokeWidth={arc.strokeWidth}
                          strokeLinecap="round"
                          strokeDasharray={`${arcLen} ${circumference}`}
                          strokeDashoffset={dashOffset}
                          // keep blur only for trails, not circles
                          style={{
                            filter: `blur(${ai * 1.2 + 1}px)`,
                          }}
                        />
                      </motion.g>
                    );
                  })}
                </g>
              );
            })}
          </svg>

          {/* orbiting small circles: back to 22px, sharp white */}
          {dots.map((_, i) => {
            const angle = (i / dotCount) * Math.PI * 2;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;

            return (
              <div
                key={`dot-${i}`}
                className="absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
                style={{
                  width: 22,
                  height: 22,
                  transform: `translate(${x}px, ${y}px)`,
                }}
              />
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}

