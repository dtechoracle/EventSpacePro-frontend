with open("store/projectStore.ts", "r", encoding="utf-8") as f:
    c = f.read()

# 1. Add tableNumberingVisible to type after globalTableNumberingColor: string;
old_type = "    globalTableNumberingColor: string;\n    setGlobalTableNumberingPosition:"
new_type = "    globalTableNumberingColor: string;\n    tableNumberingVisible: boolean;\n    setTableNumberingVisible: (visible: boolean) => void;\n    setGlobalTableNumberingPosition:"

c = c.replace(old_type, new_type, 1)

# 2. Add the default state value
old_init = "    globalTableNumberingColor: '#000000',"
new_init = "    globalTableNumberingColor: '#000000',\n    tableNumberingVisible: true,"

c = c.replace(old_init, new_init, 1)

# 3. Add the action setter near setGlobalTableNumberingTextStyle
old_setter = "    setGlobalTableNumberingTextStyle: (updates, updateAll) => {"
new_setter = """    setTableNumberingVisible: (visible) => {
      set({ tableNumberingVisible: visible });
    },
    setGlobalTableNumberingTextStyle: (updates, updateAll) => {"""

c = c.replace(old_setter, new_setter, 1)

with open("store/projectStore.ts", "w", encoding="utf-8") as f:
    f.write(c)

print("Added tableNumberingVisible to projectStore")
