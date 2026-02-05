const fs = require('fs');

const content = fs.readFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/api/ai/plan.ts', 'utf8');
const lines = content.split('\n');

// Find the line with "**CRITICAL RULE FOR FURNITURE PLACEMENT:**"
for (let i = 145; i < 165; i++) {
    if (lines[i].includes('**CRITICAL RULE FOR FURNITURE PLACEMENT:**')) {
        // Add wall modification instructions before this line
        const wallInstructions = [
            '**WALL MODIFICATIONS:**',
            'When user asks to modify walls (e.g., "change wall thickness to 150mm", "make wall 8m x 6m"):',
            '- Return a plan with modifications array',
            '- Include wallId from selectedAssets (walls can be selected like assets)',
            '- Supported modifications:',
            '  - wallThickness: Change thickness in mm (75, 100, 150, 225)',
            '  - wallType: Change type ("75mm Stud Wall", "100mm Brick Wall", "150mm Concrete Wall", "225mm Cavity Wall")',
            '  - wallWidth/wallHeight: Change dimensions in mm',
            '  - wallFillColor/wallStrokeColor: Change colors (hex format)',
            '- Example: "change wall thickness to 150mm" → modifications: [{wallId: "id-from-selectedAssets", wallThickness: 150}]',
            ''
        ];

        lines.splice(i, 0, ...wallInstructions);
        console.log(`Added wall modification instructions at line ${i}`);
        break;
    }
}

fs.writeFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/api/ai/plan.ts', lines.join('\n'), 'utf8');

console.log('✅ Added wall modification instructions!');
