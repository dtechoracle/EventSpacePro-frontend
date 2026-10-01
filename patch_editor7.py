with open('pages/dashboard/editor/[slug]/[id].tsx', 'r', encoding='utf-8') as f:
    content = f.read()

target = """  const handleToggleHide = React.useCallback((id: string, hidden: boolean, type: string) => {
    if (type === "Asset") {
      updateAsset(id, { hidden: !hidden });
      updateSceneAsset(id, { hidden: !hidden });
    } else {
      updateShape(id, { hidden: !hidden } as any);
    }
  }, [updateAsset, updateSceneAsset, updateShape]);"""

replacement = """  const handleToggleHide = React.useCallback((id: string, hidden: boolean, type: string) => {
    if (type === "Asset") {
      updateAsset(id, { hidden: !hidden });
      updateSceneAsset(id, { hidden: !hidden });
    } else {
      updateShape(id, { hidden: !hidden } as any);
    }
  }, [updateAsset, updateSceneAsset, updateShape]);

  const handleToggleLock = React.useCallback((id: string, locked: boolean, type: string) => {
    if (type === "Asset") {
      updateAsset(id, { locked: !locked } as any);
      updateSceneAsset(id, { locked: !locked } as any);
    } else {
      updateShape(id, { locked: !locked } as any);
    }
  }, [updateAsset, updateSceneAsset, updateShape]);"""

content = content.replace(target, replacement)

with open('pages/dashboard/editor/[slug]/[id].tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
