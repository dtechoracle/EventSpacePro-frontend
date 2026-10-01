import re

with open('pages/dashboard/editor/[slug]/[id].tsx', 'r', encoding='utf-8') as f:
    content = f.read()

pattern = re.compile(r'className=\{[\s\x07]*bsolute[^\}]*\}')
match = pattern.search(content)

if match:
    replacement = 'className={bsolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-slate-200/60 transition-all }'
    content = content.replace(match.group(0), replacement)
    with open('pages/dashboard/editor/[slug]/[id].tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Fixed bsolute!")
else:
    print("Not found!")
