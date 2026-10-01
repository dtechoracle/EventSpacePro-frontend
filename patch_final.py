with open('pages/dashboard/editor/[slug]/[id].tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    if 'bsolute right' in l:
        lines[i] = '          className={`absolute right-8 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-slate-200/60 transition-all ${isLocked ? "opacity-100 text-amber-600 font-bold" : "opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-700"}`}\n'
        print("Replaced!")

with open('pages/dashboard/editor/[slug]/[id].tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)
