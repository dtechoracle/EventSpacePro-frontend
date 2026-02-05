const fs = require('fs');

const content = fs.readFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/(components)/AiTrigger.tsx', 'utf8');
let lines = content.split('\n');

// Find the Alignment placeholder section
let alignStartIdx = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('// Align logic would typically calculate bounds here')) {
        alignStartIdx = i;
        break;
    }
}

if (alignStartIdx !== -1) {
    // Find the end of the alignment placeholder block
    let alignEndIdx = -1;
    for (let i = alignStartIdx; i < lines.length; i++) {
        if (lines[i].includes('// We will emit a message for now as placeholder for logic implementation')) {
            alignEndIdx = i;
            break;
        }
    }

    if (alignEndIdx !== -1) {
        const alignLogic = [
            '         // Concrete Alignment Logic',
            '         const targetAssets = workspaceAssets.filter(a => op.assetIds.includes(a.id));',
            '         if (targetAssets.length > 0) {',
            '           let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;',
            '           targetAssets.forEach(a => {',
            '             minX = Math.min(minX, a.x);',
            '             minY = Math.min(minY, a.y);',
            '             maxX = Math.max(maxX, a.x + a.width);',
            '             maxY = Math.max(maxY, a.y + a.height);',
            '           });',
            '           const midX = minX + (maxX - minX) / 2;',
            '           const midY = minY + (maxY - minY) / 2;',
            '',
            '           targetAssets.forEach(a => {',
            '             const updates: any = {};',
            '             if (op.alignment === "left") updates.x = minX;',
            '             else if (op.alignment === "right") updates.x = maxX - a.width;',
            '             else if (op.alignment === "center") updates.x = midX - a.width / 2;',
            '             else if (op.alignment === "top") updates.y = minY;',
            '             else if (op.alignment === "bottom") updates.y = maxY - a.height;',
            '             else if (op.alignment === "middle") updates.y = midY - a.height / 2;',
            '',
            '             if (Object.keys(updates).length > 0) updateWorkspaceAsset(a.id, updates);',
            '           });',
            '           opMessage = `Aligned ${targetAssets.length} items to ${op.alignment}`;',
            '         } else {',
            '           opMessage = `Could not find selected assets to align`;',
            '         }'
        ];
        lines.splice(alignStartIdx, alignEndIdx - alignStartIdx + 1, ...alignLogic);
        console.log('✅ Replaced alignment logic');
    } else {
        console.log('⚠️ Could not find end of alignment placeholder');
    }
} else {
    console.log('⚠️ Could not find start of alignment placeholder');
}

// Find Distribution placeholder (simple message currently)
// Original: opMessage = `Distributed ${op.assetIds.length} items ${op.direction}`;
let distIdx = -1;
// Searching for the line from the previous script
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('opMessage = `Distributed ${op.assetIds.length} items ${op.direction}`;')) {
        distIdx = i;
        break;
    }
}

if (distIdx !== -1) {
    const distLogic = [
        '         // Concrete Distribution Logic',
        '         const targetAssets = workspaceAssets.filter(a => op.assetIds.includes(a.id));',
        '         if (targetAssets.length > 1) {',
        '           if (op.direction === "horizontal") {',
        '             // Sort by X',
        '             targetAssets.sort((a, b) => a.x - b.x);',
        '             const startX = targetAssets[0].x;',
        '             const endX = targetAssets[targetAssets.length - 1].x + targetAssets[targetAssets.length - 1].width;',
        '             const totalWidth = endX - startX;',
        '             const totalAssetWidth = targetAssets.reduce((sum, a) => sum + a.width, 0);',
        '             const gap = (totalWidth - totalAssetWidth) / (targetAssets.length - 1);',
        '',
        '             let currentX = startX;',
        '             targetAssets.forEach((a, idx) => {',
        '               if (idx > 0) { // First item stays put',
        '                 updateWorkspaceAsset(a.id, { x: currentX });',
        '               }',
        '               currentX += a.width + gap;',
        '             });',
        '           } else if (op.direction === "vertical") {',
        '             // Sort by Y',
        '             targetAssets.sort((a, b) => a.y - b.y);',
        '             const startY = targetAssets[0].y;',
        '             const endY = targetAssets[targetAssets.length - 1].y + targetAssets[targetAssets.length - 1].height;',
        '             const totalHeight = endY - startY;',
        '             const totalAssetHeight = targetAssets.reduce((sum, a) => sum + a.height, 0);',
        '             const gap = (totalHeight - totalAssetHeight) / (targetAssets.length - 1);',
        '',
        '             let currentY = startY;',
        '             targetAssets.forEach((a, idx) => {',
        '               if (idx > 0) {',
        '                 updateWorkspaceAsset(a.id, { y: currentY });',
        '               }',
        '               currentY += a.height + gap;',
        '             });',
        '           }',
        '           opMessage = `Distributed ${targetAssets.length} items ${op.direction}`;',
        '         }'
    ];
    lines.splice(distIdx, 1, ...distLogic);
    console.log('✅ Replaced distribution logic');
} else {
    // It might simply be that I need to find the specific block I added previously
    console.log('⚠️ Could not find distribution placeholder line');
}

fs.writeFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/(components)/AiTrigger.tsx', lines.join('\n'), 'utf8');
