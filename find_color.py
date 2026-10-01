import re
with open('components/editor/PropertiesSidebar.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

for m in re.finditer(r'<input\s+type="color"', content):
    start = max(0, m.start() - 200)
    end = min(len(content), m.end() + 200)
    print("Match at", m.start(), "...")
    print(content[start:end])
    print("---")
