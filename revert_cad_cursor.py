with open('components/renderers/SnapMarkersRenderer.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

target = '''                        {isActive && activeTool !== 'select' && activeTool !== 'pan' && (
                            <g className="cad-snap-crosshair">
                                <line x1={-12 / zoom} y1={0} x2={12 / zoom} y2={0} stroke="#22c55e" strokeWidth={1.5 / zoom} />
                                <line x1={0} y1={-12 / zoom} x2={0} y2={12 / zoom} stroke="#22c55e" strokeWidth={1.5 / zoom} />
                            </g>
                        )}'''

c = c.replace(target, '')

with open('components/renderers/SnapMarkersRenderer.tsx', 'w', encoding='utf-8') as f:
    f.write(c)

with open('components/Workspace2D.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

target_cursor = '''cursor: isPanning ? 'grabbing' : 
                activeTool === 'pan' ? 'grab' : 
                (activeHoveredSnapPoint && activeTool !== 'select') ? 'none' :
                (hoveredId && activeTool === 'select') ? 'pointer' :
                activeTool === 'select' ? 'default' : 'crosshair','''

replacement_cursor = '''cursor: isPanning ? 'grabbing' : 
                activeTool === 'pan' ? 'grab' : 
                (hoveredId && activeTool === 'select') ? 'pointer' :
                activeTool === 'select' ? 'default' : 'crosshair','''

c = c.replace(target_cursor, replacement_cursor)

with open('components/Workspace2D.tsx', 'w', encoding='utf-8') as f:
    f.write(c)

print("Reverted CAD cursor overlay.")
