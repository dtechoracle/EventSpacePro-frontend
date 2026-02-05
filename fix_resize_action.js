const fs = require('fs');

const content = fs.readFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/(components)/AiTrigger.tsx', 'utf8');
const lines = content.split('\n');

// Find the resize action handler
const startIdx = lines.findIndex(l => l.includes("if (data.action.type === 'resize')"));
if (startIdx === -1) {
    console.log('Could not find resize action handler');
    process.exit(1);
}

// Find the end of the resize block (next else if)
let endIdx = startIdx;
for (let i = startIdx + 1; i < lines.length; i++) {
    if (lines[i].includes("} else if (data.action.type === 'move')")) {
        endIdx = i - 1;
        break;
    }
}

const newCode = `            if (data.action.type === 'resize') {
              const scaleFactor = data.action.scaleFactor ?? 1;
              
              // For assets from projectStore, only update scale
              // For shapes, update width/height
              if (source === 'project-asset') {
                const nextScale = data.action.scale ?? (asset.scale || 1) * scaleFactor;
                updateWorkspaceAsset(asset.id, { scale: nextScale });
              } else if (source === 'project-shape') {
                const nextWidth = data.action.width ?? (asset.width || 0) * scaleFactor;
                const nextHeight = data.action.height ?? (asset.height || 0) * scaleFactor;
                updateWorkspaceShape(asset.id, { width: nextWidth, height: nextHeight });
              } else {
                // Scene assets
                const nextWidth = data.action.width ?? (asset.width || 0) * scaleFactor;
                const nextHeight = data.action.height ?? (asset.height || 0) * scaleFactor;
                const nextScale = data.action.scale ?? (asset.scale || 1) * scaleFactor;
                updateAsset(asset.id, { width: nextWidth, height: nextHeight, scale: nextScale });
              }`;

const before = lines.slice(0, startIdx);
const after = lines.slice(endIdx + 1);

const newContent = [...before, ...newCode.split('\n'), ...after].join('\n');
fs.writeFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/(components)/AiTrigger.tsx', newContent, 'utf8');

console.log('✅ Fixed resize action to use scale for assets!');
