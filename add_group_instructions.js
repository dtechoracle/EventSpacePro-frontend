const fs = require('fs');

const content = fs.readFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/api/ai/plan.ts', 'utf8');
const lines = content.split('\n');

// Find the line with "**CRITICAL RULE FOR FURNITURE PLACEMENT:**"
for (let i = 145; i < 175; i++) {
    if (lines[i].includes('**CRITICAL RULE FOR FURNITURE PLACEMENT:**')) {
        // Add group operation instructions before this line
        const groupInstructions = [
            '**GROUP OPERATIONS:**',
            'When user has a group selected (check selectedAssets for isGroup: true) and asks to modify it:',
            '- "rotate the first table in the group 45 degrees" → Find the first table in groupAssets, return modification for that specific assetId',
            '- "move the entire group to center" → Return modification for the groupId itself with new xMm/yMm',
            '- "make all tables in the group red" → Return modifications for each assetId in groupAssets with fillColor',
            '- "resize the second item in the group to 2000mm" → Find second item in groupAssets, return modification with widthMm/heightMm',
            '- The groupAssets array contains all items in the group with their IDs',
            '- You can modify individual items OR the entire group',
            ''
        ];

        lines.splice(i, 0, ...groupInstructions);
        console.log(`Added group operation instructions at line ${i}`);
        break;
    }
}

fs.writeFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/api/ai/plan.ts', lines.join('\n'), 'utf8');

console.log('✅ Added group operation instructions!');
