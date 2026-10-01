import re

with open('components/tools/SelectionTool.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Hide handles if ANY selected item is locked
can_show_handles = '''    const canShowResizeHandles = !selectedItems.some(it => {
        if ((it.object as any).locked) return true;
'''
content = content.replace('    const canShowResizeHandles = !selectedItems.some(it => {\n', can_show_handles)

# 2. Prevent movement/resizing/rotation if locked
initial_state_foreach = '''          initialState.items.forEach(item => {
              if ((item.object as any).locked) return;'''
content = content.replace('          initialState.items.forEach(item => {\n', initial_state_foreach + '\n')

with open('components/tools/SelectionTool.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated SelectionTool.tsx")
