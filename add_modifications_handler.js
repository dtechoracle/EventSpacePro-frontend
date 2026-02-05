const fs = require('fs');

const content = fs.readFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/(components)/AiTrigger.tsx', 'utf8');
const lines = content.split('\n');

// Find where assets processing ends (after the closing brace of the assets forEach)
for (let i = 590; i < 610; i++) {
    if (lines[i].includes('});') && lines[i + 1].trim() === '}' && lines[i - 1].includes('createdAssetsInBatch.push')) {
        // Add modifications handler after assets processing
        const modificationsCode = [
            '',
            '    // Modifications - update existing assets',
            '    if (Array.isArray(plan.modifications) && plan.modifications.length > 0) {',
            '      plan.modifications.forEach((mod: any) => {',
            '        const updates: any = {};',
            '        if (mod.xMm !== undefined) updates.x = mod.xMm;',
            '        if (mod.yMm !== undefined) updates.y = mod.yMm;',
            '        if (mod.widthMm !== undefined) updates.width = mod.widthMm;',
            '        if (mod.heightMm !== undefined) updates.height = mod.heightMm;',
            '        if (mod.rotation !== undefined) updates.rotation = mod.rotation;',
            '        if (mod.scale !== undefined) updates.scale = mod.scale;',
            '        if (mod.fillColor !== undefined) updates.fillColor = mod.fillColor;',
            '        if (mod.strokeColor !== undefined) updates.strokeColor = mod.strokeColor;',
            '        ',
            '        if (Object.keys(updates).length > 0) {',
            '          updateWorkspaceAsset(mod.assetId, updates);',
            '        }',
            '      });',
            '      ',
            '      setMessages((m) => [...m, { ',
            '        role: \'assistant\', ',
            '        content: `✅ Updated ${plan.modifications.length} assets` ',
            '      }]);',
            '    }',
            ''
        ];

        lines.splice(i + 2, 0, ...modificationsCode);
        console.log(`Added modifications handler after line ${i + 2}`);
        break;
    }
}

fs.writeFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/(components)/AiTrigger.tsx', lines.join('\n'), 'utf8');

console.log('✅ Added modifications handler!');
