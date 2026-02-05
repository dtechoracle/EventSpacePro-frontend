const fs = require('fs');

const content = fs.readFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/(components)/AiTrigger.tsx', 'utf8');
const lines = content.split('\n');

// Find the modifications section (around line 820)
const startIdx = lines.findIndex(l => l.includes('// Modifications - apply changes to selected assets or shapes'));
if (startIdx === -1) {
    console.log('Could not find modifications section');
    process.exit(1);
}

// Find the end of the modifications section
let endIdx = startIdx;
for (let i = startIdx; i < lines.length; i++) {
    if (lines[i].trim() === '};' && lines[i - 1].includes('});')) {
        endIdx = i;
        break;
    }
}

const newCode = `
    // Modifications - apply changes to selected assets or shapes
    if (Array.isArray(plan.modifications)) {
      plan.modifications.forEach((mod: any) => {
        const asset = workspaceAssets.find((a: any) => a.id === mod.assetId);
        const shape = !asset ? workspaceShapes.find((s: any) => s.id === mod.assetId) : null;
        
        if (asset) {
          // For assets: update scale property (assets render as width*scale x height*scale)
          const updates: any = {};
          if (mod.widthMm !== undefined && mod.heightMm !== undefined) {
            const scaleX = mod.widthMm / asset.width;
            const scaleY = mod.heightMm / asset.height;
            updates.scale = (scaleX + scaleY) / 2;
          } else if (mod.scale !== undefined) {
            updates.scale = (asset.scale || 1) * mod.scale;
          }
          if (mod.rotation !== undefined) updates.rotation = mod.rotation;
          if (mod.xMm !== undefined) updates.x = mod.xMm;
          if (mod.yMm !== undefined) updates.y = mod.yMm;
          if (mod.fillColor !== undefined) updates.fillColor = mod.fillColor;
          if (mod.strokeColor !== undefined) updates.strokeColor = mod.strokeColor;
          updateWorkspaceAsset(mod.assetId, updates);
        } else if (shape) {
          // For shapes: update width/height directly
          const updates: any = {};
          if (mod.widthMm !== undefined) updates.width = mod.widthMm;
          if (mod.heightMm !== undefined) updates.height = mod.heightMm;
          if (mod.scale !== undefined) {
            updates.width = shape.width * mod.scale;
            updates.height = shape.height * mod.scale;
          }
          if (mod.rotation !== undefined) updates.rotation = mod.rotation;
          if (mod.xMm !== undefined) updates.x = mod.xMm;
          if (mod.yMm !== undefined) updates.y = mod.yMm;
          if (mod.fillColor !== undefined) updates.fill = mod.fillColor;
          if (mod.strokeColor !== undefined) updates.stroke = mod.strokeColor;
          updateWorkspaceShape(mod.assetId, updates);
        }
      });
    }
  };`;

const before = lines.slice(0, startIdx);
const after = lines.slice(endIdx + 1);

const newContent = [...before, ...newCode.split('\n'), ...after].join('\n');
fs.writeFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/(components)/AiTrigger.tsx', newContent, 'utf8');

console.log('✅ Fixed asset modification to use scale property!');
