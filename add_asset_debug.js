const fs = require('fs');

const content = fs.readFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/(components)/AiTrigger.tsx', 'utf8');
const lines = content.split('\n');

// Find the line "if (Array.isArray(plan.assets) && plan.assets.length > 0) {"
const assetsCheckIdx = lines.findIndex(l => l.includes('if (Array.isArray(plan.assets) && plan.assets.length > 0)'));
if (assetsCheckIdx === -1) {
    console.log('Could not find assets check');
    process.exit(1);
}

// Insert debug message after the if statement
const debugLine = `      setMessages((m) => [...m, { role: 'assistant', content: \`🔧 Processing \${plan.assets.length} assets. GridLayout: \${JSON.stringify(plan.gridLayout)}\` }]);`;

lines.splice(assetsCheckIdx + 1, 0, debugLine);

fs.writeFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/(components)/AiTrigger.tsx', lines.join('\n'), 'utf8');

console.log('✅ Added debug output at start of assets processing');
