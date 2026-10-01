with open("components/editor/PropertiesSidebar.tsx", "r", encoding="utf-8") as f:
    c = f.read()

# Also look for single-item flip buttons elsewhere
idx = c.find("flipSelectionY()")
print("flipSelectionY positions found:", c.count("flipSelectionY()"))

# Replace all dynamic className patterns for V flip button
old = """className={`px-3 py-1 text-xs border rounded transition-colors ${selectedShapes.some(s => (s as any).flipY) || selectedAssets.some(a => (a as any).flipY) ? 'bg-blue-100 border-blue-200 text-blue-600 font-medium' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    >V</button>"""

new = """className="px-3 py-1 text-xs border rounded transition-colors bg-white border-gray-200 text-gray-600 hover:bg-gray-50 focus:outline-none"
                    >V</button>"""

if old in c:
    c = c.replace(old, new)
    print("Fixed V button highlight")
else:
    print("V button pattern NOT FOUND!")

with open("components/editor/PropertiesSidebar.tsx", "w", encoding="utf-8") as f:
    f.write(c)
