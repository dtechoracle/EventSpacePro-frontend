with open('pages/dashboard/editor/[slug]/[id].tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    if 'const isLocked = Boolean(item.locked);' in l:
        lines[i] = '  const entity = item.wall || item.shape || item.asset || item.text || item.dimension || item.labelArrow || item.group || item;\n  const isLocked = Boolean(entity.locked);\n'
        print("Patched isLocked")

with open('pages/dashboard/editor/[slug]/[id].tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)
