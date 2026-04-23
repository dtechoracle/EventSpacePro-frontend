export const DEFAULT_ASSET_STROKE_WIDTH = 0.6;
const ENABLE_CANVAS_ASSET_RENDERING = false;

type FastRenderableAsset = {
  fillColor?: string;
  fillType?: string;
  strokeColor?: string;
  strokeWidth?: number;
};

const normalizeColor = (value?: string) => value?.trim().toLowerCase() || '';

const isTransparentFill = (value?: string) => {
  const color = normalizeColor(value);
  return (
    !color ||
    color === 'transparent' ||
    color === 'none' ||
    color === 'rgba(0,0,0,0)' ||
    color === 'rgba(0, 0, 0, 0)'
  );
};

const isDefaultStrokeColor = (value?: string) => {
  const color = normalizeColor(value);
  return (
    !color ||
    color === '#000' ||
    color === '#000000' ||
    color === 'black' ||
    color === 'rgb(0,0,0)' ||
    color === 'rgb(0, 0, 0)'
  );
};

const isDefaultStrokeWidth = (value: number | undefined, defaultStrokeWidth: number) => {
  if (value === undefined || value === null) return true;
  return (
    Math.abs(value - defaultStrokeWidth) <= 0.001 ||
    Math.abs(value - DEFAULT_ASSET_STROKE_WIDTH) <= 0.001 ||
    Math.abs(value - 0.5) <= 0.001
  );
};

const isDefaultStyledAsset = (asset: FastRenderableAsset, isPreview = false) => {
  const fillType = (asset as any).fillType;
  const hasTextureFill = fillType === 'texture' || fillType === 'hatch' || fillType === 'hash';
  const defaultStrokeWidth = isPreview ? 0.4 : DEFAULT_ASSET_STROKE_WIDTH;
  const hasCustomFill = !isTransparentFill(asset.fillColor);
  const hasCustomStroke = !isDefaultStrokeColor(asset.strokeColor) || !isDefaultStrokeWidth(asset.strokeWidth, defaultStrokeWidth);

  return !isPreview && !hasCustomFill && !hasTextureFill && !hasCustomStroke;
};

export const canRenderAssetAsImage = (asset: FastRenderableAsset, isPreview = false) => {
  return isDefaultStyledAsset(asset, isPreview);
};

export const canRenderAssetOnCanvas = (asset: FastRenderableAsset, isPreview = false) => {
  if (!ENABLE_CANVAS_ASSET_RENDERING) return false;
  return isDefaultStyledAsset(asset, isPreview);
};
