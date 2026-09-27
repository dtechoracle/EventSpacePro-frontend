export const GRID_STEP_MULTIPLIERS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];

export function getGridStepMultiplier(gridSize: number, zoom: number, minPixelSpacing = 25): number {
  if (gridSize <= 0 || zoom <= 0) return 1;
  for (const mult of GRID_STEP_MULTIPLIERS) {
    if (gridSize * zoom * mult >= minPixelSpacing) return mult;
  }
  return GRID_STEP_MULTIPLIERS[GRID_STEP_MULTIPLIERS.length - 1];
}

export function getEffectiveGridSize(gridSize: number, zoom: number, minPixelSpacing = 25): number {
  return gridSize * getGridStepMultiplier(gridSize, zoom, minPixelSpacing);
}
