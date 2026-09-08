import { useState, useEffect, memo } from 'react';

function getThumbnailPath(src: string): string | null {
  if (!src.includes('preloaded-venues')) return null;
  const name = src.split('/').pop()?.replace(/\.svg$/i, '');
  if (!name) return null;
  return `/assets/thumbnails/preloaded-venues/${encodeURIComponent(name)}.png`;
}

const VenueThumbnail = memo(function VenueThumbnail({
  src,
  stroke = '#272235',
  strokeWidth = 1.5,
  className = '',
}: {
  src: string;
  stroke?: string;
  strokeWidth?: number;
  className?: string;
}) {
  const thumbPath = getThumbnailPath(src);

  if (thumbPath) {
    return (
      <img
        src={thumbPath}
        alt=""
        className={className}
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
    );
  }

  return <div className={`animate-pulse bg-gray-100 rounded ${className}`} />;
});

export default VenueThumbnail;
