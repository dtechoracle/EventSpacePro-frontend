with open("components/tools/ShapeTool.tsx", "r", encoding="utf-8") as f:
    c = f.read()

idx = c.find("return (")
# Need to find the return statement for rect/ellipse
import re
for m in re.finditer(r'return\s*\(\s*<>\s*{/\* Shape Preview \*/}', c):
    print(c[max(0, m.start()-50):m.end()+1000].encode("ascii", "ignore").decode("ascii"))
