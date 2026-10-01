import re

with open('components/editor/PropertiesSidebar.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

target = '''                  <input
                    type="number"
                    step="any"
                    min="0.001"
                    defaultValue={1}'''
replacement = '''                  <input
                    type="number"
                    defaultValue={1}'''
content = content.replace(target, replacement)

target2 = '''                    min={0.001}
                    step={0.1}
                    placeholder="Set All"
                  />'''
replacement2 = '''                    min={0.001}
                    step="any"
                    placeholder="Set All"
                  />'''
content = content.replace(target2, replacement2)

with open('components/editor/PropertiesSidebar.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
