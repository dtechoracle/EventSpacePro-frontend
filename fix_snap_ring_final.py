with open("components/renderers/SnapMarkersRenderer.tsx", "r", encoding="utf-8") as f:
    c = f.read()

# Fix markerRadius - make it screen-space fixed (constant pixel size regardless of zoom)
# 4 / zoom means the dot is 4 world units = grows visually when zoomed out
# We want a fixed 4px on screen, so use vectorEffect="non-scaling-stroke" and put r as constant divided by zoom

old_dots = """                        {isActive ? (
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

new_dots = """                        {isActive ? (
                            <circle
                                r={6 / zoom}
                                fill="none"
                                stroke="#22c55e"
                                strokeWidth={1.5 / zoom}
                                opacity={1}
                            />
                        ) : (
                            <circle
                                r={3.5 / zoom}
                                fill="#22c55e"
                                opacity={0.7}
                            />
                        )}"""

if old_dots in c:
    c = c.replace(old_dots, new_dots, 1)
    print("Fixed snap dot to fixed screen size")
else:
    print("Pattern not found!")

with open("components/renderers/SnapMarkersRenderer.tsx", "w", encoding="utf-8") as f:
    f.write(c)
