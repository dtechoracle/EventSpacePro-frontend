const fs = require("fs");
const path = require("path");

// Target physical size from filename
const W = 4000, H = 1470;
// Content maps exactly to this aspect (verified 2.7210 ≈ 4000/1470)
const a = W / 2, b = H / 2; // outer semi-axes in mm units

// Rim thickness: original avg nn gap was ~2.09 user-units on 243.91-unit width
// → 2.09/243.91*4000 ≈ 34.3mm. Use 34mm.
const rim = 34;

// True parallel offset of an ellipse is not an ellipse. Build inner ring as
// dense polyline: sample outer, walk along inward normal by `rim`, emit path.
function sampleEllipse(n) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    pts.push([a * Math.cos(t), b * Math.sin(t)]);
  }
  return pts;
}

function inwardNormalOffset(pts, d) {
  const out = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const [x, y] = pts[i];
    const [xp, yp] = pts[(i - 1 + n) % n];
    const [xn, yn] = pts[(i + 1) % n];
    // tangent
    let tx = xn - xp, ty = yn - yp;
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl; ty /= tl;
    // inward normal (ellipse centered at origin, CCW sampling → right-hand inward is (-ty, tx) wait:
    // For CCW ellipse, outward normal is (ty, -tx) with t=(dx,dy)... check at (a,0): tangent (0,b), outward should (1,0).
    // t=(0,1) normalized; (ty,-tx)=(1,0) outward. So inward = (-ty, tx).
    let nx = -ty, ny = tx;
    // ensure inward: dot with position should be negative for convex centered shape
    if (nx * x + ny * y > 0) { nx = -nx; ny = -ny; }
    out.push([x + nx * d, y + ny * d]);
  }
  return out;
}

function pathD(pts, close = true) {
  // scale already in mm; viewBox will be 0 0 4000 1470 with center at 2000,735
  const parts = pts.map(([x, y], i) => {
    const X = (x + a).toFixed(2);
    const Y = (y + b).toFixed(2);
    return (i === 0 ? "M" : "L") + X + " " + Y;
  });
  if (close) parts.push("Z");
  return parts.join("");
}

const outerPts = sampleEllipse(360);
const innerPts = inwardNormalOffset(outerPts, rim);

// Verify uniform gap
let minG = Infinity, maxG = Infinity;
for (let i = 0; i < outerPts.length; i++) {
  const [ox, oy] = outerPts[i];
  const [ix, iy] = innerPts[i];
  const g = Math.hypot(ox - ix, oy - iy);
  if (g < minG) minG = g;
  if (g > maxG) maxG = g;
}
console.log(`offset check: min=${minG.toFixed(3)} max=${maxG.toFixed(3)} (target ${rim})`);

const outerD = pathD(outerPts);
const innerD = pathD(innerPts);

// stroke-width: raster gen recomputes from viewBox; keep small source stroke
// matching other CAD assets' relative weight. viewBox max side = 4000.
// Workspace uses root stroke from generator; source stroke used by InlineSvg too.
const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}" version="1.1">
<path d="${outerD}" fill="none" stroke="black" stroke-width="8"/>
<path d="${innerD}" fill="none" stroke="black" stroke-width="8"/>
</svg>
`;

const outPath = path.join(__dirname, "..", "public", "assets", "modal", "Furniture", "4000mm X 1470mm Oval Table.svg");
fs.writeFileSync(outPath, svg);
console.log("wrote", outPath, "bytes", svg.length);

// Re-verify bbox
let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
for (const [x,y] of outerPts) {
  const X=x+a, Y=y+b;
  if(X<minX)minX=X; if(Y<minY)minY=Y; if(X>maxX)maxX=X; if(Y>maxY)maxY=Y;
}
console.log(`bbox: ${minX},${minY} → ${maxX},${maxY}  size ${(maxX-minX).toFixed(2)}x${(maxY-minY).toFixed(2)}`);
console.log(`aspect ${((maxX-minX)/(maxY-minY)).toFixed(4)} target ${(W/H).toFixed(4)}`);
