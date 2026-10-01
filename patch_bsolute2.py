import re

with open('pages/dashboard/editor/[slug]/[id].tsx', 'r', encoding='utf-8') as f:
    content = f.read()

pattern = re.compile(r'className=\{[\s\x07]*bsolute[^\}]*\}')
replacement = 'className={bsolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-slate-200/60 transition-all }'

new_content = pattern.sub(replacement, content)

if new_content != content:
    with open('pages/dashboard/editor/[slug]/[id].tsx', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Replaced!")
else:
    print("Not replaced!")
