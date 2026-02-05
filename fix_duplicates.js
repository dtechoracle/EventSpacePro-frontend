const fs = require('fs');

const content = fs.readFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/(components)/AiTrigger.tsx', 'utf8');
const lines = content.split('\n');

// Find the tables processing section
const tablesIdx = lines.findIndex(l => l.includes('// Tables - auto-calculate positions if missing'));
if (tablesIdx === -1) {
    console.log('Could not find tables section');
    process.exit(1);
}

// Find the next line with "if (Array.isArray(plan.tables))"
const tablesCheckIdx = lines.findIndex((l, i) => i > tablesIdx && l.includes('if (Array.isArray(plan.tables))'));
if (tablesCheckIdx === -1) {
    console.log('Could not find tables check');
    process.exit(1);
}

// Replace with conditional check that skips if assets were already processed
lines[tablesCheckIdx] = '    if (Array.isArray(plan.tables) && (!plan.assets || plan.assets.length === 0)) {';

// Add a debug message
lines.splice(tablesCheckIdx + 1, 0, '      setMessages((m) => [...m, { role: \'assistant\', content: `⚠️ Using legacy tables array (${plan.tables.length} tables)` }]);');

fs.writeFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/(components)/AiTrigger.tsx', lines.join('\n'), 'utf8');

console.log('✅ Fixed duplicate table processing!');
