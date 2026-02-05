const fs = require('fs');

const content = fs.readFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/(components)/AiTrigger.tsx', 'utf8');
const lines = content.split('\n');

// Find the duplicate setMessages lines (around line 279-281)
let foundDuplicate = false;
for (let i = 270; i < 290; i++) {
    if (lines[i].includes('// DEBUG: Show plan in chat') &&
        lines[i + 1].includes('setMessages((m) => [...m, {') &&
        lines[i + 2].includes('// DEBUG: Show FULL plan in chat')) {
        // Remove the incomplete first setMessages
        lines.splice(i, 2);  // Remove lines i and i+1
        foundDuplicate = true;
        console.log(`Removed duplicate at line ${i}`);
        break;
    }
}

if (!foundDuplicate) {
    console.log('Could not find duplicate pattern, trying alternative...');
    // Just find and remove any line that has "// DEBUG: Show plan in chat" followed by incomplete setMessages
    for (let i = 270; i < 290; i++) {
        if (lines[i].includes('setMessages((m) => [...m, {') &&
            !lines[i].includes('role:') &&
            lines[i + 1].includes('// DEBUG: Show FULL plan')) {
            lines.splice(i, 1);
            console.log(`Removed incomplete setMessages at line ${i}`);
            break;
        }
    }
}

fs.writeFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/(components)/AiTrigger.tsx', lines.join('\n'), 'utf8');

console.log('✅ Fixed syntax error!');
