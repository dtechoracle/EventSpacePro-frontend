with open('pages/dashboard/editor/[slug]/[id].tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

insert_idx = -1
for i, l in enumerate(lines):
    if 'const rowProps =' in l:
        insert_idx = i
        break

handleToggleLockCode = """  const handleToggleLock = React.useCallback((id: string, currentlyLocked: boolean, type: string) => {
    const store = useProjectStore.getState();
    const updates = { locked: !currentlyLocked };

    if (type === "Wall") store.updateWall(id, updates as any);
    else if (type === "Shape") store.updateShape(id, updates as any);
    else if (type === "Asset") store.updateAsset(id, updates as any);
    else if (type === "Text") store.updateTextAnnotation(id, updates as any);
    else if (type === "Dimension") store.updateDimension(id, updates as any);
    else if (type === "LabelArrow") store.updateLabelArrow(id, updates as any);
    else if (type === "Group") store.updateGroup(id, updates as any);
  }, []);\n\n"""

if insert_idx != -1:
    lines.insert(insert_idx, handleToggleLockCode)
    with open('pages/dashboard/editor/[slug]/[id].tsx', 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print("Inserted handleToggleLock")
else:
    print("Failed to find rowProps")
