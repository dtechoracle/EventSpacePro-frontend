const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const src = fs.readFileSync('components/renderers/AssetRenderer.tsx', 'utf8');
const lines = src.split('\n');

const idx = (marker, from = 0) => {
  for (let i = from; i < lines.length; i++) if (lines[i].includes(marker)) return i;
  throw new Error('marker not found: ' + marker);
};

const helperStart = idx('const svgCache: Record<string, string> = {};');
const helperEnd = idx('const AssetRendererBase');
const baseStart = idx('// 1. Base SVG processing (Heavy - matches InlineSvg logic)');
const baseBodyStart = idx('if (canUseFastImage) return null;', baseStart);
const baseEnd = idx('}, [rawSvgContent, definition?.path');
const procStart = idx('return baseSvg.replace(/<svg([^>]*)>/i');
const procEnd = idx('}, [baseSvg, canUseFastImage, currentFill');

console.log('helpers  lines', helperStart + 1, '-', helperEnd);
console.log('base body lines', baseBodyStart + 1, '-', baseEnd);
console.log('proc     lines', procStart + 1, '-', procEnd);

const transpile = (code) => ts.transpileModule(code, { compilerOptions: { target: 'ES2020' } }).outputText;

const helpersJs = transpile(lines.slice(helperStart, helperEnd).join('\n'));
const baseJs = transpile(lines.slice(baseBodyStart, baseEnd).join('\n'));
const procJs = transpile(lines.slice(procStart, procEnd).join('\n'));

const harness = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body>
<div id="host" style="width:1400px;height:1400px;position:relative;background:#fff"></div>
<pre id="report" style="white-space:pre-wrap;font:11px monospace"></pre>
<script>
${helpersJs}
function runBase(rawSvgContent, definition, asset) {
  const canUseFastImage = false;
  const updateAsset = function(){};
  ${baseJs}
}
function runFinal(baseSvg, definition, asset) {
  const currentFill = asset.fillColor || 'transparent';
  const rawStrokeWidth = asset.strokeWidth !== undefined ? asset.strokeWidth : 0.6;
  const currentStrokeWidth = rawStrokeWidth <= 0 ? 0 : rawStrokeWidth;
  const currentStroke = rawStrokeWidth <= 0 ? 'none' : (asset.strokeColor || '#000000');
  const displayWidth = asset.width;
  const displayHeight = asset.height;
  ${procJs}
}
(async () => {
  try {
    const rawSvg = await (await fetch('/palm.svg')).text();
    const asset = { type: '5-palm-imperial', width: 39844, height: 54594, strokeColor: '#000000', fillColor: 'transparent' };
    const definition = { category: 'Venue', path: '/assets/preloaded-venues/5 Palm Imperial.svg', label: '5 Palm Imperial' };

    // Trace getElementMetrics calls during processing
    const origGet = getElementMetrics;
    const trace = [];
    getElementMetrics = function (el) {
      const m = origGet(el);
      trace.push({ tag: el.tagName, d: (el.getAttribute('d') || '').slice(0, 50), m });
      return m;
    };
    const base = runBase(rawSvg, definition, asset);
    getElementMetrics = origGet;

    // Post-hoc isBgFill computation the way base does it
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    trace.forEach(t => { if (t.m) { minX = Math.min(minX, t.m.cx - t.m.width/2); maxX = Math.max(maxX, t.m.cx + t.m.width/2); minY = Math.min(minY, t.m.cy - t.m.height/2); maxY = Math.max(maxY, t.m.cy + t.m.height/2); } });
    const cw = isFinite(maxX-minX) ? maxX-minX : 1000;
    const ch = isFinite(maxY-minY) ? maxY-minY : 1000;
    const canvasArea = cw * ch;
    const traceReport = trace.map((t, i) => ({
      i,
      d: t.d,
      m: t.m ? [+t.m.width.toFixed(1), +t.m.height.toFixed(1)] : null,
      ratio: t.m ? +((t.m.width * t.m.height) / canvasArea).toFixed(3) : null,
      isBgFill: t.m ? (t.m.width * t.m.height) > canvasArea * 0.75 : false
    }));

    const final = runFinal(base, definition, asset);
    const host = document.getElementById('host');
    host.innerHTML = final;
    // Simulate the document-wide style leak from other SVGs on the workspace page
    const leak = document.createElement('style');
    leak.textContent = 'svg .fill-none-el { stroke-width: inherit !important; } svg .fill-inherit-el { stroke-width: inherit !important; } .fill-none-el { stroke-width: inherit !important; }';
    document.head.appendChild(leak);
    const paths = [...host.querySelectorAll('path')];
    const report = paths.map(p => {
      const cs = getComputedStyle(p);
      return { style: p.getAttribute('style'), computedSW: cs.strokeWidth };
    });
    document.getElementById('report').textContent =
      'CONTENT_BOUNDS: ' + JSON.stringify([minX, minY, maxX, maxY].map(n => +n.toFixed(1))) + ' canvasArea=' + canvasArea.toExponential(2) +
      '\\n\\nTRACE(isBgFill calc):\\n' + JSON.stringify(traceReport, null, 1) +
      '\\n\\nPATHS(' + paths.length + '):\\n' + JSON.stringify(report, null, 1);
    window.__done = true;
  } catch (e) {
    document.getElementById('report').textContent = 'ERROR: ' + e.stack;
    window.__done = true;
  }
})();
</script>
</body></html>`;

fs.writeFileSync('Temp/stroke-test/harness.html', harness);
console.log('harness bytes:', harness.length);
