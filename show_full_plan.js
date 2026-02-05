const fs = require('fs');

const content = fs.readFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/(components)/AiTrigger.tsx', 'utf8');
const lines = content.split('\n');

// Find the debug plan line
const debugIdx = lines.findIndex(l => l.includes('📋 DEBUG Plan:'));
if (debugIdx === -1) {
    console.log('Could not find debug plan line');
    process.exit(1);
}

// Find the closing of that setMessages call (look for }]);)
let closeIdx = debugIdx;
while (closeIdx < lines.length && !lines[closeIdx].includes('}]);')) {
    closeIdx++;
}

if (closeIdx >= lines.length) {
    console.log('Could not find closing of debug message');
    process.exit(1);
}

// Replace the entire debug message with a more detailed one
const newDebug = [
    '    // DEBUG: Show FULL plan in chat',
    '    setMessages((m) => [...m, {',
    '      role: \'assistant\',',
    '      content: `📋 FULL PLAN:\\n\`\`\`json\\n${JSON.stringify(plan, null, 2)}\\n\`\`\``',
    '    }]);'
];

lines.splice(debugIdx - 1, closeIdx - debugIdx + 2, ...newDebug);

fs.writeFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/(components)/AiTrigger.tsx', lines.join('\n'), 'utf8');

console.log('✅ Added full plan debug output!');
