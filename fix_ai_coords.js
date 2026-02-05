const fs = require('fs');

const content = fs.readFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/api/ai/plan.ts', 'utf8');
const lines = content.split('\n');

// Find the line "- You can omit xMm/yMm coordinates"
for (let i = 145; i < 160; i++) {
    if (lines[i].includes('You can omit xMm/yMm coordinates')) {
        // Replace this line
        lines[i] = '- **IMPORTANT: When using gridLayout, DO NOT provide xMm/yMm coordinates - omit them completely so they are auto-calculated**';
        // Add another line after it
        lines.splice(i + 1, 0, '- Only provide xMm/yMm if user specifies exact positions (e.g., "place table at 5000, 3000")');
        console.log(`Updated line ${i} and added line ${i + 1}`);
        break;
    }
}

fs.writeFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/api/ai/plan.ts', lines.join('\n'), 'utf8');

console.log('✅ Updated AI prompt to omit coordinates!');
