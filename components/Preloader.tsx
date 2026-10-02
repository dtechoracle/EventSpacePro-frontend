"use client";

import React from "react";

export default function Preloader() {
  return (
    <div className="w-screen h-screen fixed inset-0 z-[99999] bg-white flex items-center justify-center">
      <div className="w-28 h-28 sm:w-36 sm:h-36">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="100%" height="100%">
          <defs>
            <style>{`
              :root {
                --c-navy: #041E42;
                --c-blue: #0056B3;
              }

              /* Base settings */
              .bg { fill: transparent; }
              .stroke-elem {
                stroke-linecap: round;
                stroke-linejoin: round;
              }

              /* Core Cluster (The Main Character) */
              .cluster-group {
                transform-origin: 165px 150px;
                animation: clusterPulse 2.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
              }
              .satellite-orbit {
                transform-origin: 165px 150px;
                animation: orbitSpin 2.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
              }
              .core-dot {
                transform-origin: 165px 150px;
                animation: coreScale 2.8s cubic-bezier(0.34, 1.56, 0.64, 1) infinite;
              }

              /* Outer Frame (Forming from the cluster) */
              .frame-path {
                stroke: var(--c-navy);
                stroke-width: 14;
                fill: none;
                stroke-dasharray: 850;
                stroke-dashoffset: 850;
                animation: drawFrame 2.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
              }

              /* Inner E-Stem */
              .inner-e {
                stroke: var(--c-navy);
                stroke-width: 14;
                fill: none;
                stroke-dasharray: 380;
                stroke-dashoffset: 380;
                animation: drawInnerE 2.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
              }

              /* --- Animation Timings & Transforms --- */
              @keyframes coreScale {
                0% {
                  transform: scale(0.2);
                  opacity: 0;
                }
                18% {
                  transform: scale(1.25);
                  opacity: 1;
                }
                28% {
                  transform: scale(1);
                }
                75% {
                  transform: scale(1);
                  opacity: 1;
                }
                90%, 100% {
                  transform: scale(0.2);
                  opacity: 0;
                }
              }

              @keyframes orbitSpin {
                0% {
                  transform: rotate(-120deg) scale(0);
                  opacity: 0;
                }
                20% {
                  transform: rotate(0deg) scale(1.1);
                  opacity: 1;
                }
                30% {
                  transform: rotate(0deg) scale(1);
                }
                75% {
                  transform: rotate(0deg) scale(1);
                  opacity: 1;
                }
                88%, 100% {
                  transform: rotate(60deg) scale(0);
                  opacity: 0;
                }
              }

              @keyframes clusterPulse {
                0%, 15% {
                  transform: translate(-15px, 0) scale(1.2);
                }
                35%, 75% {
                  transform: translate(0, 0) scale(1);
                }
                90%, 100% {
                  transform: translate(-15px, 0) scale(1.2);
                }
              }

              @keyframes drawFrame {
                0%, 22% {
                  stroke-dashoffset: 850;
                  opacity: 0;
                }
                30% {
                  opacity: 1;
                }
                55%, 75% {
                  stroke-dashoffset: 0;
                  opacity: 1;
                }
                90%, 100% {
                  stroke-dashoffset: -850;
                  opacity: 0;
                }
              }

              @keyframes drawInnerE {
                0%, 32% {
                  stroke-dashoffset: 380;
                  opacity: 0;
                }
                40% {
                  opacity: 1;
                }
                62%, 75% {
                  stroke-dashoffset: 0;
                  opacity: 1;
                }
                88%, 100% {
                  stroke-dashoffset: -380;
                  opacity: 0;
                }
              }
            `}</style>
          </defs>

          {/* Outer Frame */}
          <path className="frame-path stroke-elem" 
                d="M 215,92 
                   L 215,40 
                   L 40,40 
                   L 40,260 
                   L 215,260 
                   L 215,208" />

          {/* Inner 'E' Geometry */}
          <path className="inner-e stroke-elem" 
                d="M 175,82 
                   L 76,82 
                   L 76,218 
                   L 175,218 
                   M 76,150 
                   L 130,150" />

          {/* The Squiggly / Dot Cluster (Main Character) */}
          <g className="cluster-group">
            {/* Center Core Orb */}
            <circle className="core-dot" cx="165" cy="150" r="23" fill="#0056B3" />

            {/* Surrounding Satellites */}
            <g className="satellite-orbit">
              <circle cx="165" cy="106" r="9.5" fill="#0056B3" />
              <circle cx="203" cy="128" r="9.5" fill="#0056B3" />
              <circle cx="203" cy="172" r="9.5" fill="#0056B3" />
              <circle cx="165" cy="194" r="9.5" fill="#0056B3" />
              <circle cx="127" cy="172" r="9.5" fill="#0056B3" />
              <circle cx="127" cy="128" r="9.5" fill="#0056B3" />
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}
