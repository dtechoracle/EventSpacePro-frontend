import re

with open('pages/dashboard/editor/[slug]/[id].tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'bsolute' in line or '\x07bsolute' in line:
        lines[i] = '          className={bsolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-slate-200/60 transition-all }\n'
        print(f"Replaced at index {i}")

with open('pages/dashboard/editor/[slug]/[id].tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)
