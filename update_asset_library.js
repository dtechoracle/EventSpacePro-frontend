const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, 'public/assets/modal');
const LIBRARY_FILE = path.join(__dirname, 'lib/assets.tsx');

function getSvgDimensions(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const widthMatch = content.match(/<svg[^>]*width=["'](\d+(\.\d+)?)["']/);
        const heightMatch = content.match(/<svg[^>]*height=["'](\d+(\.\d+)?)["']/);
        const viewBoxMatch = content.match(/<svg[^>]*viewBox=["']([\d\s.-]+)["']/);

        let width = widthMatch ? parseFloat(widthMatch[1]) : null;
        let height = heightMatch ? parseFloat(heightMatch[1]) : null;

        if ((!width || !height) && viewBoxMatch) {
            const parts = viewBoxMatch[1].split(/\s+/).map(parseFloat);
            if (parts.length === 4) {
                width = width || parts[2];
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
