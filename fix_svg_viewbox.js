const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, 'public/assets/modal');

// Parse SVG and calculate bounding box of all path elements
function calculateContentBounds(svgContent) {
    const pathRegex = /\u003cpath[^\u003e]*d="([^"]+)"/g;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let foundPaths = false;

    let match;
    while ((match = pathRegex.exec(svgContent)) !== null) {
        const pathData = match[1];
        foundPaths = true;

        // Extract all coordinate pairs from path data
        // Matches: M, L, C, Q, etc. followed by numbers
        const coordRegex = /([ML])\s*([\d.-]+)\s+([\d.-]+)/g;
        let coordMatch;

        while ((coordMatch = coordRegex.exec(pathData)) !== null) {
            const x = parseFloat(coordMatch[2]);
            const y = parseFloat(coordMatch[3]);

            if (!isNaN(x) && !isNaN(y)) {
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
            }
        }
    }

    if (!foundPaths || minX === Infinity) {
        return null;
    }

    return { minX, minY, maxX, maxY };
}

// Fix viewBox in SVG file
function fixSvgViewBox(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');

        // Check if this is a CAD-exported SVG (has "Acme CAD Converter" or large viewBox)
        if (!content.includes('Acme CAD Converter') &&
            !content.match(/viewBox="[\d.]+ [\d.]+ [5-9]\d{2}|[1-9]\d{3}/)) {
            return false; // Skip non-CAD SVGs
        }

        const bounds = calculateContentBounds(content);
        if (!bounds) {
            console.log(`  ⚠️  No paths found in ${path.basename(filePath)}`);
            return false;
        }

        const { minX, minY, maxX, maxY } = bounds;
        const contentWidth = maxX - minX;
        const contentHeight = maxY - minY;

        // Add 10% padding around content
        const padding = Math.max(contentWidth, contentHeight) * 0.1;
        const newMinX = minX - padding;
        const newMinY = minY - padding;
        const newWidth = contentWidth + (padding * 2);
        const newHeight = contentHeight + (padding * 2);

        // Round to 2 decimal places
        const viewBox = `${newMinX.toFixed(2)} ${newMinY.toFixed(2)} ${newWidth.toFixed(2)} ${newHeight.toFixed(2)}`;

        // Update viewBox attribute
        const updatedContent = content.replace(
            /viewBox="[\d.\s]+"/,
            `viewBox="${viewBox}"`
        );

        // Also update width and height to match aspect ratio
        const aspectRatio = newWidth / newHeight;
        let newSvgWidth, newSvgHeight;

        if (aspectRatio > 1) {
            // Wider than tall
            newSvgWidth = 800;
            newSvgHeight = 800 / aspectRatio;
        } else {
            // Taller than wide
            newSvgHeight = 800;
            newSvgWidth = 800 * aspectRatio;
        }

        const finalContent = updatedContent
            .replace(/width="[\d.]+"/, `width="${newSvgWidth.toFixed(2)}"`)
            .replace(/height="[\d.]+"/, `height="${newSvgHeight.toFixed(2)}"`);

        fs.writeFileSync(filePath, finalContent);

        console.log(`  ✓ Fixed ${path.basename(filePath)}`);
        console.log(`    Old viewBox: 800x600, New viewBox: ${newWidth.toFixed(0)}x${newHeight.toFixed(0)}`);
        return true;
    } catch (e) {
        console.error(`  ✗ Error fixing ${filePath}:`, e.message);
        return false;
    }
}

// Recursively process all SVG files
function processSvgFiles(dir) {
    const files = fs.readdirSync(dir);
    let fixedCount = 0;

    files.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            fixedCount += processSvgFiles(fullPath);
        } else if (file.endsWith('.svg')) {
            if (fixSvgViewBox(fullPath)) {
                fixedCount++;
            }
        }
    });

    return fixedCount;
}

console.log('🔧 Fixing SVG viewBox for CAD-exported files...\n');
const fixedCount = processSvgFiles(ASSETS_DIR);
console.log(`\n✅ Fixed ${fixedCount} SVG file(s)`);
