const fs = require('fs');

const svg = fs.readFileSync('public/assets/preloaded-venues/La Madison Dome.svg', 'utf8');

// Find tight content bounds
const matches = svg.matchAll(/d="([^"]+)"/g);
let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

for (const match of matches) {
  const d = match[1];
  const numbers = d.match(/-?\d+(?:\.\d+)?/g);
  if (numbers) {
    for (let i = 0; i < numbers.length; i += 2) {
      const x = parseFloat(numbers[i]);
      const y = parseFloat(numbers[i+1]);
      if (!isNaN(x) && !isNaN(y)) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }
}

const svgW = maxX - minX;
const svgH = maxY - minY;

// Tight viewBox without extra padding
const newViewBox = `${minX.toFixed(3)} ${minY.toFixed(3)} ${svgW.toFixed(3)} ${svgH.toFixed(3)}`;
console.log('Tight viewBox:', newViewBox);

const updatedSvg = svg.replace(/viewBox="[^"]+"/, `viewBox="${newViewBox}"`);
fs.writeFileSync('public/assets/preloaded-venues/La Madison Dome.svg', updatedSvg);

// Now update preloadedVenues.ts aspect ratio
const svgRatio = svgW / svgH;
const targetWidth = 25000; // Keep 25m width
const targetHeight = Math.round(targetWidth / svgRatio); // Exact height matching SVG aspect ratio (approx 38,905mm)

console.log('Calculated real height for 25m width:', targetHeight);

let preloaded = fs.readFileSync('lib/preloadedVenues.ts', 'utf8');
preloaded = preloaded.replace(/(id:\s*["']la-madison-dome["'][\s\S]*?height:\s*)\d+/, `$1${targetHeight}`);
fs.writeFileSync('lib/preloadedVenues.ts', preloaded);

console.log('All files updated successfully!');
