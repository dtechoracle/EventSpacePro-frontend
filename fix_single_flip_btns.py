with open("components/editor/PropertiesSidebar.tsx", "r", encoding="utf-8") as f:
    c = f.read()

old_h = """className={`px-3 py-1 text-xs border rounded transition-colors ${(selectedItem as any).flipX ? 'bg-blue-100 border-blue-200 text-blue-600 font-medium' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                        >H</button>"""

new_h = """className="px-3 py-1 text-xs border rounded transition-colors bg-white border-gray-200 text-gray-600 hover:bg-gray-50 focus:outline-none"
                        >H</button>"""

old_v = """className={`px-3 py-1 text-xs border rounded transition-colors ${(selectedItem as any).flipY ? 'bg-blue-100 border-blue-200 text-blue-600 font-medium' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                        >V</button>"""

new_v = """className="px-3 py-1 text-xs border rounded transition-colors bg-white border-gray-200 text-gray-600 hover:bg-gray-50 focus:outline-none"
                        >V</button>"""

changed = 0
if old_h in c:
    c = c.replace(old_h, new_h, 1)
    changed += 1
    print("Fixed single-item H button")
else:
    print("H single button pattern NOT FOUND!")

if old_v in c:
    c = c.replace(old_v, new_v, 1)
    changed += 1
    print("Fixed single-item V button")
else:
    print("V single button pattern NOT FOUND!")

with open("components/editor/PropertiesSidebar.tsx", "w", encoding="utf-8") as f:
    f.write(c)
print(f"Changed {changed} patterns")
