export const PAPER_SIZES = {
  A1: { width: 594, height: 841 }, // A1: 594 × 841 mm
  A2: { width: 420, height: 594 }, // A2: 420 × 594 mm
  A3: { width: 297, height: 420 }, // A3: 297 × 420 mm
  A4: { width: 210, height: 297 }, // A4: 210 × 297 mm
  A5: { width: 148, height: 210 }, // A5: 148 × 210 mm
} as const;

export type PaperSize = keyof typeof PAPER_SIZES;

