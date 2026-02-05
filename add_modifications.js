const fs = require('fs');

const content = fs.readFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/api/ai/plan.ts', 'utf8');
const lines = content.split('\n');

// Find the line with "// Groups" and add modifications before the closing brace
const groupsIndex = lines.findIndex(l => l.includes('// Groups'));
const closingBraceIndex = lines.findIndex((l, i) => i > groupsIndex && l.trim() === '};');

const before = lines.slice(0, closingBraceIndex);
const after = lines.slice(closingBraceIndex);

const modificationsSection = [
    '  ',
    '  // Modifications to selected assets (when user selects assets and asks AI to modify them)',
    '  modifications?: {',
    '    assetId: string;        // ID of asset to modify (from selectedAssets)',
    '    widthMm?: number;       // New width',
    '    heightMm?: number;      // New height',
    '    rotation?: number;      // New rotation in degrees',
    '    xMm?: number;           // New X position',
    '    yMm?: number;           // New Y position',
    '    fillColor?: string;     // New fill color',
    '    strokeColor?: string;   // New stroke color',
    '    scale?: number;         // Scale multiplier (e.g., 1.5 = 150%, 2.0 = 200%)',
    '  }[];'
];

const newContent = [...before, ...modificationsSection, ...after].join('\n');
fs.writeFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/api/ai/plan.ts', newContent, 'utf8');

console.log('Added modifications field to Plan type!');
