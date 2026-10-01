with open("components/Workspace2D.tsx", "r", encoding="utf-8") as f:
    c = f.read()

# 1. Fix text drag - when editingTextId is set, prevent drag start when the mouse is over the text
old = '''    (e: React.MouseEvent) => {
      if (!canvasRef.current) return;

      const { x: worldX, y: worldY } = screenToWorld(e.clientX, e.clientY);

      // Skip if click originated from scrollbar indicators
      const target = e.target as HTMLElement;
      if (target?.closest('[id="sb-h"], [id="sb-v"]')) return;'''

new = '''    (e: React.MouseEvent) => {
      if (!canvasRef.current) return;

      // If user is actively editing a text annotation inline, don't intercept mouse events
      // so they can drag-select text inside the textarea freely
      const currentEditingId = useEditorStore.getState().editingTextId;
      if (currentEditingId) return;

      const { x: worldX, y: worldY } = screenToWorld(e.clientX, e.clientY);

      // Skip if click originated from scrollbar indicators
      const target = e.target as HTMLElement;
      if (target?.closest('[id="sb-h"], [id="sb-v"]')) return;'''

if old in c:
    c = c.replace(old, new)
    print("Fixed text drag guard in handleMouseDown")
else:
    print("Pattern not found!")

with open("components/Workspace2D.tsx", "w", encoding="utf-8") as f:
    f.write(c)
