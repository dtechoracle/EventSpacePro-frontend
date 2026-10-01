with open('components/Workspace2D.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

target = '''      style={{
        cursor: isPanning ? 'grabbing' : 
                activeTool === 'pan' ? 'grab' : 
                activeHoveredSnapPoint ? 'crosshair' :
                (hoveredId && activeTool === 'select') ? 'pointer' :
                activeTool === 'select' ? 'default' : 'crosshair',
      }}'''

replacement = '''      style={{
        cursor: isPanning ? 'grabbing' : 
                activeTool === 'pan' ? 'grab' : 
                (activeHoveredSnapPoint && activeTool !== 'select') ? 'none' :
                (hoveredId && activeTool === 'select') ? 'pointer' :
                activeTool === 'select' ? 'default' : 'crosshair',
      }}'''

c = c.replace(target, replacement)
with open('components/Workspace2D.tsx', 'w', encoding='utf-8') as f:
    f.write(c)

print("Updated Workspace2D.tsx cursor")
