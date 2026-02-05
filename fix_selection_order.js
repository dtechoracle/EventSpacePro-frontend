const fs = require('fs');

const content = fs.readFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/(components)/AiTrigger.tsx', 'utf8');
const lines = content.split('\n');

// Find the baseIds.forEach line
const forEachIdx = lines.findIndex(l => l.includes('baseIds.forEach((id) => {'));
if (forEachIdx === -1) {
    console.log('Could not find baseIds.forEach');
    process.exit(1);
}

// Find the end of the shapes check (before walls check)
const wallCheckIdx = lines.findIndex((l, i) => i > forEachIdx && l.includes('// 4) Workspace2D walls'));
if (wallCheckIdx === -1) {
    console.log('Could not find walls check');
    process.exit(1);
}

// Replace the section between forEach and walls check
const before = lines.slice(0, forEachIdx + 1);
const after = lines.slice(wallCheckIdx);

const newCode = `      // 1) Workspace2D assets (check FIRST before scene)
      const projAsset = workspaceAssets.find((a: ProjectAsset) => a.id === id);
      if (projAsset) {
        const aiAsset: AssetInstance = {
          id: projAsset.id,
          type: projAsset.type,
          x: projAsset.x,
          y: projAsset.y,
          width: projAsset.width,
          height: projAsset.height,
          rotation: projAsset.rotation,
          scale: projAsset.scale,
          zIndex: projAsset.zIndex,
        };
        results.push({ asset: aiAsset, source: "project-asset" });
        return;
      }

      // 2) Workspace2D shapes
      const shape = workspaceShapes.find((s: Shape) => s.id === id);
      if (shape) {
        const aiAsset: AssetInstance = {
          id: shape.id,
          type: shape.type,
          x: shape.x,
          y: shape.y,
          width: shape.width,
          height: shape.height,
          rotation: shape.rotation,
          scale: 1,
          zIndex: shape.zIndex,
          fillColor: shape.fill,
          strokeColor: shape.stroke,
          strokeWidth: shape.strokeWidth,
        };
        results.push({ asset: aiAsset, source: "project-shape" });
        return;
      }

      // 3) Scene assets (check LAST)
      const sceneAsset = existingAssets.find((a) => a.id === id);
      if (sceneAsset) {
        results.push({ asset: sceneAsset, source: "scene" });
        return;
      }

`;

const newContent = [...before, ...newCode.split('\n'), ...after].join('\n');
fs.writeFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/(components)/AiTrigger.tsx', newContent, 'utf8');

console.log('✅ Fixed selection order - workspace assets now checked first!');
