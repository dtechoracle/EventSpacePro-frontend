const fs = require('fs');

const content = fs.readFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/(components)/AiTrigger.tsx', 'utf8');
const lines = content.split('\n');

// Find the assets processing section
const assetsForEachIdx = lines.findIndex((l, i) =>
    i > 500 && l.includes('plan.assets.forEach((asset: any, idx: number) => {')
);

if (assetsForEachIdx === -1) {
    console.log('Could not find assets forEach');
    process.exit(1);
}

// Find the grid layout calculation section (starts with "if (wallBounds) {")
let gridStartIdx = assetsForEachIdx;
while (gridStartIdx < lines.length && !lines[gridStartIdx].includes('if (wallBounds) {')) {
    gridStartIdx++;
}

// Find the end of that if block (the closing brace before "} else {")
let gridEndIdx = gridStartIdx;
let braceCount = 0;
let foundStart = false;
while (gridEndIdx < lines.length) {
    if (lines[gridEndIdx].includes('if (wallBounds) {')) {
        foundStart = true;
        braceCount = 1;
        gridEndIdx++;
        continue;
    }
    if (foundStart) {
        if (lines[gridEndIdx].includes('{')) braceCount++;
        if (lines[gridEndIdx].includes('}')) braceCount--;
        if (braceCount === 0) break;
    }
    gridEndIdx++;
}

console.log(`Found grid calculation from line ${gridStartIdx} to ${gridEndIdx}`);

// Replace with simple version
const simpleGrid = `          if (wallBounds && plan.gridLayout?.columns && plan.gridLayout?.rows) {
            // Use simple grid calculator
            const positions = calculateGridPositions(
              plan.assets.length,
              width,
              height,
              wallBounds,
              plan.gridLayout.columns,
              plan.gridLayout.rows
            );
            const pos = positions[idx];
            x = pos.x;
            y = pos.y;
            
            if (idx === 0) {
              setMessages((m) => [...m, { 
                role: 'assistant', 
                content: \`🎯 Grid: \${plan.gridLayout.columns}x\${plan.gridLayout.rows}, First pos: (\${Math.round(x)}, \${Math.round(y)})\` 
              }]);
            }`;

lines.splice(gridStartIdx, gridEndIdx - gridStartIdx + 1, simpleGrid);

fs.writeFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/(components)/AiTrigger.tsx', lines.join('\n'), 'utf8');

console.log('✅ Replaced complex grid calc with simple function call!');
