const fs = require('fs');
const path = require('path');

const svgPath = path.join(process.cwd(), 'public/assets/modal/Furniture/10 seater round table 01.svg');
let svg = fs.readFileSync(svgPath, 'utf8');

// The outline paths are large paths that enclose the chairs
let count = 0;
svg = svg.replace(/<path\s+fill="inherit"\s+d="M\s*(-?[\d.]+)\s*[, \s]\s*(-?[\d.]+)[^"]*?(-?[\d.]+)\s*[, \s]\s*(-?[\d.]+)"/gi, (match, startX, startY, endX, endY) => {
    const sX = parseFloat(startX);
    const sY = parseFloat(startY);
    const eX = parseFloat(endX);
    const eY = parseFloat(endY);
    
    // Check if path is closed by coordinates and is substantial (not just a tiny loop)
    if (Math.abs(sX - eX) < 1.1 && Math.abs(sY - eY) < 1.1 && match.length > 200) {
        count++;
        return match.replace('<path ', '<path id="auto-fill" ');
    }
    return match;
});

fs.writeFileSync(svgPath, svg);
console.log(`SVG updated successfully. Marked ${count} paths.`);
