import glob
import re

for file in glob.glob('components/tools/*.tsx'):
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if "if (snapToObjects && !snapToGridEnabled)" in content:
        content = content.replace("if (snapToObjects && !snapToGridEnabled)", "if (snapToObjects)")
        with open(file, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Patched {file}")
