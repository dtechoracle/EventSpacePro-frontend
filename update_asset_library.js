const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, 'public/assets/modal');
const LIBRARY_FILE = path.join(__dirname, 'lib/assets.tsx');

function getSvgDimensions(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        // Updated regex to capture units (mm, cm, px, pt, etc.)
        const widthMatch = content.match(/<svg[^>]*width=["'](\d+(?:\.\d+)?)(mm|cm|px|pt|in)?["']/);
        const heightMatch = content.match(/<svg[^>]*height=["'](\d+(?:\.\d+)?)(mm|cm|px|pt|in)?["']/);
        const viewBoxMatch = content.match(/<svg[^>]*viewBox=["']([\d\s.-]+)["']/);

        // Helper to convert to mm
        const toMm = (value, unit) => {
            const val = parseFloat(value);
            switch (unit) {
                case 'mm': return val;
                case 'cm': return val * 10;
                case 'in': return val * 25.4;
                case 'pt': return val * 0.352778;
                case 'px':
                default: return val; // Treat unitless/px as mm (1:1 for our use case)
            }
        };

        let width = widthMatch ? toMm(widthMatch[1], widthMatch[2] || 'px') : null;
        let height = heightMatch ? toMm(heightMatch[1], heightMatch[2] || 'px') : null;

        // Fallback to viewBox if width/height not found
        if ((!width || !height) && viewBoxMatch) {
            const parts = viewBoxMatch[1].split(/\s+/).map(parseFloat);
            if (parts.length === 4) {
                width = width || parts[2]; // viewBox is unitless, treat as mm
                height = height || parts[3];
            }
        }

        return { width, height };
    } catch (e) {
        console.error(`Error reading ${filePath}:`, e);
        return { width: null, height: null };
    }
}

function updateLibrary() {
    let libraryContent = fs.readFileSync(LIBRARY_FILE, 'utf8');

    // Regex to find the ASSET_LIBRARY array
    // We'll iterate through the file content and replace lines

    const lines = libraryContent.split('\n');
    const newLines = lines.map(line => {
        // Look for lines like: { id: "...", ... path: "...", ... }
        const pathMatch = line.match(/path:\s*"([^"]+)"/);
        if (pathMatch) {
            const relativePath = pathMatch[1];
            const fullPath = path.join(__dirname, 'public', relativePath);

            if (fs.existsSync(fullPath)) {
                const { width, height } = getSvgDimensions(fullPath);
                if (width && height) {
                    // Check if line already has width/height
                    if (line.includes('width:') && line.includes('height:')) {
                        // Replace existing dimensions
                        return line.replace(/width:\s*\d+/, `width: ${Math.round(width)}`)
                            .replace(/height:\s*\d+/, `height: ${Math.round(height)}`);
                    } else {
                        // Append dimensions before the closing brace
                        return line.replace(/},?$/, `, width: ${Math.round(width)}, height: ${Math.round(height)} },`);
                    }
                }
            }
        }
        return line;
    });

    fs.writeFileSync(LIBRARY_FILE, newLines.join('\n'));
    console.log('Updated lib/assets.tsx with correct dimensions.');
}

updateLibrary();
