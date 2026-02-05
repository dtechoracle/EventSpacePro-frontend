const fs = require('fs');

const content = fs.readFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/(components)/AiTrigger.tsx', 'utf8');
const lines = content.split('\n');

// Find where we create the asset object and add debug right before addProjectAsset
for (let i = 580; i < 600; i++) {
    if (lines[i].includes('addProjectAsset(a);')) {
        // Add debug before this line
        const debugLine = '        if (idx === 0) setMessages((m) => [...m, { role: \'assistant\', content: `📍 First table at: (${Math.round(a.x)}, ${Math.round(a.y)}) in wall bounds: (${Math.round(wallBounds.minX)}, ${Math.round(wallBounds.minY)}) to (${Math.round(wallBounds.maxX)}, ${Math.round(wallBounds.maxY)})` }]);';
        lines.splice(i, 0, debugLine);
        console.log(`Added position debug at line ${i}`);
        break;
    }
}

fs.writeFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/(components)/AiTrigger.tsx', lines.join('\n'), 'utf8');

console.log('✅ Added position debug!');
