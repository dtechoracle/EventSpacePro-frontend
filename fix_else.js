const fs = require('fs');

const content = fs.readFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/(components)/AiTrigger.tsx', 'utf8');
const lines = content.split('\n');

// Find line 560 which has just "}"
for (let i = 555; i < 565; i++) {
    if (lines[i].trim() === '}' && lines[i - 1].includes('});')) {
        // This is the closing brace for the if (wallBounds && gridLayout) block
        // We need to add an else block
        const elseBlock = [
            '          } else {',
            '            // No grid layout or no wall bounds, use default positioning',
            '            x = canvasCenter.x + (idx % 3 - 1) * 200;',
            '            y = canvasCenter.y + Math.floor(idx / 3) * 200;',
            '          }'
        ];

        lines.splice(i, 1, ...elseBlock);
        console.log(`Added else block at line ${i}`);
        break;
    }
}

fs.writeFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/(components)/AiTrigger.tsx', lines.join('\n'), 'utf8');

console.log('✅ Fixed missing else block!');
