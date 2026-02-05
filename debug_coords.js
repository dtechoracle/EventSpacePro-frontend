const fs = require('fs');

const content = fs.readFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/(components)/AiTrigger.tsx', 'utf8');
const lines = content.split('\n');

// Find the line "// Auto-calculate position if missing or invalid"
for (let i = 540; i < 550; i++) {
    if (lines[i].includes('// Auto-calculate position if missing or invalid')) {
        // Add debug right after this line
        const debugLines = [
            '        if (idx === 0) setMessages((m) => [...m, { role: \'assistant\', content: `🐛 Asset coords: xMm=${asset.xMm}, yMm=${asset.yMm}, hasWallBounds=${!!wallBounds}, hasGridLayout=${!!(plan.gridLayout?.columns && plan.gridLayout?.rows)}` }]);'
        ];
        lines.splice(i + 1, 0, ...debugLines);
        console.log(`Added asset debug at line ${i + 1}`);
        break;
    }
}

fs.writeFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/(components)/AiTrigger.tsx', lines.join('\n'), 'utf8');

console.log('✅ Added asset coordinate debug!');
