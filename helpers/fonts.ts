type FontHelper = {
  className: string;
  style: {
    fontFamily: string;
    fontWeight?: number;
    fontStyle?: string;
  };
  variable?: string;
};

// Build-safe font helpers. These preserve the existing `instrumentSans.className`
// / `instrumentSerif.className` API without requiring a network fetch at build time.
export const instrumentSerif: FontHelper = {
  className: "font-instrument-serif",
  style: {
    fontFamily: '"Georgia", "Times New Roman", serif',
    fontWeight: 400,
    fontStyle: "normal",
  },
};

export const instrumentSans: FontHelper = {
  className: "font-instrument-sans",
  style: {
    fontFamily: '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontStyle: "normal",
  },
};

const fonts = { instrumentSerif, instrumentSans };
export default fonts;
