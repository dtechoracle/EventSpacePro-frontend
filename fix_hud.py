with open("components/Workspace2D.tsx", "r", encoding="utf-8") as f:
    c = f.read()

old_hud = "bg-slate-900/90 text-white shadow-xl border border-white/20"
new_hud = "bg-white text-slate-800 shadow-lg border border-slate-200"

c = c.replace(old_hud, new_hud)

# Also need to fix text colors inside it
c = c.replace('text-[10px] text-slate-300', 'text-[10px] text-slate-500')
c = c.replace('bg-white/20', 'bg-slate-200') # separator line
c = c.replace('text-red-200', 'text-red-600')
c = c.replace('bg-red-500/20 hover:bg-red-500/40', 'bg-red-50 hover:bg-red-100')
c = c.replace('border-red-500/30', 'border-red-200')

with open("components/Workspace2D.tsx", "w", encoding="utf-8") as f:
    f.write(c)
print("Fixed HUD toast style")
