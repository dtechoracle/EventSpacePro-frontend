const fs = require('fs');
const svg = fs.readFileSync('public/assets/modal/Furniture/2150mm X 2150mm Crescent Table.svg', 'utf8');
// Extract all coordinate pairs from path d attributes
const ds = [...svg.matchAll(/\sd="([^"]+)"/g)].map(m => m[1]);
let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
for (const d of ds) {
  const nums = d.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) || [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const x = parseFloat(nums[i]);
    const y = parseFloat(nums[i + 1]);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}
const w = maxX - minX;
const h = maxY - minY;
console.log({ minX, minY, maxX, maxY, w, h, ratio: w / h });
console.log('viewBox suggestion:', `${minX} ${minY} ${w} ${h}`);
console.log('path count:', ds.length);
