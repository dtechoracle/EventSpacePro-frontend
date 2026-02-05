const fs = require('fs');

const content = fs.readFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/(components)/AiTrigger.tsx', 'utf8');
const lines = content.split('\n');

// Find the resize action line
const resizeIdx = lines.findIndex(l => l.includes("if (data.action.type === 'resize')"));
if (resizeIdx === -1) {
    console.log('Could not find resize action');
    process.exit(1);
}

// Insert debug messages after the console.log line
const insertIdx = resizeIdx + 2; // After the console.log line

const debugMessages = [
    '',
    '              // DEBUG: Show in chat what\'s happening',
    '              setMessages((m) => [...m, { ',
    '                role: \'assistant\', ',
    '                content: `🔧 DEBUG: Resize triggered\\nSource: ${source}\\nAsset: ${asset.id}\\nScaleFactor: ${scaleFactor}\\nCurrentScale: ${asset.scale}` ',
    '              }]);'
];

// Also add debug after updateWorkspaceAsset call
const updateAssetIdx = lines.findIndex((l, i) => i > resizeIdx && l.includes('updateWorkspaceAsset(asset.id, { scale: nextScale });'));
if (updateAssetIdx !== -1) {
    lines.splice(updateAssetIdx + 1, 0, '                setMessages((m) => [...m, { role: \'assistant\', content: `📦 Updated asset scale to ${nextScale}` }]);');
}

// Insert debug messages
lines.splice(insertIdx, 0, ...debugMessages);

fs.writeFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/(components)/AiTrigger.tsx', lines.join('\n'), 'utf8');

console.log('✅ Added debug messages to AI chat!');
