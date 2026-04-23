const RASTER_ROOT = '/assets/raster';

export const getRasterAssetPath = (assetPath: string | null | undefined) => {
  if (!assetPath || !assetPath.toLowerCase().endsWith('.svg')) return null;

  const normalized = assetPath.startsWith('/') ? assetPath : `/${assetPath}`;
  return `${RASTER_ROOT}${normalized.replace(/\.svg$/i, '.webp')}`;
};
