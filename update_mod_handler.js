const fs = require('fs');

const content = fs.readFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/(components)/AiTrigger.tsx', 'utf8');
let lines = content.split('\n');

// Find the modifications handler section
let startIdx = -1;
for (let i = 595; i < 605; i++) {
    if (lines[i].includes('// Modifications - update existing assets')) {
        startIdx = i;
        break;
    }
}

if (startIdx === -1) {
    console.log('Could not find modifications handler');
    process.exit(1);
}

// Find the end of the modifications section (the closing brace after the setMessages call)
let endIdx = startIdx;
let braceCount = 0;
for (let i = startIdx; i < startIdx + 30; i++) {
    if (lines[i].includes('if (Array.isArray(plan.modifications)')) {
        braceCount = 1;
    } else if (braceCount > 0) {
        if (lines[i].includes('{')) braceCount++;
        if (lines[i].includes('}')) braceCount--;
        if (braceCount === 0) {
            endIdx = i;
            break;
        }
    }
}

console.log(`Replacing lines ${startIdx} to ${endIdx}`);

// Replace with new handler
const newHandler = [
    '    // Modifications - update existing assets and walls',
    '    if (Array.isArray(plan.modifications) && plan.modifications.length > 0) {',
    '      let assetCount = 0;',
    '      let wallCount = 0;',
    '      ',
    '      plan.modifications.forEach((mod: any) => {',
    '        if (mod.wallId) {',
    '          // Wall modification',
    '          const wallUpdates: any = {};',
    '          if (mod.wallThickness !== undefined) wallUpdates.thickness = mod.wallThickness;',
    '          if (mod.wallType !== undefined) wallUpdates.wallType = mod.wallType;',
    '          if (mod.wallWidth !== undefined) wallUpdates.width = mod.wallWidth;',
    '          if (mod.wallHeight !== undefined) wallUpdates.height = mod.wallHeight;',
    '          if (mod.wallFillColor !== undefined) wallUpdates.fillColor = mod.wallFillColor;',
    '          if (mod.wallStrokeColor !== undefined) wallUpdates.strokeColor = mod.wallStrokeColor;',
    '          ',
    '          if (Object.keys(wallUpdates).length > 0) {',
    '            updateProjectWall(mod.wallId, wallUpdates);',
    '            wallCount++;',
    '          }',
    '        } else if (mod.assetId) {',
    '          // Asset modification',
    '          const updates: any = {};',
    '          if (mod.xMm !== undefined) updates.x = mod.xMm;',
    '          if (mod.yMm !== undefined) updates.y = mod.yMm;',
    '          if (mod.widthMm !== undefined) updates.width = mod.widthMm;',
    '          if (mod.heightMm !== undefined) updates.height = mod.heightMm;',
    '          if (mod.rotation !== undefined) updates.rotation = mod.rotation;',
    '          if (mod.scale !== undefined) updates.scale = mod.scale;',
    '          if (mod.fillColor !== undefined) updates.fillColor = mod.fillColor;',
    '          if (mod.strokeColor !== undefined) updates.strokeColor = mod.strokeColor;',
    '          ',
    '          if (Object.keys(updates).length > 0) {',
    '            updateWorkspaceAsset(mod.assetId, updates);',
    '            assetCount++;',
    '          }',
    '        }',
    '      });',
    '      ',
    '      const message = [];',
    '      if (assetCount > 0) message.push(`${assetCount} asset${assetCount > 1 ? \'s\' : \'\'}` );',
    '      if (wallCount > 0) message.push(`${wallCount} wall${wallCount > 1 ? \'s\' : \'\'}` );',
    '      ',
    '      setMessages((m) => [...m, { ',
    '        role: \'assistant\', ',
    '        content: `✅ Updated ${message.join(\' and \')}` ',
    '      }]);',
    '    }'
];

lines.splice(startIdx, endIdx - startIdx + 1, ...newHandler);

fs.writeFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/(components)/AiTrigger.tsx', lines.join('\n'), 'utf8');

console.log('✅ Updated modifications handler!');
