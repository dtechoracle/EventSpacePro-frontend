"use client";

import React from "react";
import { AssetInstance } from "@/store/sceneStore";

type KonvaWallRendererProps = {
  asset: AssetInstance;
  width: number;
  height: number;
  scalePx: number; // mm to px
};

export default function KonvaWallRenderer({ asset, width, height, scalePx }: KonvaWallRendererProps) {
  // react-konva not bundled; renderer disabled.
  return null;
}


