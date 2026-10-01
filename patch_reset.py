import re

with open('components/editor/PropertiesSidebar.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the block that handles the main fill color input.
pattern = re.compile(r'(<input\s+type="color"\s+value=\{\(itemType === \'asset\' \? \(selectedItem as any\)\.fillColor : \(selectedItem as any\)\.fill\) \|\| \'#ffffff\'\}\s+onChange=\{.*?\}\s+className="w-6 h-6 p-0 border-0 rounded cursor-pointer"\s+\/>)', re.DOTALL)

# But wait! The actual code has:
# className="w-6 h-6 p-0 border-0 rounded cursor-pointer"
# Let's search exactly how the block looks around 94550.
