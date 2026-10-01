import re

# ======= 1. Fix text edit - guard mouseUp too =======
with open("components/Workspace2D.tsx", "r", encoding="utf-8") as f:
    c = f.read()

old_mouseup = """    // Update typing state when clicking away from text
    if (useEditorStore.getState().editingTextId) {
      setEditingTextId(null);
      updateTyping(false);
    }"""

new_mouseup = """    // Update typing state when clicking away from text
    // But don't close editing if user is still inside the textarea (e.g. after text-select drag)
    if (useEditorStore.getState().editingTextId) {
      const activeEl = document.activeElement;
      const isInTextarea = activeEl && activeEl.tagName === 'TEXTAREA';
      if (!isInTextarea) {
        setEditingTextId(null);
        updateTyping(false);
      }
    }"""

if old_mouseup in c:
    c = c.replace(old_mouseup, new_mouseup, 1)
    print("Fixed mouseUp text guard")
else:
    print("mouseUp pattern NOT FOUND!")

with open("components/Workspace2D.tsx", "w", encoding="utf-8") as f:
    f.write(c)


# ======= 2. Fix snap ring to be fixed screen size (use vectorEffect non-scaling-stroke + fixed pixel radius) =======
with open("components/renderers/SnapMarkersRenderer.tsx", "r", encoding="utf-8") as f:
    c = f.read()

old_ring = """                        {isActive ? (
                            <circle
                                r={markerRadius * 1.5}
                                fill="none"
                                stroke="#22c55e"
                                strokeWidth={1.5 / zoom}
                                opacity={1}
                            />
                        ) : (
                            <circle
                                r={markerRadius}
                                fill="#22c55e"
                                opacity={0.6}
                            />
                        )}"""

new_ring = """                        {isActive ? (
                            <circle
                                r={6 / zoom}
                                fill="none"
                                stroke="#22c55e"
                                strokeWidth={1.5 / zoom}
                                vectorEffect="non-scaling-stroke"
                                opacity={1}
                            />
                        ) : (
                            <circle
                                r={markerRadius}
                                fill="#22c55e"
                                opacity={0.6}
                            />
                        )}"""

if old_ring in c:
    c = c.replace(old_ring, new_ring, 1)
    print("Fixed snap ring fixed size")
else:
    print("snap ring pattern NOT FOUND!")

with open("components/renderers/SnapMarkersRenderer.tsx", "w", encoding="utf-8") as f:
    f.write(c)


# ======= 3. Fix table number not flipping with asset - apply counter-rotation =======
with open("components/renderers/AssetRenderer.tsx", "r", encoding="utf-8") as f:
    c = f.read()

old_label = """        const rad = rotation * Math.PI / 180;
        const cosR = Math.cos(rad);
        const sinR = Math.sin(rad);
        const worldX = asset.x + baseScale * (cosR * tx - sinR * ty);
        const worldY = asset.y + baseScale * (sinR * tx + cosR * ty);
        let worldRotation = rotation;
        if (orientation === 'vertical') worldRotation += 90;

        tableLabel = (
            <g transform={`translate(${worldX}, ${worldY}) rotate(${worldRotation})`}>"""

new_label = """        const rad = rotation * Math.PI / 180;
        const cosR = Math.cos(rad);
        const sinR = Math.sin(rad);
        const worldX = asset.x + baseScale * (cosR * tx - sinR * ty);
        const worldY = asset.y + baseScale * (sinR * tx + cosR * ty);
        // Label always stays upright - do not rotate with the asset
        let worldRotation = 0;
        if (orientation === 'vertical') worldRotation = 90;

        tableLabel = (
            <g transform={`translate(${worldX}, ${worldY}) rotate(${worldRotation})`}>"""

if old_label in c:
    c = c.replace(old_label, new_label, 1)
    print("Fixed table label rotation")
else:
    print("table label pattern NOT FOUND!")

with open("components/renderers/AssetRenderer.tsx", "w", encoding="utf-8") as f:
    f.write(c)


# ======= 4. Fix H/V flip buttons highlight - remove active state highlight, always show plain =======
with open("components/editor/PropertiesSidebar.tsx", "r", encoding="utf-8") as f:
    c = f.read()

old_hbtn = """className={`px-3 py-1 text-xs border rounded transition-colors ${selectedShapes.some(s => (s as any).flipX) || selectedAssets.some(a => (a as any).flipX) ? 'bg-blue-100 border-blue-200 text-blue-600 font-medium' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    >H</button>"""

new_hbtn = """className="px-3 py-1 text-xs border rounded transition-colors bg-white border-gray-200 text-gray-600 hover:bg-gray-50 focus:outline-none"
                    >H</button>"""

if old_hbtn in c:
    c = c.replace(old_hbtn, new_hbtn, 1)
    print("Fixed H button highlight")
else:
    print("H button pattern NOT FOUND - trying to find it...")
    idx = c.find("flipSelectionX()")
    print(c[max(0, idx-50):idx+400].encode("ascii", "ignore").decode("ascii"))

with open("components/editor/PropertiesSidebar.tsx", "w", encoding="utf-8") as f:
    f.write(c)

print("Done")
