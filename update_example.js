const fs = require('fs');

const content = fs.readFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/api/ai/plan.ts', 'utf8');
const lines = content.split('\n');

// Replace lines 112-117 with new detailed example
const before = lines.slice(0, 111);
const after = lines.slice(117);

const newExample = [
    '**EXAMPLE: "12 tables in 3 columns, distribute evenly with 200mm padding" in 10m x 8m room:**',
    'Room: 10000mm x 8000mm, Padding: 200mm each side, Tables: 700mm diameter',
    'Available space: width=9600mm (10000-400), height=7600mm (8000-400)',
    '3 columns x 4 rows = 12 tables',
    'Column X spacing: (9600 - 3*700) / 4 gaps = 1950mm',
    'Row Y spacing: (7600 - 4*700) / 5 gaps = 960mm',
    'Column X positions: 200+350=550, 2700, 4850',
    'Row Y positions: 200+350=550, 2210, 3870, 5530',
    'Return tables array with all 12 combinations of these X,Y coordinates.',
    ''
];

const newContent = [...before, ...newExample, ...after].join('\n');
fs.writeFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/api/ai/plan.ts', newContent, 'utf8');

console.log('Updated example!');
