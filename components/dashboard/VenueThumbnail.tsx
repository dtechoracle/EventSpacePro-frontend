import { useState, useEffect, useMemo, memo } from 'react';
import { getDwgSvgString, extractSvgViewBox } from '@/utils/dwgParser';

const svgCache = new Map<string, { viewBox: string; innerHtml: string }>();
const dwgSvgCache = new Map<string, { viewBox: string; innerHtml: string }>();
const pngCache = new Map<string, boolean>();

function isCad(src: string): boolean {
  const lower = src.toLowerCase();
  return lower.endsWith('.dwg') || lower.endsWith('.dxf');
}

function derivePngPath(assetPath: string): string {
  return assetPath
    .replace('/assets/preloaded-venues/', '/assets/thumbnails/preloaded-venues/')
    .replace(/\.(svg|dwg|dxf)$/i, '.png');
}

function parseSvg(raw: string, forceStroke: string): { viewBox: string; innerHtml: string } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(raw, 'image/svg+xml');
  const svg = doc.querySelector('svg');
  if (!svg) return { viewBox: '0 0 100 100', innerHtml: '' };
  const viewBox = svg.getAttribute('viewBox') || `0 0 ${svg.getAttribute('width') || 100} ${svg.getAttribute('height') || 100}`;
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.removeAttribute('style');

  svg.querySelectorAll('*').forEach((el) => {
    el.setAttribute('stroke', forceStroke);
    el.removeAttribute('fill');
    if (el.hasAttribute('style')) {
      el.setAttribute(
        'style',
        el
          .getAttribute('style')!
          .replace(/stroke\s*:\s*[^;]+;?/gi, '')
          .replace(/fill\s*:\s*[^;]+;?/gi, '')
          .trim()
      );
    }
  });

  return { viewBox, innerHtml: svg.innerHTML };
}

function parseDwgSvg(raw: string): { viewBox: string; innerHtml: string } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(raw, 'image/svg+xml');
  const svg = doc.querySelector('svg');
  if (!svg) return { viewBox: '0 0 100 100', innerHtml: '' };

  const vb = extractSvgViewBox(raw);
  const viewBox = svg.getAttribute('viewBox') || (vb ? `0 0 ${vb.width} ${vb.height}` : '0 0 100 100');

  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.removeAttribute('style');

  svg.querySelectorAll('*').forEach((el) => {
    const tag = el.tagName.toLowerCase();
    if (tag === 'path' || tag === 'line' || tag === 'polyline' || tag === 'polygon' ||
        tag === 'circle' || tag === 'ellipse' || tag === 'rect') {
      if (!el.getAttribute('stroke') || el.getAttribute('stroke') === 'none') {
        el.setAttribute('stroke', '#272235');
      }
      if (el.getAttribute('fill') === 'none') {
        // keep none for open paths
      } else if (tag === 'path' || tag === 'polyline' || tag === 'line') {
        el.setAttribute('fill', 'none');
      }
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
  const cad = isCad(src);
  const pngPath = derivePngPath(src);
  const [hasPng, setHasPng] = useState<boolean>(() => pngCache.get(pngPath) ?? false);
  const [pngChecked, setPngChecked] = useState(false);

  const [rawSvg, setRawSvg] = useState<string | null>(null);
  const [dwgParsed, setDwgParsed] = useState<{ viewBox: string; innerHtml: string } | null>(null);

  // Check if PNG exists
  useEffect(() => {
    if (pngCache.has(pngPath)) {
      setPngChecked(true);
      return;
    }
    let cancelled = false;
    fetch(pngPath, { method: 'HEAD' })
      .then((r) => {
        if (cancelled) return;
        const ok = r.ok;
        pngCache.set(pngPath, ok);
        setHasPng(ok);
        setPngChecked(true);
      })
      .catch(() => {
        if (!cancelled) {
          pngCache.set(pngPath, false);
          setPngChecked(true);
        }
      });
    return () => { cancelled = true; };
  }, [pngPath]);

  // Parse DWG/DXF to SVG
  useEffect(() => {
    if (!cad) return;
    if (dwgSvgCache.has(src)) {
      setDwgParsed(dwgSvgCache.get(src)!);
      return;
    }
    let cancelled = false;
    getDwgSvgString(encodeURI(src))
      .then((svgStr) => {
        if (cancelled) return;
        const parsed = parseDwgSvg(svgStr);
        dwgSvgCache.set(src, parsed);
        setDwgParsed(parsed);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [src, cad]);

  // Fetch SVG only if no PNG and not DWG
  useEffect(() => {
    if (!pngChecked || hasPng || cad) return;
    if (svgCache.has(src)) return;
    let cancelled = false;
    fetch(encodeURI(src))
      .then((r) => r.text())
      .then((text) => {
        if (!cancelled) setRawSvg(text);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [src, pngChecked, hasPng, cad]);

  const data = useMemo(() => {
    if (hasPng || cad) return null;
    if (svgCache.has(src)) return svgCache.get(src)!;
    if (!rawSvg) return null;
    const parsed = parseSvg(rawSvg, stroke);
    svgCache.set(src, parsed);
    return parsed;
  }, [src, rawSvg, stroke, hasPng, cad]);

  if (!pngChecked) {
    return <div className={`animate-pulse bg-gray-100 rounded ${className}`} />;
  }

  if (hasPng) {
    return (
      <img
        src={pngPath}
        alt=""
        className={className}
        style={{ width: '100%', height: '100%', objectFit: 'contain', backgroundColor: '#f9fafb' }}
      />
    );
  }

  if (cad) {
    if (!dwgParsed) {
      return <div className={`animate-pulse bg-gray-100 rounded ${className}`} />;
    }
    return (
      <svg
        viewBox={dwgParsed.viewBox}
        className={className}
        preserveAspectRatio="xMidYMid meet"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: '100%', height: '100%', backgroundColor: '#f9fafb' }}
      >
        <g dangerouslySetInnerHTML={{ __html: dwgParsed.innerHtml }} />
      </svg>
    );
  }

  if (!data) {
    return <div className={`animate-pulse bg-gray-100 rounded ${className}`} />;
  }

  return (
    <svg
      viewBox={data.viewBox}
      className={className}
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: '100%', backgroundColor: '#f9fafb' }}
    >
      <g dangerouslySetInnerHTML={{ __html: data.innerHtml }} />
    </svg>
  );
});

export default VenueThumbnail;
