const fs = require('fs');

const content = fs.readFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/(components)/AiTrigger.tsx', 'utf8');
const lines = content.split('\n');

// Find the clampInWall line for assets
const clampIdx = lines.findIndex((l, i) =>
    i > 500 && i < 600 && l.includes('const pos = clampInWall(x, y, Math.max(width, height)')
);

if (clampIdx === -1) {
    console.log('Could not find clampInWall line');
    process.exit(1);
}

console.log(`Found clampInWall at line ${clampIdx}: ${lines[clampIdx]}`);

// Replace with conditional clamping
const newLines = [
    '        // Don\'t clamp grid-positioned assets - they\'re already calculated to fit',
    '        const pos = (asset.xMm === undefined || asset.yMm === undefined) && wallBounds',
    '          ? { x, y }  // Grid-positioned, use exact coordinates',
    '          : clampInWall(x, y, 50, width, height);  // User-provided, clamp to wall with small margin'
];

lines.splice(clampIdx, 1, ...newLines);

fs.writeFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/(components)/AiTrigger.tsx', lines.join('\n'), 'utf8');

console.log('✅ Fixed clampInWall to preserve grid positions!');
