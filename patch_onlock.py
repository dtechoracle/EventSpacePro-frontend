import re

with open('pages/dashboard/editor/[slug]/[id].tsx', 'r', encoding='utf-8') as f:
    content = f.read()

target = '''  onSelect,
  onToggleExpand,
  onHide,
  onStartRename,'''

replacement = '''  onSelect,
  onToggleExpand,
  onHide,
  onLock,
  onStartRename,'''

content = content.replace(target, replacement)

with open('pages/dashboard/editor/[slug]/[id].tsx', 'w', encoding='utf-8') as f:
    f.write(content)
