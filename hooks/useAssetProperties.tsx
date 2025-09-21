"use client";

import { useEffect, useRef, useState } from "react";
import { useSceneStore } from "@/store/sceneStore";

// Conversion helpers
export const unitToMm = (value: number, unit: string) => {
  switch (unit) {
    case "px": return value * 0.264583;
    case "cm": return value * 10;
    case "mm": return value;
    default: return value;
  }
};

export const mmToUnit = (value: number, unit: string) => {
  switch (unit) {
    case "px": return value / 0.264583;
    case "cm": return value / 10;
    case "mm": return value;
    default: return value;
  }
};

// Debounce hook
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useDebouncedCallback<T extends (...args: any[]) => void>(fn: T, delay = 300) {
  const timerRef = useRef<number | undefined>(undefined);

  const debounced = (...args: Parameters<T>) => {
    if (timerRef.current !== undefined) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      fn(...args);
      timerRef.current = undefined;
    }, delay);
  };

  useEffect(() => () => {
    if (timerRef.current !== undefined) window.clearTimeout(timerRef.current);
  }, []);

  return debounced;
}

export function useAssetProperties() {
  const assets = useSceneStore((s) => s.assets);
  const selectedAssetId = useSceneStore((s) => s.selectedAssetId);
  const updateAsset = useSceneStore((s) => s.updateAsset);

  const selectedAsset = assets.find((a) => a.id === selectedAssetId) ?? null;

  const [unit, setUnit] = useState<string>("px");
  const [assetX, setAssetX] = useState<number>(0);
  const [assetY, setAssetY] = useState<number>(0);
  const [assetScale, setAssetScale] = useState<number>(1);
  const [assetRotation, setAssetRotation] = useState<number>(0);

  const actualXRef = useRef<number>(0);
  const actualYRef = useRef<number>(0);

  const debouncedUpdate = useDebouncedCallback((id: string, updates: Partial<typeof selectedAsset>) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (id) updateAsset(id, updates as any);
  }, 250);

  useEffect(() => {
    if (selectedAsset) {
      const xMm = Number(selectedAsset.x ?? 0);
      const yMm = Number(selectedAsset.y ?? 0);
      actualXRef.current = xMm;
      actualYRef.current = yMm;

      setAssetX(mmToUnit(xMm, unit));
      setAssetY(mmToUnit(yMm, unit));
      setAssetScale(Number(selectedAsset.scale ?? 1));
      setAssetRotation(Number(selectedAsset.rotation ?? 0));
    }
  }, [selectedAsset, unit]);

  const onChangeX = (v: number) => {
    setAssetX(v);
    const mm = unitToMm(v, unit);
    actualXRef.current = mm;
    if (selectedAsset) debouncedUpdate(selectedAsset.id, { x: mm });
  };

  const onChangeY = (v: number) => {
    setAssetY(v);
    const mm = unitToMm(v, unit);
    actualYRef.current = mm;
    if (selectedAsset) debouncedUpdate(selectedAsset.id, { y: mm });
  };

  const onChangeScale = (v: number) => {
    setAssetScale(v);
    if (selectedAsset) debouncedUpdate(selectedAsset.id, { scale: v });
  };

  const onChangeRotation = (v: number) => {
    setAssetRotation(v);
    if (selectedAsset) debouncedUpdate(selectedAsset.id, { rotation: v });
  };

  const onChangeUnit = (newUnit: string) => {
    setUnit(newUnit);
    setAssetX(mmToUnit(actualXRef.current, newUnit));
    setAssetY(mmToUnit(actualYRef.current, newUnit));
  };

  return {
    selectedAsset,
    unit,
    assetX,
    assetY,
    assetScale,
    assetRotation,
    onChangeX,
    onChangeY,
    onChangeScale,
    onChangeRotation,
    onChangeUnit,
    updateAsset
  };
}

