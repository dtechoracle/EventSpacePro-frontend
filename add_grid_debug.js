const fs = require('fs');

const content = fs.readFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/(components)/AiTrigger.tsx', 'utf8');
const lines = content.split('\n');

// Find "return positions;" in the calculateGridPositions function
for (let i = 260; i < 280; i++) {
    if (lines[i].includes('return positions;')) {
        // Add debug output before return
        const debugLines = [
            '      ',
            '      // Debug output',
            '      setMessages((m) => [...m, {',
            '        role: \'assistant\',',
            '        content: `🔍 Grid: Wall=${Math.round(wallWidth)}x${Math.round(wallHeight)}mm, Items=${itemWidth}x${itemHeight}mm, ${cols}x${rows} grid, Gaps=${Math.round(gapX)}x${Math.round(gapY)}mm`',
            '      }]);'
        ];

        lines.splice(i, 0, ...debugLines);
        console.log(`Added debug output before return at line ${i}`);
        break;
    }
}

fs.writeFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/(components)/AiTrigger.tsx', lines.join('\n'), 'utf8');

console.log('✅ Added grid debug output!');
