const fs = require("fs");
const path = require("path");

const svgPath = path.join(
  __dirname,
  "..",
  "public",
  "assets",
  "modal",
  "Furniture",
  "4000mm X 1470mm Oval Table.svg"
);
const svg = fs.readFileSync(svgPath, "utf8");

// Extract all path start/end points to identify continuous polylines (rings)
const dMatches = [...svg.matchAll(/\sd="([^"]+)"/g)];

// For each path, get all points
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

// Chain paths: path A end connects to path B start (within tolerance)
const paths = dMatches.map((m) => {
  const pts = pathPoints(m[1]);
  return { start: pts[0], end: pts[pts.length - 1], pts, closed: false };
});

// Find closed loops / chains
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
    // try close
    if (Math.hypot(end[0]-start[0], end[1]-start[1]) < TOL && pts.length > 10) {
      break;
    }
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

console.log("chains found:", chains.length);

// For each substantial chain, compute bbox, center, and radius profile
chains.forEach((pts, idx) => {
  if (pts.length < 8) return;
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for (const [x,y] of pts) {
    if(x<minX)minX=x; if(y<minY)minY=y; if(x>maxX)maxX=x; if(y>maxY)maxY=y;
  }
  const cx = (minX+maxX)/2, cy = (minY+maxY)/2;
  const rx = (maxX-minX)/2, ry = (maxY-minY)/2;
  // Sample radii at 12 angles (0,30,...330) - for oval, r(θ) should follow ellipse formula
  // Instead: measure distance from center to each point, at angle buckets
  const buckets = 36;
  const radii = new Array(buckets).fill(null);
  for (const [x,y] of pts) {
    const ang = Math.atan2(y-cy, x-cx);
    const b = Math.floor(((ang + Math.PI) / (2*Math.PI)) * buckets) % buckets;
    const r = Math.hypot(x-cx, y-cy);
    if (radii[b] === null || r < radii[b]) radii[b] = r; // inner edge of ring
  }
  const vals = radii.filter(v => v !== null);
  const avg = vals.reduce((a,b)=>a+b,0)/vals.length;
  const mn = Math.min(...vals), mx = Math.max(...vals);
  // Expected radius of ellipse at each angle for comparison
  // r_ellipse(θ) = 1 / sqrt((cosθ/rx)^2 + (sinθ/ry)^2)
  const deviations = [];
  for (let b = 0; b < buckets; b++) {
    if (radii[b] === null) continue;
    const theta = ((b + 0.5) / buckets) * 2*Math.PI - Math.PI;
    const expected = 1 / Math.sqrt(Math.pow(Math.cos(theta)/rx,2) + Math.pow(Math.sin(theta)/ry,2));
    deviations.push({ b, theta: (theta*180/Math.PI).toFixed(0), r: radii[b].toFixed(2), expected: expected.toFixed(2), diff: (radii[b]-expected).toFixed(2) });
  }
  console.log(`\n=== CHAIN ${idx} (${pts.length} pts) ===`);
  console.log(`bbox: ${minX.toFixed(1)},${minY.toFixed(1)} → ${maxX.toFixed(1)},${maxY.toFixed(1)}`);
  console.log(`center: ${cx.toFixed(2)},${cy.toFixed(2)}  rx:${rx.toFixed(2)} ry:${ry.toFixed(2)}  ratio:${(rx/ry).toFixed(4)}`);
  console.log(`radius min:${mn.toFixed(2)} max:${mx.toFixed(2)} avg:${avg.toFixed(2)} spread:${(mx-mn).toFixed(2)} (${((mx-mn)/avg*100).toFixed(1)}%)`);
  // print biggest deviations from ellipse
  deviations.sort((a,b)=>Math.abs(b.diff)-Math.abs(a.diff));
  console.log("top deviations from perfect ellipse:");
  deviations.slice(0, 8).forEach(d => console.log(`  ang ${d.theta}° r=${d.r} expected=${d.expected} diff=${d.diff}`));
});
