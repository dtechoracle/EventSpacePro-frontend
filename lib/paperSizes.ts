export const PAPER_SIZES = {
  A1: { width: 5000, height: 5000 }, // Very large canvas
  A2: { width: 5000, height: 5000 }, // Very large canvas
  A3: { width: 5000, height: 5000 }, // Very large canvas
  A4: { width: 5000, height: 5000 }, // Very large canvas
  A5: { width: 5000, height: 5000 }, // Very large canvas
} as const;

export type PaperSize = keyof typeof PAPER_SIZES;

