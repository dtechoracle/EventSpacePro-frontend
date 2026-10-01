import re

with open('components/editor/PropertiesSidebar.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace flipSelectionX
target_x = '''    if (ids.length === 1) {
      const id = ids[0];
      const s = shapes.find(sh => sh.id === id);
      if (s) updateShape(id, { flipX: !(s as any).flipX });
      const a = assets.find(as => as.id === id);
      if (a) {
        updateAsset(id, { flipX: !(a as any).flipX });
        updateSceneAsset(id, { flipX: !(a as any).flipX });
      }
      return;
    }'''

replacement_x = '''    if (ids.length === 1) {
      const id = ids[0];
      const s = shapes.find(sh => sh.id === id);
      if (s) updateShape(id, { flipX: !(s as any).flipX, rotation: -(s.rotation || 0) });
      const a = assets.find(as => as.id === id);
      if (a) {
        updateAsset(id, { flipX: !(a as any).flipX, rotation: -(a.rotation || 0) });
        updateSceneAsset(id, { flipX: !(a as any).flipX, rotation: -(a.rotation || 0) });
      }
      return;
    }'''

content = content.replace(target_x, replacement_x)

target_x_group = '''    targetShapes.forEach(s => {
      const newX = 2 * groupCenterX - s.x;
      updateShape(s.id, { x: newX, flipX: !(s as any).flipX });
    });
    targetAssets.forEach(a => {
      const newX = 2 * groupCenterX - a.x;
      updateAsset(a.id, { x: newX, flipX: !(a as any).flipX });
      updateSceneAsset(a.id, { x: newX, flipX: !(a as any).flipX });
    });'''

replacement_x_group = '''    targetShapes.forEach(s => {
      const newX = 2 * groupCenterX - s.x;
      updateShape(s.id, { x: newX, flipX: !(s as any).flipX, rotation: -(s.rotation || 0) });
    });
    targetAssets.forEach(a => {
      const newX = 2 * groupCenterX - a.x;
      updateAsset(a.id, { x: newX, flipX: !(a as any).flipX, rotation: -(a.rotation || 0) });
      updateSceneAsset(a.id, { x: newX, flipX: !(a as any).flipX, rotation: -(a.rotation || 0) });
    });'''

content = content.replace(target_x_group, replacement_x_group)


# Replace flipSelectionY
target_y = '''    if (ids.length === 1) {
      const id = ids[0];
      const s = shapes.find(sh => sh.id === id);
      if (s) updateShape(id, { flipY: !(s as any).flipY });
      const a = assets.find(as => as.id === id);
      if (a) {
        updateAsset(id, { flipY: !(a as any).flipY });
        updateSceneAsset(id, { flipY: !(a as any).flipY });
      }
      return;
    }'''

replacement_y = '''    if (ids.length === 1) {
      const id = ids[0];
      const s = shapes.find(sh => sh.id === id);
      if (s) updateShape(id, { flipY: !(s as any).flipY, rotation: -(s.rotation || 0) });
      const a = assets.find(as => as.id === id);
      if (a) {
        updateAsset(id, { flipY: !(a as any).flipY, rotation: -(a.rotation || 0) });
        updateSceneAsset(id, { flipY: !(a as any).flipY, rotation: -(a.rotation || 0) });
      }
      return;
    }'''

content = content.replace(target_y, replacement_y)

target_y_group = '''    targetShapes.forEach(s => {
      const newY = 2 * groupCenterY - s.y;
      updateShape(s.id, { y: newY, flipY: !(s as any).flipY });
    });
    targetAssets.forEach(a => {
      const newY = 2 * groupCenterY - a.y;
      updateAsset(a.id, { y: newY, flipY: !(a as any).flipY });
      updateSceneAsset(a.id, { y: newY, flipY: !(a as any).flipY });
    });'''

replacement_y_group = '''    targetShapes.forEach(s => {
      const newY = 2 * groupCenterY - s.y;
      updateShape(s.id, { y: newY, flipY: !(s as any).flipY, rotation: -(s.rotation || 0) });
    });
    targetAssets.forEach(a => {
      const newY = 2 * groupCenterY - a.y;
      updateAsset(a.id, { y: newY, flipY: !(a as any).flipY, rotation: -(a.rotation || 0) });
      updateSceneAsset(a.id, { y: newY, flipY: !(a as any).flipY, rotation: -(a.rotation || 0) });
    });'''

content = content.replace(target_y_group, replacement_y_group)

with open('components/editor/PropertiesSidebar.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Success")
