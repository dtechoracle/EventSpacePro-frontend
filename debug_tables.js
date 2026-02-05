const fs = require('fs');

const content = fs.readFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/(components)/AiTrigger.tsx', 'utf8');
const lines = content.split('\n');

// Find the tables processing line
for (let i = 595; i < 610; i++) {
    if (lines[i].includes('if (Array.isArray(plan.tables)')) {
        // Add debug before this line
        const debugLine = '    if (plan.tables && plan.tables.length > 0) setMessages((m) => [...m, { role: \'assistant\', content: `⚠️ AI provided ${plan.tables.length} items in deprecated tables array! This should not happen.` }]);';
        lines.splice(i, 0, debugLine);
        console.log(`Added tables debug at line ${i}`);
        break;
    }
}

fs.writeFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/(components)/AiTrigger.tsx', lines.join('\n'), 'utf8');

console.log('✅ Added tables array debug!');
