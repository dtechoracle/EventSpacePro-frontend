with open("components/renderers/AssetRenderer.tsx", "r", encoding="utf-8") as f:
    c = f.read()

# Add tableNumberingVisible subscription after globalTableFontFamily
old_globals = "    const globalPos = useProjectStore(s => s.globalTableNumberingPosition);\n    const globalOrientation = useProjectStore(s => s.globalTableNumberingOrientation);\n    const globalTableFontSize = useProjectStore(s => s.globalTableNumberingFontSize);\n    const globalTableFontFamily = useProjectStore(s => s.globalTableNumberingFontFamily);"
new_globals = "    const globalPos = useProjectStore(s => s.globalTableNumberingPosition);\n    const globalOrientation = useProjectStore(s => s.globalTableNumberingOrientation);\n    const globalTableFontSize = useProjectStore(s => s.globalTableNumberingFontSize);\n    const globalTableFontFamily = useProjectStore(s => s.globalTableNumberingFontFamily);\n    const tableNumberingVisible = useProjectStore(s => s.tableNumberingVisible ?? true);"

c = c.replace(old_globals, new_globals, 1)

# Guard with tableNumberingVisible
old_cond = "    if (asset.tableName && !isHighlightOnly) {"
new_cond = "    if (asset.tableName && !isHighlightOnly && tableNumberingVisible) {"

c = c.replace(old_cond, new_cond, 1)

with open("components/renderers/AssetRenderer.tsx", "w", encoding="utf-8") as f:
    f.write(c)

print("Updated AssetRenderer.tsx with tableNumberingVisible check")
