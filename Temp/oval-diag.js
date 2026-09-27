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

// Extract all coordinate pairs from path data
const dMatches = [...svg.matchAll(/\sd="([^"]+)"/g)];
let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
let coordCount = 0;

for (const m of dMatches) {
  const d = m[1];
  // Match all numbers in path
  const nums = d.match(/-?\d+\.?\d*/g);
  if (!nums) continue;
  // Path commands with coords: M/L/H/V/C/S/Q/T/A/Z - for simplicity pair them
  // Better: parse command by command for x,y pairs
  const tokens = d.match(/[MLHVCQTAZmlhvcqtaz]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || [];
  let i = 0;
  let cmd = null;
  let cx = 0, cy = 0;
  const points = [];
  while (i < tokens.length) {
    const t = tokens[i];
    if (/[MLHVCQTAZmlhvcqtaz]/.test(t)) {
      cmd = t;
      i++;
      continue;
    }
    const n = parseFloat(t);
    if (cmd === "M" || cmd === "L" || cmd === "m" || cmd === "l") {
      let x = n, y = parseFloat(tokens[i + 1]); i += 2;
      if (cmd === "m" || cmd === "l") { x += cx; y += cy; }
      cx = x; cy = y; points.push([x, y]);
    } else if (cmd === "H" || cmd === "h") {
      let x = n; if (cmd === "h") x += cx;
      cx = x; points.push([x, cy]); i++;
    } else if (cmd === "V" || cmd === "v") {
      let y = n; if (cmd === "v") y += cy;
      cy = y; points.push([cx, y]); i++;
    } else if (cmd === "C" || cmd === "c") {
      const nums2 = tokens.slice(i, i + 6).map(Number);
      if (cmd === "c") { nums2[0]+=cx; nums2[1]+=cy; nums2[2]+=cx; nums2[3]+=cy; nums2[4]+=cx; nums2[5]+=cy; }
      points.push([nums2[0], nums2[1]], [nums2[2], nums2[3]], [nums2[4], nums2[5]]);
      cx = nums2[4]; cy = nums2[5]; i += 6;
    } else if (cmd === "S" || cmd === "s" || cmd === "Q" || cmd === "q") {
      const nums2 = tokens.slice(i, i + 4).map(Number);
      if (cmd === "s" || cmd === "q") { nums2[0]+=cx; nums2[1]+=cy; nums2[2]+=cx; nums2[3]+=cy; }
      points.push([nums2[0], nums2[1]], [nums2[2], nums2[3]]);
      cx = nums2[2]; cy = nums2[3]; i += 4;
    } else if (cmd === "A" || cmd === "a") {
      const nums2 = tokens.slice(i, i + 7).map(Number);
      let ex = nums2[5], ey = nums2[6];
      if (cmd === "a") { ex += cx; ey += cy; }
      points.push([ex, ey]);
      cx = ex; cy = ey; i += 7;
    } else {
      i++;
    }
  }
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    coordCount++;
  }
}

const w = maxX - minX;
const h = maxY - minY;
console.log("=== CONTENT BBOX ===");
console.log("minX", minX, "minY", minY, "maxX", maxX, "maxY", maxY);
console.log("width", w.toFixed(2), "height", h.toFixed(2));
console.log("aspect w/h", (w / h).toFixed(4));
console.log("target aspect 4000/1470 =", (4000 / 1470).toFixed(4));
console.log("points sampled:", coordCount);
console.log("path count:", dMatches.length);

// margins if placed in viewBox 0 0 800 600
console.log("\n=== IF viewBox is 0 0 800 600 ===");
console.log("left margin", minX.toFixed(2), "right margin", (800 - maxX).toFixed(2));
console.log("top margin", minY.toFixed(2), "bottom margin", (600 - maxY).toFixed(2));

// Check root attrs
const root = svg.match(/<svg[^>]+>/)[0];
console.log("\n=== ROOT ===");
console.log(root);

// Check if library has entry
const assets = fs.readFileSync(path.join(__dirname, "..", "lib", "assets.tsx"), "utf8");
const idx = assets.indexOf("4000mm X 1470mm Oval");
console.log("\n=== LIBRARY ENTRY ===", idx >= 0 ? "FOUND at char " + idx : "NOT FOUND");
if (idx >= 0) console.log(assets.slice(Math.max(0, idx - 200), idx + 300));
