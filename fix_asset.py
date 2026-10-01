with open("components/renderers/AssetRenderer.tsx", "r", encoding="utf-8") as f:
    c = f.read()

old_flip = """        if (flipX) tx = -tx;"""
new_flip = """        if (flipX) tx = -tx;
        if (flipY) ty = -ty;"""

c = c.replace(old_flip, new_flip)
with open("components/renderers/AssetRenderer.tsx", "w", encoding="utf-8") as f:
    f.write(c)
print("Updated AssetRenderer.tsx")
