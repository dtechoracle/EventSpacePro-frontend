const fs = require('fs');

const content = fs.readFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/(components)/AiTrigger.tsx', 'utf8');
let lines = content.split('\n');

// Find the section from line 540 to 561 and replace it with correct structure
const startIdx = lines.findIndex((l, i) => i > 535 && l.includes('if (wallBounds && plan.gridLayout?.columns'));
if (startIdx === -1) {
    console.log('Could not find start');
    process.exit(1);
}

// Find the two closing braces (lines 560-561)
let endIdx = startIdx;
while (endIdx < lines.length && !(lines[endIdx].trim() === '}' && lines[endIdx + 1].trim() === '}')) {
    endIdx++;
}

console.log(`Replacing lines ${startIdx} to ${endIdx + 1}`);

// Replace with correct structure
const correctCode = [
    '          if (wallBounds && plan.gridLayout?.columns && plan.gridLayout?.rows) {',
    '            // Use simple grid calculator',
    '            const positions = calculateGridPositions(',
    '              plan.assets.length,',
    '              width,',
    '              height,',
    '              wallBounds,',
    '              plan.gridLayout.columns,',
    '              plan.gridLayout.rows',
    '            );',
    '            const pos = positions[idx];',
    '            x = pos.x;',
    '            y = pos.y;',
    '            ',
    '            if (idx === 0) {',
    '              setMessages((m) => [...m, { ',
    '                role: \'assistant\', ',
    '                content: `🎯 Grid: ${plan.gridLayout.columns}x${plan.gridLayout.rows}, First pos: (${Math.round(x)}, ${Math.round(y)})` ',
    '              }]);',
    '            }',
    '          } else {',
    '            // No grid layout, use default positioning',
    '            x = canvasCenter.x + (idx % 3 - 1) * 200;',
    '            y = canvasCenter.y + Math.floor(idx / 3) * 200;',
    '          }',
    '        }'
];

lines.splice(startIdx, endIdx - startIdx + 2, ...correctCode);

fs.writeFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/(components)/AiTrigger.tsx', lines.join('\n'), 'utf8');

console.log('✅ Fixed the if-else structure!');
