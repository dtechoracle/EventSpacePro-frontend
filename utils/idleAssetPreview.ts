import { Asset } from '@/store/projectStore';
import { canRenderAssetAsImage } from '@/utils/assetRenderMode';

const IDLE_PREVIEW_ASSET_PATHS: Record<string, string> = {
  '/assets/modal/Furniture/10 seater round table 01.svg': '/assets/modal/Furniture/10 seater round table 01.png',
};

export const getIdleAssetPreviewPath = (assetPath: string | null | undefined) => {
  if (!assetPath) return null;
  return IDLE_PREVIEW_ASSET_PATHS[assetPath] || null;
};

export const canUseIdleAssetPreview = (
  asset: Pick<Asset, 'isExploded' | 'fillColor' | 'fillType' | 'strokeColor' | 'strokeWidth'>,
  assetPath: string | null | undefined,
  isPreview = false
) => {
  return !asset.isExploded && !!getIdleAssetPreviewPath(assetPath) && canRenderAssetAsImage(asset, isPreview);
};
