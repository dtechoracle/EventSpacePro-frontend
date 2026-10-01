with open('pages/dashboard/editor/[slug]/[id].tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add to ElementRow destructuring
target1 = """  onToggleExpand,
  onHide,
  onStartRename,"""
replacement1 = """  onToggleExpand,
  onHide,
  onLock,
  onStartRename,"""
content = content.replace(target1, replacement1)

# Add to rowProps
target2 = """      onToggleExpand: handleToggleExpand,
      onHide: handleToggleHide,
      onStartRename: handleStartRename,"""
replacement2 = """      onToggleExpand: handleToggleExpand,
      onHide: handleToggleHide,
      onLock: handleToggleLock,
      onStartRename: handleStartRename,"""
content = content.replace(target2, replacement2)

with open('pages/dashboard/editor/[slug]/[id].tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
