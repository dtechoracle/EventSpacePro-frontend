import re

with open('pages/dashboard/editor/[slug]/[id].tsx', 'r', encoding='utf-8') as f:
    content = f.read()

target = '''  onHide: (id: string, hidden: boolean, type: string) => void;
  onStartRename: (id: string, label: string) => void;'''
replacement = '''  onHide: (id: string, hidden: boolean, type: string) => void;
  onLock: (id: string, locked: boolean, type: string) => void;
  onStartRename: (id: string, label: string) => void;'''
content = content.replace(target, replacement)

with open('pages/dashboard/editor/[slug]/[id].tsx', 'w', encoding='utf-8') as f:
    f.write(content)
