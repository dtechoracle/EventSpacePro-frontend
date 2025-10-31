"use client";

import React from "react";
// This renderer depended on react-konva which isn't installed.
// It's currently unused; return null to avoid build errors until enabled intentionally.

type KonvaWallRendererProps = {
  asset: any;
  width: number;
  height: number;
  scalePx: number;
};

export default function KonvaWallRenderer(_props: KonvaWallRendererProps) {
  return null;
}


