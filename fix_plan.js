const fs = require('fs');

// Read the file
const content = fs.readFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/api/ai/plan.ts', 'utf8');

// Split into lines
const lines = content.split('\n');

// Find and replace lines 105-127 (0-indexed: 104-126)
const before = lines.slice(0, 104);
const after = lines.slice(126);

const replacement = [
    '**EXAMPLE for "12 cocktail tables in 3 columns on the right side" in 10m x 8m room:**',
    'Room is 10000mm x 8000mm. Calculate 3 columns on right side with 1500mm spacing:',
    '- Column 1 (rightmost): x=9000mm, y positions at 1500, 3000, 4500, 6000',
    '- Column 2 (middle): x=7500mm, y positions at 1500, 3000, 4500, 6000',
    '- Column 3 (left): x=6000mm, y positions at 1500, 3000, 4500, 6000',
    'Return tables array with 12 items, each with exact xMm and yMm coordinates.',
    '',
    '**Your Full Capabilities:**'
];

const newContent = [...before, ...replacement, ...after].join('\n');

// Write back
fs.writeFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/api/ai/plan.ts', newContent, 'utf8');

console.log('Fixed! Removed lines 105-127 and replaced with plain text.');
