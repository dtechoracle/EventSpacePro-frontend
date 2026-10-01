import re

with open('components/editor/PropertiesSidebar.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

target = '''                            <input
                              type="color"
                              value={(itemType === 'asset' ? (selectedItem as any).fillColor : (selectedItem as any).fill) || '#ffffff'}
                              onChange={(e) => {
                                const changes: any = { fill: e.target.value };
                                if (!(selectedItem as any).fillType) changes.fillType = 'solid';

                                if (itemType === 'shape') updateShape(selectedItem.id, changes);
                                if (itemType === 'asset') {
                                  updateAsset(selectedItem.id, { fillColor: e.target.value });
                                  updateSceneAsset(selectedItem.id, { fillColor: e.target.value });
                                }
                              }}
                              className="w-6 h-6 p-0 border-0 rounded cursor-pointer"
                            />'''

replacement = target + '''
                            {itemType === 'asset' && (
                                <button
                                    onClick={() => {
                                        updateAsset(selectedItem.id, { fillColor: undefined, tableColor: undefined, chairColor: undefined });
                                        updateSceneAsset(selectedItem.id, { fillColor: undefined, tableColor: undefined, chairColor: undefined });
                                    }}
                                    className="ml-2 px-2 py-1 text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 rounded transition-colors"
                                    title="Reset Fill"
                                >
                                    Reset
                                </button>
                            )}'''

if target in content:
    content = content.replace(target, replacement)
    with open('components/editor/PropertiesSidebar.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Success")
else:
    print("Failed")
