with open('pages/dashboard/editor/[slug]/[id].tsx', 'r', encoding='utf-8') as f:
    content = f.read()

target = """  const handleToggleHide = React.useCallback((id: string, currentlyHidden: boolean, type: string) => {
    const store = useProjectStore.getState();
    const updates = { hidden: !currentlyHidden };

    if (type === "Wall") store.updateWall(id, updates);
    else if (type === "Shape") store.updateShape(id, updates);
    else if (type === "Asset") store.updateAsset(id, updates);
    else if (type === "Text") store.updateTextAnnotation(id, updates);
    else if (type === "Dimension") store.updateDimension(id, updates);
    else if (type === "LabelArrow") store.updateLabelArrow(id, updates);
    else if (type === "Group") store.updateGroup(id, updates);
  }, []);"""

replacement = """  const handleToggleHide = React.useCallback((id: string, currentlyHidden: boolean, type: string) => {
    const store = useProjectStore.getState();
    const updates = { hidden: !currentlyHidden };

    if (type === "Wall") store.updateWall(id, updates);
    else if (type === "Shape") store.updateShape(id, updates);
    else if (type === "Asset") store.updateAsset(id, updates);
    else if (type === "Text") store.updateTextAnnotation(id, updates);
    else if (type === "Dimension") store.updateDimension(id, updates);
    else if (type === "LabelArrow") store.updateLabelArrow(id, updates);
    else if (type === "Group") store.updateGroup(id, updates);
  }, []);

  const handleToggleLock = React.useCallback((id: string, currentlyLocked: boolean, type: string) => {
    const store = useProjectStore.getState();
    const updates = { locked: !currentlyLocked };

    if (type === "Wall") store.updateWall(id, updates as any);
    else if (type === "Shape") store.updateShape(id, updates as any);
    else if (type === "Asset") store.updateAsset(id, updates as any);
    else if (type === "Text") store.updateTextAnnotation(id, updates as any);
    else if (type === "Dimension") store.updateDimension(id, updates as any);
    else if (type === "LabelArrow") store.updateLabelArrow(id, updates as any);
    else if (type === "Group") store.updateGroup(id, updates as any);
  }, []);"""

content = content.replace(target, replacement)
with open('pages/dashboard/editor/[slug]/[id].tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
