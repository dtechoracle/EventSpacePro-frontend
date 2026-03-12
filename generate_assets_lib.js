const fs = require('fs');
const path = require('path');

const modalDir = 'public/assets/modal';
const canvasDir = 'public/assets/canvas';

function getSvgDimensions(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const matchWidth = content.match(/width="([0-9.]+)(?:px|mm)?"/);
        const matchHeight = content.match(/height="([0-9.]+)(?:px|mm)?"/);
        if (matchWidth && matchHeight) {
            return { w: Math.round(parseFloat(matchWidth[1])), h: Math.round(parseFloat(matchHeight[1])) };
        }

        const viewBoxMatch = content.match(/viewBox="(?:0\s+0\s+)?([0-9.]+)\s+([0-9.]+)"/);
        if (viewBoxMatch) {
            return { w: Math.round(parseFloat(viewBoxMatch[1])), h: Math.round(parseFloat(viewBoxMatch[2])) };
        }
    } catch (e) { }
    return undefined;
}

function processDir(dir) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    const categories = fs.readdirSync(dir);
    for (const cat of categories) {
        const fPath = path.join(dir, cat);
        if (fs.statSync(fPath).isDirectory()) {
            const files = fs.readdirSync(fPath).filter(f => f.endsWith('.svg'));
            for (const f of files) {
                const fullPath = path.join(fPath, f);
                const dims = getSvgDimensions(fullPath);
                results.push({
                    id: f.replace('.svg', '').replace(/\s+/g, '-').toLowerCase(),
                    label: f.replace('.svg', ''),
                    path: `/assets/modal/${cat}/${f}`,
                    category: cat,
                    width: dims ? dims.w : undefined,
                    height: dims ? dims.h : undefined,
                    name: f.replace('.svg', '')
                });
            }
        }
    }
    return results;
}

const assets = processDir(modalDir);
const categories = [...new Set(assets.map(a => a.category))];

let output = `export type AssetCategory = \n  | "` + categories.join(`"\n  | "`) + `";\n\n`;
output += `export type AssetDef = {
  name: string
  id: string
  label: string
  path: string
  category: AssetCategory
  width?: number
  height?: number
}\n\n`;

output += `export const ASSET_CATEGORIES: AssetCategory[] = ` + JSON.stringify(categories) + `;\n\n`;
output += `export const ASSET_LIBRARY: AssetDef[] = ` + JSON.stringify(assets, null, 2) + `;\n`;

fs.writeFileSync('lib/assets.tsx', output);
console.log('Saved lib/assets.tsx with ' + assets.length + ' assets across ' + categories.length + ' categories.');
