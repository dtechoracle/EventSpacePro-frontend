import re

with open('components/editor/PropertiesSidebar.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

target = '''                {/* Scale for Multi-Selection */}
                <div className="flex justify-between items-center mb-2 mt-2 pt-2 border-t border-gray-100">
                  <span className="text-xs text-gray-500">Scale</span>
                  <input
                    type="number"
                    defaultValue={1}'''

replacement = '''                {/* Scale for Multi-Selection */}
                <div className="flex justify-between items-center mb-2 mt-2 pt-2 border-t border-gray-100">
                  <span className="text-xs text-gray-500">Scale</span>
                  <input
                    type="number"
                    step="any"
                    min="0.001"
                    defaultValue={1}'''

if target in content:
    content = content.replace(target, replacement)
    with open('components/editor/PropertiesSidebar.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Success")
else:
    print("Failed")
