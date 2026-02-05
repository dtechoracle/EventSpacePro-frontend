const fs = require('fs');

const content = fs.readFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/(components)/AiTrigger.tsx', 'utf8');
let lines = content.split('\n');

// 1. Add setEditorSelectedIds hook
let hookIdx = -1;
for (let i = 0; i < 50; i++) {
    if (lines[i].includes('const editorSelectedIds = useEditorStore((s) => s.selectedIds);')) {
        hookIdx = i + 1;
        break;
    }
}

if (hookIdx !== -1) {
    if (!lines[hookIdx].includes('setSelectedIds')) {
        lines.splice(hookIdx, 0, '  const setEditorSelectedIds = useEditorStore((s) => s.setSelectedIds);');
        console.log('✅ Added setEditorSelectedIds hook');
    }
} else {
    console.log('⚠️ Could not find editorSelectedIds hook');
}

// 2. Add Duplication and Selection Handlers
let distBlockEndIdx = -1;
// Find the end of the distribution block we added (look for the loop end or the opMessage line)
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('opMessage = `Distributed ${targetAssets.length} items ${op.direction}`;')) {
        // Find where the block closes. It should be inside the `if (targetAssets.length > 1)` block
        // We want to insert AFTER the distribution block's closing brace
        // The structure is:
        // ...
        //   opMessage = ...
        // } <--- End of if (targetAssets.length > 1)

        // Let's verify context.
        // lines[i] is opMessage assignment
        // lines[i+1] should be '         }'
        distBlockEndIdx = i + 2;
        break;
    }
}

if (distBlockEndIdx !== -1) {
    const remainingHandlers = [
        '',
        '       // 4. Duplication',
        '       else if (op.type === "duplicate" && op.count && op.count > 0 && op.assetIds) {',
        '         const targetAssets = workspaceAssets.filter(a => op.assetIds.includes(a.id));',
        '         let createdCount = 0;',
        '         targetAssets.forEach(original => {',
        '           for (let i = 0; i < (op.count || 1); i++) {',
        '             const newAsset = { ...original };',
        '             newAsset.id = crypto.randomUUID();',
        '             newAsset.x += (op.offsetX || 500) * (i + 1);',
        '             newAsset.y += (op.offsetY || 0) * (i + 1);',
        '             addProjectAsset(newAsset);',
        '             createdCount++;',
        '           }',
        '         });',
        '         opMessage = `Duplicated ${targetAssets.length} items ${op.count} times`;',
        '       }',
        '',
        '       // 5. Selection',
        '       else if (op.type === "select") {',
        '         if (op.deselectAll) {',
        '           setEditorSelectedIds([]);',
        '           opMessage = "Deselected all items";',
        '         } else if (op.selectAll) {',
        '           setEditorSelectedIds(workspaceAssets.map(a => a.id));',
        '           opMessage = `Selected all ${workspaceAssets.length} items`;',
        '         } else if (op.criteria) {',
        '            const criteria = op.criteria;',
        '            const toSelect = workspaceAssets.filter(a => {',
        '              let match = true;',
        '              if (criteria.assetType && !a.assetName?.toLowerCase().includes(criteria.assetType.toLowerCase())) match = false;',
        '              if (criteria.color && a.fillColor !== criteria.color) match = false;',
        '              return match;',
        '            }).map(a => a.id);',
        '            setEditorSelectedIds(toSelect);',
        '            opMessage = `Selected ${toSelect.length} items matching criteria`;',
        '         }',
        '       }'
    ];
    lines.splice(distBlockEndIdx, 0, ...remainingHandlers);
    console.log('✅ Added Duplication and Selection handlers');
} else {
    // Fallback search if exact line match fails (maybe spacing diff)
    console.log('⚠️ Could not find Distribution block end to insert remaining handlers');
    // Try simpler search for "opMessage = `Distributed"
}

fs.writeFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/(components)/AiTrigger.tsx', lines.join('\n'), 'utf8');
