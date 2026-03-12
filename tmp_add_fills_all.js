const fs = require('fs');
const path = require('path');

function getPoints(d) {
    const points = [];
    const matches = d.match(/(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/g);
    if (matches) {
        matches.forEach(m => {
            const [x, y] = m.split(',').map(Number);
            points.push({ x, y });
        });
    }
    return points;
}

function processDirectory(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDirectory(fullPath);
            continue;
        }

        if (file.endsWith('.svg')) {
            let content = fs.readFileSync(fullPath, 'utf8');

            const allPoints = [];
            const pathRegex = /d\s*=\s*["']([^"']+)["']/gi;
            let match;
            while ((match = pathRegex.exec(content)) !== null) {
                allPoints.push(...getPoints(match[1]));
            }

            if (allPoints.length < 5) continue;

            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            allPoints.forEach(p => {
                if (!isNaN(p.x) && !isNaN(p.y)) {
                    minX = Math.min(minX, p.x);
                    minY = Math.min(minY, p.y);
                    maxX = Math.max(maxX, p.x);
                    maxY = Math.max(maxY, p.y);
                }
            });

            if (!content.includes('id="auto-fill"')) {
                const rectD = `M${minX},${minY} L${maxX},${minY} L${maxX},${maxY} L${minX},${maxY} Z`;
                const filler = `\n            <!-- Auto-generated fillable area -->\n            <path id="auto-fill" d="${rectD}" style="fill:inherit;stroke:none;opacity:1;" />`;

                let newContent = content.replace(/(<g[^>]*>)/, `$1${filler}`);
                if (newContent !== content) {
                    fs.writeFileSync(fullPath, newContent);
                    console.log(`Added fill geometry to: ${file}`);
                }
            }
        }
    }
}

['Furniture', 'Sitting_Styles', 'Layout', 'Space_Elements'].forEach(cat => {
    const dir = 'c:/Users/Jeremiah/EventSpacePro-frontend/public/assets/modal/' + cat;
    if (fs.existsSync(dir)) processDirectory(dir);
});
