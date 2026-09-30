const fs = require('fs');

const SRC = 'C:/Users/Jeremiah/EventSpacePro-frontend/public/assets/preloaded-venues/La Madison Dome.dxf';
const OUT = 'C:/Users/Jeremiah/EventSpacePro-frontend/public/assets/preloaded-venues/La Madison Dome.svg';

const raw = fs.readFileSync(SRC, 'latin1');
const lines = raw.split(/\r\n|\r|\n/);

// ---- tokenize group pairs ----
const pairs = [];
for (let i = 0; i + 1 < lines.length; i += 2) {
  pairs.push([parseInt(lines[i], 10), lines[i + 1]]);
}

// ---- extract ENTITIES ----
function sectionEntities() {
  const ents = [];
  let i = 0, section = null, cur = null;
  while (i < pairs.length) {
    const [code, val] = pairs[i];
    if (code === 0) {
      if (val === 'SECTION') {
        section = (pairs[i + 1] && pairs[i + 1][0] === 2) ? pairs[i + 1][1] : null;
        i += 2; continue;
      }
      if (val === 'ENDSEC') { section = null; i++; continue; }
      if (val === 'EOF') break;
      if (section === 'ENTITIES') { cur = { type: val, data: [] }; ents.push(cur); i++; continue; }
      cur = null; i++; continue;
    }
    if (section === 'ENTITIES' && cur) cur.data.push([code, val]);
    i++;
  }
  return ents;
}

// group helper: all values for a code, in order
const vals = (d, c) => d.filter(([k]) => k === c).map(([, v]) => parseFloat(v));
const first = (d, c, def = NaN) => { const v = vals(d, c); return v.length ? v[0] : def; };

// ---- de Boor B-spline evaluation ----
function deBoor(t, cps, knots, p) {
  const n = cps.length - 1;
  // find span k with knots[k] <= t < knots[k+1], k in [p..n]
  let k = p;
  while (k < n && t >= knots[k + 1]) k++;
  // d[j] = cps[k - p + j]
  const d = [];
  for (let j = 0; j <= p; j++) d.push([...cps[k - p + j]]);
  for (let r = 1; r <= p; r++) {
    for (let j = p; j >= r; j--) {
      const i = k - p + j;
      const den = knots[i + p - r + 1] - knots[i];
      const alpha = den === 0 ? 0 : (t - knots[i]) / den;
      d[j][0] = (1 - alpha) * d[j - 1][0] + alpha * d[j][0];
      d[j][1] = (1 - alpha) * d[j - 1][1] + alpha * d[j][1];
    }
  }
  return d[p];
}

function splineToPoints(ent) {
  const d = ent.data;
  const degree = first(d, 71, 3);
  const flags = first(d, 70, 0);
  const closed = (flags & 1) === 1;
  const knots = vals(d, 40);
  // control points: pairs of 10/20 in order
  const xs = vals(d, 10), ys = vals(d, 20);
  let cps = xs.map((x, i) => [x, ys[i]]).filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1]));
  if (cps.length < 2) {
    const fxs = vals(d, 11), fys = vals(d, 21);
    cps = fxs.map((x, i) => [x, fys[i]]);
  }
  if (cps.length < 2) return null;

  let kl = knots.length;
  if (kl < cps.length + degree + 1 || !knots.every(Number.isFinite)) {
    // build clamped uniform knot vector
    const p = Math.min(degree, cps.length - 1);
    const n = cps.length - 1;
    knots.length = 0;
    for (let i = 0; i <= p; i++) knots.push(0);
    for (let i = 1; i <= n - p; i++) knots.push(i / (n - p + 1));
    for (let i = 0; i <= p; i++) knots.push(1);
    return evalSpline(cps, knots, Math.min(degree, cps.length - 1), closed);
  }
  return evalSpline(cps, knots, Math.min(degree, cps.length - 1), closed);
}

