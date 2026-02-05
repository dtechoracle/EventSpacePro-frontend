const fs = require('fs');

const content = fs.readFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/(components)/AiTrigger.tsx', 'utf8');
const lines = content.split('\n');

// Find the tables processing section and comment it out
let foundTablesStart = false;
let startIdx = -1;
let endIdx = -1;

for (let i = 595; i < 700; i++) {
    if (!foundTablesStart && lines[i].includes('// Tables - auto-calculate positions if missing')) {
        startIdx = i;
        foundTablesStart = true;
    }

    if (foundTablesStart && lines[i].trim() === '}' && lines[i - 1].includes('});')) {
        // This is likely the end of the tables forEach
        // Check if the next non-empty line starts a new section
        let nextIdx = i + 1;
        while (nextIdx < lines.length && lines[nextIdx].trim() === '') nextIdx++;
        if (nextIdx < lines.length && (lines[nextIdx].includes('// Chairs') || lines[nextIdx].includes('// Circular'))) {
            endIdx = i;
            break;
        }
    }
}

if (startIdx !== -1 && endIdx !== -1) {
    // Comment out the entire section
    for (let i = startIdx; i <= endIdx; i++) {
        if (lines[i].trim() !== '') {
            lines[i] = '    // DEPRECATED: ' + lines[i].trim();
        }
    }
    console.log(`Commented out tables processing from line ${startIdx} to ${endIdx}`);
} else {
    console.log('Could not find tables processing section');
}

fs.writeFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/(components)/AiTrigger.tsx', lines.join('\n'), 'utf8');

console.log('✅ Disabled tables processing!');
