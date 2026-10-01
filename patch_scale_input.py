import re

with open('components/editor/PropertiesSidebar.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

target = '''                      <div className="flex justify-between items-center mb-3 py-2 border-t border-gray-100">
                        <span className="text-xs text-gray-500">Scale</span>
                        <input
                          type="number"
                          value={localScale !== undefined ? localScale : ((selectedItem as any).scale ?? 1)}
                          disabled={isSelectedVenue}
                          onBlur={() => setLocalScale(undefined)}
                          onChange={(e) => {'''

replacement = '''                      <div className="flex justify-between items-center mb-3 py-2 border-t border-gray-100">
                        <span className="text-xs text-gray-500">Scale</span>
                        <input
                          type="number"
                          step="any"
                          min="0.01"
                          value={localScale !== undefined ? localScale : ((selectedItem as any).scale ?? 1)}
                          disabled={isSelectedVenue}
                          onBlur={() => setLocalScale(undefined)}
                          onChange={(e) => {'''

if target in content:
    content = content.replace(target, replacement)
    with open('components/editor/PropertiesSidebar.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Success")
else:
    print("Failed")
