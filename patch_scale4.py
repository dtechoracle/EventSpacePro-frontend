import re

with open('components/editor/PropertiesSidebar.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

target1 = '''                      <span className="text-xs text-gray-500">Scale</span>
                      <input
                        type="number"
                        step="any"
                        min="0.001"
                        value={localScale !== undefined ? localScale : ((selectedItem as any).scale ?? 1)}'''

replacement1 = '''                      <span className="text-xs text-gray-500">Scale</span>
                      <input
                        type="number"
                        value={localScale !== undefined ? localScale : ((selectedItem as any).scale ?? 1)}'''

content = content.replace(target1, replacement1)

target2 = '''                        className={sidebar-input w-16 text-center }
                        min={0.001}
                        step={0.1}
                      />'''

replacement2 = '''                        className={sidebar-input w-16 text-center }
                        min={0.001}
                        step="any"
                      />'''

content = content.replace(target2, replacement2)

with open('components/editor/PropertiesSidebar.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Success")
