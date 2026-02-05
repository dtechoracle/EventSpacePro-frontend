const fs = require('fs');

const content = fs.readFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/(components)/AiTrigger.tsx', 'utf8');
const lines = content.split('\n');

// Find the line with just "}" after the grid calculation (around line 560)
// We need to add a closing brace for the outer if statement
for (let i = 558; i < 565; i++) {
    if (lines[i].trim() === '}' && lines[i + 1].trim() === '') {
        // Add closing brace for outer if
        lines.splice(i + 1, 0, '        }');
        console.log(`Added closing brace for outer if at line ${i + 1}`);
        break;
    }
}

fs.writeFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/(components)/AiTrigger.tsx', lines.join('\n'), 'utf8');

console.log('✅ Fixed missing closing brace!');
