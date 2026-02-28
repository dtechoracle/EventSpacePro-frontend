const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, 'public/assets/modal');
const LIBRARY_FILE = path.join(__dirname, 'lib/assets.tsx');

function getSvgDimensions(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const widthMatch = content.match(/<svg[^>]*width=["'](\d+(?:\.\d+)?)(mm|cm|px|pt|in)?["']/);
        const heightMatch = content.match(/<svg[^>]*height=["'](\d+(?:\.\d+)?)(mm|cm|px|pt|in)?["']/);
        const viewBoxMatch = content.match(/<svg[^>]*viewBox=["']([\d\s.-]+)["']/);

        const toMm = (value, unit) => {
            const val = parseFloat(value);
            switch (unit) {
                case 'mm': return val;
                case 'cm': return val * 10;
                case 'in': return val * 25.4;
                case 'pt': return val * (25.4 / 72);
                case 'px':
                default: return val * (25.4 / 96);
            }
        };

        let width = widthMatch ? toMm(widthMatch[1], widthMatch[2] || 'px') : null;
        let height = heightMatch ? toMm(heightMatch[1], heightMatch[2] || 'px') : null;

        if ((!width || !height) && viewBoxMatch) {
            const parts = viewBoxMatch[1].split(/\s+/).map(parseFloat);
            if (parts.length === 4) {
                width = width || parts[2];
                height = height || parts[3];
            }
        }

        return { width: width ? (width) : 500, height: height ? (height) : 500 };
    } catch (e) {
        console.error(`Error reading ${filePath}:`, e);
        return { width: 500, height: 500 };
    }
}

function parseDimensionsFromName(name) {
    // E.g. "1200mm X 600mm Coffee Table"
    const dimMatch = name.match(/(\d+(?:\.\d+)?)\s*(mm|cm|m|ft)?\s*[xX]\s*(\d+(?:\.\d+)?)\s*(mm|cm|m|ft)?/i);
    if (dimMatch) {
        let val1 = parseFloat(dimMatch[1]);
        let unit1 = (dimMatch[2] || 'mm').toLowerCase();
        let val2 = parseFloat(dimMatch[3]);
        let unit2 = (dimMatch[4] || dimMatch[2] || 'mm').toLowerCase();

        const toMm = (v, u) => {
            switch (u) {
                case 'cm': return v * 10;
                case 'm': return v * 1000;
                case 'ft': return v * 304.8;
                case 'mm': default: return v;
            }
        };
        return { width: Math.round(toMm(val1, unit1)), height: Math.round(toMm(val2, unit2)) };
    }

    // E.g. "900mm Swing Door" -> Returns 900x900 (assuming square or fallback)
    const singleMatch = name.match(/^(\d+(?:\.\d+)?)\s*(mm|cm|m|ft)?\s+/i);
    if (singleMatch) {
        let val1 = parseFloat(singleMatch[1]);
        let unit1 = (singleMatch[2] || 'mm').toLowerCase();
        const toMm = (v, u) => {
            switch (u) {
                case 'cm': return v * 10;
                case 'm': return v * 1000;
                case 'ft': return v * 304.8;
                case 'mm': default: return v;
            }
        };
        const dim = Math.round(toMm(val1, unit1));
        // Only accept single dimensions if they're reasonable (> 100) or explicitly have a dimensional unit
        if (dim >= 100 || (singleMatch[2] && singleMatch[2].length > 0)) {
            return { width: dim, height: dim };
        }
    }

    return null;
}

function updateLibrary() {
    const categories = new Set();
    const assets = [];

    const walkDir = (currentPath) => {
        const items = fs.readdirSync(currentPath);
        for (const item of items) {
            const itemPath = path.join(currentPath, item);
            const stat = fs.statSync(itemPath);

            if (stat.isDirectory()) {
                walkDir(itemPath);
            } else if (item.endsWith('.svg') && !item.endsWith('.bak.svg')) {
                // Category is the folder name inside modal/
                let relativePath = path.relative(ASSETS_DIR, itemPath).replace(/\\/g, '/');
                let catSplit = relativePath.split('/');
                let categoryName = catSplit.length > 1 ? catSplit[0] : 'Uncategorized';

                // Some formatting
                const id = path.basename(item, '.svg').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                const label = path.basename(item, '.svg');

                categories.add(categoryName);

                let dims = parseDimensionsFromName(label);
                let svgDims = getSvgDimensions(itemPath);

                // Prioritize explicit filename dimensions, fallback to parsed SVG pixels -> mm
                let width = dims ? dims.width : Math.round(svgDims.width);
                let height = dims ? dims.height : Math.round(svgDims.height);

                assets.push({
                    id,
                    label,
                    path: `/assets/modal/${relativePath}`,
                    category: categoryName,
                    width,
                    height,
                    name: label
                });
            }
        }
    };

    walkDir(ASSETS_DIR);

    let categoriesUnion = Array.from(categories).map(c => `  | "${c}"`).join('\n');
    let categoriesListStr = Array.from(categories).map(c => `"${c}"`).join(', ');

    let itemsCode = assets.map(a => `  {
    id: ${JSON.stringify(a.id)},
    label: ${JSON.stringify(a.label)},
    path: ${JSON.stringify(a.path)},
    category: ${JSON.stringify(a.category)},
    width: ${a.width},
    height: ${a.height},
    name: ${JSON.stringify(a.name)}
  }`).join(',\n');

    const fileContent = `export type AssetCategory =
${categoriesUnion}

export type AssetDef = {
  name: string
  id: string
  label: string
  path: string
  category: AssetCategory
  width?: number
  height?: number
}

export const ASSET_CATEGORIES: AssetCategory[] = [${categoriesListStr}];

export const ASSET_LIBRARY: AssetDef[] = [
${itemsCode}
]
`;

    fs.writeFileSync(LIBRARY_FILE, fileContent);
    console.log('Updated lib/assets.tsx with ' + assets.length + ' assets.');
}

updateLibrary();
