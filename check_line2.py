with open("components/renderers/ShapeRenderer.tsx", "r", encoding="utf-8") as f:
    c = f.read()

import re
for m in re.finditer(r"if \(shape\.type === 'line'\) \{", c):
    idx = m.start()
    print(c[idx:idx+2500].encode("ascii", "ignore").decode("ascii"))
