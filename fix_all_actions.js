const fs = require('fs');

const content = fs.readFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/(components)/AiTrigger.tsx', 'utf8');

// Replace all updateAsset calls in the action handlers with source-aware calls
let newContent = content;

// Helper function to create source-aware update
const createUpdate = (updates) => `
              if (source === 'project-asset') {
                updateWorkspaceAsset(asset.id, ${updates});
              } else if (source === 'project-shape') {
                updateWorkspaceShape(asset.id, ${updates});
              } else {
                updateAsset(asset.id, ${updates});
              }`;

// Fix move action
newContent = newContent.replace(
    /} else if \(data\.action\.type === 'move'\) \{[\s\S]*?updateAsset\(asset\.id, \{[\s\S]*?\}\);/,
    `} else if (data.action.type === 'move') {
              const dx = data.action.dx ?? 0;
              const dy = data.action.dy ?? 0;
              const updates = {
                x: data.action.x !== undefined ? data.action.x : asset.x + dx,
                y: data.action.y !== undefined ? data.action.y : asset.y + dy,
              };
              if (source === 'project-asset') {
                updateWorkspaceAsset(asset.id, updates);
              } else if (source === 'project-shape') {
                updateWorkspaceShape(asset.id, updates);
              } else {
                updateAsset(asset.id, updates);
              }`
);

// Fix rotate action
newContent = newContent.replace(
    /} else if \(data\.action\.type === 'rotate'\) \{[\s\S]*?updateAsset\(asset\.id, \{[\s\S]*?\}\);/,
    `} else if (data.action.type === 'rotate') {
              const delta = data.action.deltaRotation ?? 0;
              const updates = {
                rotation: data.action.rotation !== undefined ? data.action.rotation : (asset.rotation || 0) + delta,
              };
              if (source === 'project-asset') {
                updateWorkspaceAsset(asset.id, updates);
              } else if (source === 'project-shape') {
                updateWorkspaceShape(asset.id, updates);
              } else {
                updateAsset(asset.id, updates);
              }`
);

// Fix update action
newContent = newContent.replace(
    /} else if \(data\.action\.type === 'update'\) \{[\s\S]*?updateAsset\(asset\.id, updates\);/,
    `} else if (data.action.type === 'update') {
              const rawUpdates = data.action.updates || {};
              const updates: any = { ...rawUpdates };
              // Normalize color props
              if (rawUpdates.fillColor && !rawUpdates.fill) {
                updates.fill = rawUpdates.fillColor;
              }
              if (rawUpdates.backgroundColor && !updates.fill && !rawUpdates.fill) {
                updates.fill = rawUpdates.backgroundColor;
              }
              if (rawUpdates.strokeColor && !rawUpdates.stroke) {
                updates.stroke = rawUpdates.strokeColor;
              }
              if (source === 'project-asset') {
                updateWorkspaceAsset(asset.id, updates);
              } else if (source === 'project-shape') {
                updateWorkspaceShape(asset.id, updates);
              } else {
                updateAsset(asset.id, updates);
              }`
);

fs.writeFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/(components)/AiTrigger.tsx', newContent, 'utf8');

console.log('✅ Fixed all action handlers to use correct update functions!');
