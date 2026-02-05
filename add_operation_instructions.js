const fs = require('fs');

const content = fs.readFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/api/ai/plan.ts', 'utf8');
const lines = content.split('\n');

// Find the line with "**CRITICAL RULE FOR FURNITURE PLACEMENT:**"
for (let i = 145; i < 185; i++) {
    if (lines[i].includes('**CRITICAL RULE FOR FURNITURE PLACEMENT:**')) {
        // Add operation instructions before this line
        const operationInstructions = [
            '**DELETION OPERATIONS:**',
            'When user asks to delete items:',
            '- "delete this" / "remove selected" → operation: { type: \'delete\', deleteSelected: true }',
            '- "delete all tables" → Find all table assets, return operation: { type: \'delete\', assetIds: [...] }',
            '- "clear canvas" → operation: { type: \'delete\', deleteAll: true }',
            '',
            '**LAYER OPERATIONS:**',
            'When user asks to change layering:',
            '- "bring to front" → modifications: [{ assetId: \'...\', bringToFront: true }]',
            '- "send to back" → modifications: [{ assetId: \'...\', sendToBack: true }]',
            '- "move up one layer" → modifications: [{ assetId: \'...\', bringForward: true }]',
            '- "move down one layer" → modifications: [{ assetId: \'...\', sendBackward: true }]',
            '',
            '**ALIGNMENT OPERATIONS:**',
            'When user asks to align items:',
            '- "align all tables to the left" → operation: { type: \'align\', alignment: \'left\', assetIds: [...] }',
            '- "center these items" → operation: { type: \'align\', alignment: \'center\', assetIds: [...] }',
            '- "align to top" → operation: { type: \'align\', alignment: \'top\', assetIds: [...] }',
            '',
            '**DISTRIBUTION OPERATIONS:**',
            '- "distribute tables evenly horizontally" → operation: { type: \'distribute\', direction: \'horizontal\', assetIds: [...] }',
            '- "distribute vertically with 500mm spacing" → operation: { type: \'distribute\', direction: \'vertical\', spacing: 500, assetIds: [...] }',
            '',
            '**DUPLICATION OPERATIONS:**',
            '- "duplicate this table" → operation: { type: \'duplicate\', assetIds: [...], count: 1 }',
            '- "duplicate 3 times with 500mm offset" → operation: { type: \'duplicate\', count: 3, offsetX: 500, assetIds: [...] }',
            '',
            '**SELECTION OPERATIONS:**',
            '- "select all tables" → operation: { type: \'select\', criteria: { assetType: \'table\' } }',
            '- "select all red items" → operation: { type: \'select\', criteria: { color: \'#ff0000\' } }',
            '- "deselect all" → operation: { type: \'select\', deselectAll: true }',
            ''
        ];

        lines.splice(i, 0, ...operationInstructions);
        console.log(`Added operation instructions at line ${i}`);
        break;
    }
}

fs.writeFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/api/ai/plan.ts', lines.join('\n'), 'utf8');

console.log('✅ Added operation instructions!');
