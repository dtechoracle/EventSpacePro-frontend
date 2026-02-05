const fs = require('fs');

const content = fs.readFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/(components)/AiTrigger.tsx', 'utf8');
const lines = content.split('\n');

// Find the problematic line with the template literal
for (let i = 275; i < 285; i++) {
    if (lines[i].includes('📋 FULL PLAN:') && lines[i].includes('```json')) {
        // Replace with properly escaped version
        lines[i] = '      content: `📋 FULL PLAN:\\n' + '```' + 'json\\n${JSON.stringify(plan, null, 2)}\\n' + '```' + '`';
        console.log(`Fixed line ${i}: ${lines[i]}`);
        break;
    }
}

fs.writeFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/(components)/AiTrigger.tsx', lines.join('\n'), 'utf8');

console.log('✅ Fixed template literal syntax!');
