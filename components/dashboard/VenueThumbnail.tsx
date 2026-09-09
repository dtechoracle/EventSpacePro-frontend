import { useState, useEffect, memo } from 'react';

const svgCache = new Map<string, { viewBox: string; innerHtml: string }>();

function parseSvg(raw: string, forceStroke: string): { viewBox: string; innerHtml: string } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(raw, 'image/svg+xml');
  const svg = doc.querySelector('svg');
  if (!svg) return { viewBox: '0 0 100 100', innerHtml: '' };
  const viewBox = svg.getAttribute('viewBox') || `0 0 ${svg.getAttribute('width') || 100} ${svg.getAttribute('height') || 100}`;

  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.removeAttribute('style');

  const allElements = svg.querySelectorAll('*');
  allElements.forEach((el) => {
    el.setAttribute('stroke', forceStroke);
    el.removeAttribute('stroke-width');
    el.removeAttribute('fill');
    el.removeAttribute('stroke-dasharray');
    el.removeAttribute('stroke-dashoffset');
    if (el.hasAttribute('style')) {
      const s = el.getAttribute('style') || '';
      el.setAttribute(
        'style',
        s
          .replace(/stroke\s*:\s*[^;]+;?/gi, '')
          .replace(/fill\s*:\s*[^;]+;?/gi, '')
          .replace(/stroke-width\s*:\s*[^;]+;?/gi, '')
          .trim()
      );
    }
  });

  return { viewBox, innerHtml: svg.innerHTML };
}

const VenueThumbnail = memo(function VenueThumbnail({
  src,
  stroke = '#272235',
  className = '',
}: {
  src: string;
  stroke?: string;
  className?: string;
}) {
  const [data, setData] = useState<{ viewBox: string; innerHtml: string } | null>(
    () => svgCache.get(src) || null
  );

  useEffect(() => {
    if (svgCache.has(src)) {
      setData(svgCache.get(src)!);
      return;
    }
    let cancelled = false;
    fetch(encodeURI(src))
      .then((r) => r.text())
      .then((raw) => {
        if (cancelled) return;
        const parsed = parseSvg(raw, stroke);
        svgCache.set(src, parsed);
        setData(parsed);
      })
      .catch(() => {
        if (!cancelled) setData({ viewBox: '0 0 100 100', innerHtml: '' });
      });
    return () => { cancelled = true; };
  }, [src, stroke]);

  if (!data) {
    return <div className={`animate-pulse bg-gray-100 rounded ${className}`} />;
  }

  return (
    <svg
      viewBox={data.viewBox}
      className={className}
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: '100%' }}
    >
      <g dangerouslySetInnerHTML={{ __html: data.innerHtml }} />
    </svg>
  );
});

export default VenueThumbnail;
