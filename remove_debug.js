const fs = require('fs');

const content = fs.readFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/(components)/AiTrigger.tsx', 'utf8');
const lines = content.split('\n');

// Find and remove the problematic debug output (lines 278-282)
let foundDebug = false;
for (let i = 275; i < 285; i++) {
    if (lines[i].includes('// DEBUG: Show FULL plan in chat')) {
        // Remove the entire debug block (5 lines)
        lines.splice(i, 5);
        console.log(`Removed debug block at line ${i}`);
        foundDebug = true;
        break;
    }
}

if (!foundDebug) {
    console.log('Debug block not found, trying alternative...');
}

fs.writeFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/(components)/AiTrigger.tsx', lines.join('\n'), 'utf8');

console.log('✅ Removed problematic debug output!');
