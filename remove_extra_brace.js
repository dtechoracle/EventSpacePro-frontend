const fs = require('fs');

const content = fs.readFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/(components)/AiTrigger.tsx', 'utf8');
const lines = content.split('\n');

// Find and remove the extra closing brace on line 566
for (let i = 563; i < 570; i++) {
    if (lines[i].trim() === '}' && lines[i - 1].trim() === '}' && lines[i + 1].trim() === '') {
        // This is the extra brace
        lines.splice(i, 1);
        console.log(`Removed extra brace at line ${i}`);
        break;
    }
}

fs.writeFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/(components)/AiTrigger.tsx', lines.join('\n'), 'utf8');

console.log('✅ Removed extra closing brace!');
