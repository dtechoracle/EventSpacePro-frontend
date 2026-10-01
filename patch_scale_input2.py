import re

with open('components/editor/PropertiesSidebar.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

target = '''                      <span className="text-xs text-gray-500">Scale</span>
                      <input
                        type="number"
                        value={localScale !== undefined ? localScale : ((selectedItem as any).scale ?? 1)}'''

replacement = '''                      <span className="text-xs text-gray-500">Scale</span>
                      <input
                        type="number"
                        step="any"
                        min="0.001"
                        value={localScale !== undefined ? localScale : ((selectedItem as any).scale ?? 1)}'''

if target in content:
    content = content.replace(target, replacement)
    with open('components/editor/PropertiesSidebar.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Success")
else:
    print("Failed")
