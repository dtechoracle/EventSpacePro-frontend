const fs = require('fs');

const filePath = 'public/assets/preloaded-venues/La Madison Dome.svg';
let svg = fs.readFileSync(filePath, 'utf8');

// Parse coordinates in all d="..." attributes
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

console.log('Original content bounds:', { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY });

// Add proportional padding around venue bounds
const contentW = maxX - minX;
const contentH = maxY - minY;
const padX = contentW * 0.02; // 2% padding
const padY = contentH * 0.02;

const vbMinX = (minX - padX).toFixed(3);
const vbMinY = (minY - padY).toFixed(3);
const vbW = (contentW + padX * 2).toFixed(3);
const vbH = (contentH + padY * 2).toFixed(3);

const newViewBox = `${vbMinX} ${vbMinY} ${vbW} ${vbH}`;
console.log('New viewBox setting:', newViewBox);

svg = svg.replace(/viewBox="[^"]+"/, `viewBox="${newViewBox}"`);
fs.writeFileSync(filePath, svg);
console.log('SVG updated successfully!');
