const fs = require('fs');

const content = fs.readFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/(components)/AiTrigger.tsx', 'utf8');
const lines = content.split('\n');

// Find where annotations section ends (look for the closing of applyPlan function)
const annotationsIndex = lines.findIndex(l => l.includes('// Annotations'));
let closingIndex = -1;
for (let i = annotationsIndex; i < lines.length; i++) {
    if (lines[i].trim() === '};' && lines[i - 1].includes('}')) {
        closingIndex = i;
        break;
    }
}

if (closingIndex === -1) {
    console.log('Could not find closing of applyPlan function');
    process.exit(1);
}

const before = lines.slice(0, closingIndex);
const after = lines.slice(closingIndex);

const modificationsCode = [
    '',
    '    // Modifications - apply changes to selected assets',
    '    if (Array.isArray(plan.modifications)) {',
    '      plan.modifications.forEach((mod: any) => {',
    '        const asset = workspaceAssets.find((a: any) => a.id === mod.assetId);',
    '        if (asset) {',
    '          const updates: any = {};',
    '          if (mod.widthMm !== undefined) updates.width = mod.widthMm;',
    '          if (mod.heightMm !== undefined) updates.height = mod.heightMm;',
    '          if (mod.rotation !== undefined) updates.rotation = mod.rotation;',
    '          if (mod.xMm !== undefined) updates.x = mod.xMm;',
    '          if (mod.yMm !== undefined) updates.y = mod.yMm;',
    '          if (mod.fillColor !== undefined) updates.fillColor = mod.fillColor;',
    '          if (mod.strokeColor !== undefined) updates.strokeColor = mod.strokeColor;',
    '          if (mod.scale !== undefined && asset.width && asset.height) {',
    '            updates.width = asset.width * mod.scale;',
    '            updates.height = asset.height * mod.scale;',
    '          }',
    '          updateWorkspaceAsset(mod.assetId, updates);',
    '        }',
    '      });',
    '    }'
];

const newContent = [...before, ...modificationsCode, ...after].join('\n');
fs.writeFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/(components)/AiTrigger.tsx', newContent, 'utf8');

console.log('Added modifications handling to AiTrigger!');
