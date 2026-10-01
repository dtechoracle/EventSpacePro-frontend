with open("components/renderers/SnapMarkersRenderer.tsx", "r", encoding="utf-8") as f:
    c = f.read()

c = c.replace('r={4 / zoom}', 'r={2.5 / zoom}')
c = c.replace('strokeWidth={1.5 / zoom}', 'strokeWidth={1 / zoom}')
c = c.replace('r={3.5 / zoom}', 'r={2 / zoom}')

with open("components/renderers/SnapMarkersRenderer.tsx", "w", encoding="utf-8") as f:
    f.write(c)
print("Reduced snap marker size in SnapMarkersRenderer")