function evalSpline(cps, knots, p, closed) {
  const n = cps.length - 1;
  const tMin = knots[p];
  const tMax = knots[n + 1];
  if (!Number.isFinite(tMin) || !Number.isFinite(tMax) || tMax <= tMin) {
    return closed ? [...cps, cps[0]] : cps;
  }
  const samples = Math.max(48, cps.length * 8);
  const pts = [];
  for (let s = 0; s <= samples; s++) {
    let t = tMin + (tMax - tMin) * (s / samples);
    if (s === samples) t = Math.max(tMin, Math.min(tMax, tMax - 1e-9));
    try { pts.push(deBoor(t, cps, knots, p)); } catch { break; }
  }
  if (pts.length < 2) return closed ? [...cps, cps[0]] : cps;
  if (closed) pts.push(pts[0]);
  return pts;
}

const fmt = (v) => (Math.round(v * 10) / 10).toString();
const pathOf = (pts) => 'M ' + pts.map(p => `${fmt(p[0])},${fmt(p[1])}`).join(' L ');

// ---- convert ----
const ents = sectionEntities();
const counts = {};
for (const e of ents) counts[e.type] = (counts[e.type] || 0) + 1;

const parts = [];
let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
const touch = (x, y) => {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  if (x < minX) minX = x; if (x > maxX) maxX = x;
  if (y < minY) minY = y; if (y > maxY) maxY = y;
};

for (const e of ents) {
  const d = e.data;
  if (e.type === 'LINE') {
    const x1 = first(d, 10), y1 = first(d, 20), x2 = first(d, 11), y2 = first(d, 21);
    if ([x1, y1, x2, y2].every(Number.isFinite)) {
      touch(x1, y1); touch(x2, y2);
      parts.push(`<line x1="${fmt(x1)}" y1="${fmt(y1)}" x2="${fmt(x2)}" y2="${fmt(y2)}"/>`);
    }
  } else if (e.type === 'SPLINE') {
    const pts = splineToPoints(e);
    if (pts && pts.length >= 2) {
      pts.forEach(p => touch(p[0], p[1]));
      parts.push(`<path d="${pathOf(pts)}"/>`);
    }
  } else if (e.type === 'MLINE') {
    // MLINE vertex chain lives in 11/21 pairs; the lone 10/20 point is a
    // reference anchor (often far from the chain) — ignore it unless there
    // are no 11s at all.
    let xs = vals(d, 11), ys = vals(d, 21);
    if (xs.length < 2) { xs = vals(d, 10); ys = vals(d, 20); }
    const pts = xs.map((x, i) => [x, ys[i]]).filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1]));
    if (pts.length >= 2) {
      pts.forEach(p => touch(p[0], p[1]));
      parts.push(`<path d="${pathOf(pts)}"/>`);
    }
  } else if (e.type === 'MTEXT') {
    // Off-plan annotations (far outside the venue outline) are skipped —
    // they would blow out the viewBox and shrink the venue on canvas.
    continue;
  }
  // PDFUNDERLAY / OLE2FRAME skipped (external references)
}

const w = maxX - minX, h = maxY - minY;
const textParts = parts.filter(p => p.startsWith('<text')).join('\n');
const geoParts = parts.filter(p => !p.startsWith('<text')).join('\n');
const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(w)}" height="${fmt(h)}" viewBox="${fmt(minX)} ${fmt(-maxY)} ${fmt(w)} ${fmt(h)}">
  <g transform="scale(1,-1)" fill="none" stroke="#000000" stroke-width="${fmt(Math.max(w, h) / 1000)}" stroke-linecap="round" stroke-linejoin="round">
${geoParts}
  </g>
  <g fill="#000000" stroke="none">
${textParts}
  </g>
</svg>
`;
fs.writeFileSync(OUT, svg, 'utf8');
console.log('entity counts:', counts);
console.log('bbox:', fmt(minX), fmt(minY), '->', fmt(maxX), fmt(maxY), '| size:', fmt(w), 'x', fmt(h));
console.log('parts:', parts.length, '| wrote', OUT, '(' + svg.length + ' bytes)');
