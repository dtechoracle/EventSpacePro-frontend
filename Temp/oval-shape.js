const fs = require("fs");
const path = require("path");

const svgPath = path.join(__dirname, "..", "public", "assets", "modal", "Furniture", "4000mm X 1470mm Oval Table.svg");
const svg = fs.readFileSync(svgPath, "utf8");
const dMatches = [...svg.matchAll(/\sd="([^"]+)"/g)];

function pathPoints(d) {
  const tokens = d.match(/[MLHVCQTAZmlhvcqtaz]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || [];
  let i = 0, cmd = null, cx = 0, cy = 0;
  const pts = [];
  while (i < tokens.length) {
    const t = tokens[i];
    if (/[MLHVCQTAZmlhvcqtaz]/.test(t)) { cmd = t; i++; continue; }
    const n = parseFloat(t);
    if (cmd === "M" || cmd === "L" || cmd === "m" || cmd === "l") {
      let x = n, y = parseFloat(tokens[i + 1]); i += 2;
      if (cmd === "m" || cmd === "l") { x += cx; y += cy; }
      cx = x; cy = y; pts.push([x, y]);
    } else if (cmd === "H" || cmd === "h") {
      let x = n; if (cmd === "h") x += cx;
      cx = x; pts.push([x, cy]); i++;
    } else if (cmd === "V" || cmd === "v") {
      let y = n; if (cmd === "v") y += cy;
      cy = y; pts.push([cx, y]); i++;
    } else if (cmd === "C" || cmd === "c") {
      const n2 = tokens.slice(i, i + 6).map(Number);
      if (cmd === "c") { n2[0]+=cx;n2[1]+=cy;n2[2]+=cx;n2[3]+=cy;n2[4]+=cx;n2[5]+=cy; }
      pts.push([n2[0],n2[1]],[n2[2],n2[3]],[n2[4],n2[5]]);
      cx=n2[4]; cy=n2[5]; i+=6;
    } else if (cmd === "S" || cmd === "s" || cmd === "Q" || cmd === "q") {
      const n2 = tokens.slice(i, i + 4).map(Number);
      if (cmd === "s" || cmd === "q") { n2[0]+=cx;n2[1]+=cy;n2[2]+=cx;n2[3]+=cy; }
      pts.push([n2[0],n2[1]],[n2[2],n2[3]]);
      cx=n2[2]; cy=n2[3]; i+=4;
    } else if (cmd === "A" || cmd === "a") {
      const n2 = tokens.slice(i, i + 7).map(Number);
      let ex=n2[5], ey=n2[6];
      if (cmd === "a") { ex+=cx; ey+=cy; }
      pts.push([ex,ey]); cx=ex; cy=ey; i+=7;
    } else i++;
  }
  return pts;
}

// Build chains same as before
const paths = dMatches.map((m) => {
  const pts = pathPoints(m[1]);
  return { start: pts[0], end: pts[pts.length - 1], pts };
});
const used = new Array(paths.length).fill(false);
const chains = [];
const TOL = 0.5;
for (let i = 0; i < paths.length; i++) {
  if (used[i]) continue;
  used[i] = true;
  let pts = [...paths[i].pts];
  let extended = true;
  while (extended) {
    extended = false;
    const end = pts[pts.length - 1];
    const start = pts[0];
    if (Math.hypot(end[0]-start[0], end[1]-start[1]) < TOL && pts.length > 10) break;
    for (let j = 0; j < paths.length; j++) {
      if (used[j]) continue;
      const p = paths[j];
      if (Math.hypot(end[0]-p.start[0], end[1]-p.start[1]) < TOL) {
        pts.push(...p.pts.slice(1)); used[j] = true; extended = true; break;
      }
      if (Math.hypot(end[0]-p.end[0], end[1]-p.end[1]) < TOL) {
        pts.push(...[...p.pts].reverse().slice(1)); used[j] = true; extended = true; break;
      }
      if (Math.hypot(start[0]-p.end[0], start[1]-p.end[1]) < TOL) {
        pts.unshift(...p.pts.slice(0, -1)); used[j] = true; extended = true; break;
      }
      if (Math.hypot(start[0]-p.start[0], start[1]-p.start[1]) < TOL) {
        pts.unshift(...[...p.pts].reverse().slice(0, -1)); used[j] = true; extended = true; break;
      }
    }
  }
  chains.push(pts);
}

const big = chains.filter(c => c.length > 100);
console.log("big chains:", big.length);

// Overall bbox
let gMinX=Infinity,gMinY=Infinity,gMaxX=-Infinity,gMaxY=-Infinity;
for (const c of chains) for (const [x,y] of c) {
  if(x<gMinX)gMinX=x; if(y<gMinY)gMinY=y; if(x>gMaxX)gMaxX=x; if(y>gMaxY)gMaxY=y;
}
const gcx = (gMinX+gMaxX)/2, gcy = (gMinY+gMaxY)/2;
console.log(`global center: ${gcx.toFixed(2)}, ${gcy.toFixed(2)}`);

// For each big chain, sample at fixed angles and measure perpendicular gap to the other
function sampleByAngle(pts, cx, cy, buckets) {
  // For each angle bucket, take the point closest to that ray
  const out = new Array(buckets).fill(null);
  for (const [x, y] of pts) {
    const ang = Math.atan2(y - cy, x - cx); // -pi..pi
    const b = Math.floor(((ang + Math.PI) / (2 * Math.PI)) * buckets) % buckets;
    const r = Math.hypot(x - cx, y - cy);
    if (out[b] === null || r < out[b].r) out[b] = { r, x, y };
  }
  return out;
}

// Also: classify shape - ellipse vs stadium (capsule)
function classify(pts) {
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for (const [x,y] of pts) {
    if(x<minX)minX=x; if(y<minY)minY=y; if(x>maxX)maxX=x; if(y>maxY)maxY=y;
  }
  const a = (maxX-minX)/2, b = (maxY-minY)/2, cx=(minX+maxX)/2, cy=(minY+maxY)/2;
  // stadium: straight top/bottom at y=cy±b for x in [cx-(a-b), cx+(a-b)], semicircle caps radius b
  const straightHalf = a - b; // half-length of straight section
  let errEllipse = 0, errStadium = 0, n = 0;
  for (const [x,y] of pts) {
    const dx = x - cx, dy = y - cy;
    // ellipse radial error
    const th = Math.atan2(dy, dx);
    const rE = 1 / Math.sqrt(Math.pow(Math.cos(th)/a, 2) + Math.pow(Math.sin(th)/b, 2));
    const r = Math.hypot(dx, dy);
    errEllipse += Math.abs(r - rE);
    // stadium: distance to stadium boundary
    // capsule along x-axis: clamp x to [-straightHalf, straightHalf], dist to that segment endpoint circle
    const cxl = Math.max(-straightHalf, Math.min(straightHalf, dx));
    const distToAxis = Math.hypot(dx - cxl, dy); // distance from point to capsule centerline segment
    errStadium += Math.abs(distToAxis - b);
    n++;
  }
  return {
    a, b, cx, cy,
    avgErrEllipse: errEllipse / n,
    avgErrStadium: errStadium / n,
    straightHalf,
  };
}

big.forEach((pts, i) => {
  const cls = classify(pts);
  console.log(`\n=== CHAIN ${i} (${pts.length} pts) ===`);
  console.log(`a=${cls.a.toFixed(2)} b=${cls.b.toFixed(2)} center=${cls.cx.toFixed(2)},${cls.cy.toFixed(2)}`);
  console.log(`avg radial err vs ELLIPSE: ${cls.avgErrEllipse.toFixed(3)}`);
  console.log(`avg radial err vs STADIUM: ${cls.avgErrStadium.toFixed(3)}`);
  console.log(`=> shape is ${cls.avgErrStadium < cls.avgErrEllipse ? "STADIUM (capsule)" : "ELLIPSE"}`);
});

if (big.length >= 2) {
  // Gap between outer (0) and inner (1) at 36 angles - use GLOBAL center for both
  const buckets = 36;
  const outer = sampleByAngle(big[0], gcx, gcy, buckets);
  const inner = sampleByAngle(big[1], gcx, gcy, buckets);
  console.log("\n=== RADIAL GAP outer→inner (global center) ===");
  const gaps = [];
  for (let b = 0; b < buckets; b++) {
    if (!outer[b] || !inner[b]) continue;
    const gap = outer[b].r - inner[b].r;
    gaps.push(gap);
    const deg = Math.round((b / buckets) * 360 - 180);
    console.log(`  ${String(deg).padStart(4)}°  outer=${outer[b].r.toFixed(2)}  inner=${inner[b].r.toFixed(2)}  gap=${gap.toFixed(2)}`);
  }
  const gMin = Math.min(...gaps), gMax = Math.max(...gaps);
  const gAvg = gaps.reduce((a,b)=>a+b,0)/gaps.length;
  console.log(`gap min=${gMin.toFixed(2)} max=${gMax.toFixed(2)} avg=${gAvg.toFixed(2)} spread=${(gMax-gMin).toFixed(2)} (${((gMax-gMin)/gAvg*100).toFixed(1)}%)`);

  // Also compute true perpendicular (normal) gap for stadium/ellipse offset
  // For each outer sample, find nearest inner point (true min distance)
  console.log("\n=== TRUE NEAREST-NEIGHBOR GAP (outer→inner) ===");
  const nnGaps = [];
  for (let b = 0; b < buckets; b++) {
    if (!outer[b]) continue;
    const [ox, oy] = [outer[b].x, outer[b].y];
    let best = Infinity;
    for (const [ix, iy] of big[1]) {
      const d = Math.hypot(ox - ix, oy - iy);
      if (d < best) best = d;
    }
    nnGaps.push(best);
    const deg = Math.round((b / buckets) * 360 - 180);
    console.log(`  ${String(deg).padStart(4)}°  nn_gap=${best.toFixed(3)}`);
  }
  const nMin = Math.min(...nnGaps), nMax = Math.max(...nnGaps);
  const nAvg = nnGaps.reduce((a,b)=>a+b,0)/nnGaps.length;
  console.log(`nn gap min=${nMin.toFixed(3)} max=${nMax.toFixed(3)} avg=${nAvg.toFixed(3)} spread=${(nMax-nMin).toFixed(3)} (${((nMax-nMin)/nAvg*100).toFixed(1)}%)`);
}

// Check chains 1,3 (small?)
console.log("\n=== SMALL CHAINS ===");
chains.forEach((c, i) => {
  if (c.length <= 100 && c.length > 0) {
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    for (const [x,y] of c) {
      if(x<minX)minX=x; if(y<minY)minY=y; if(x>maxX)maxX=x; if(y>maxY)maxY=y;
    }
    console.log(`chain ${i}: ${c.length} pts bbox ${minX.toFixed(1)},${minY.toFixed(1)} → ${maxX.toFixed(1)},${maxY.toFixed(1)}`);
  }
});

// stroke-widths present
const sw = new Set([...svg.matchAll(/stroke-width="([^"]+)"/g)].map(m=>m[1]));
console.log("\nstroke-widths:", [...sw].join(", "));
const fills = new Set([...svg.matchAll(/fill="([^"]+)"/g)].map(m=>m[1]));
console.log("fills:", [...fills].join(", "));
