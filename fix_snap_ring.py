with open("components/renderers/SnapMarkersRenderer.tsx", "r", encoding="utf-8") as f:
    c = f.read()

# Replace filled green circles with ring markers for active snap
old = '''                        <circle
                            r={markerRadius}
                            fill="#22c55e"
                            opacity={isActive ? 1 : 0.6}
                        />'''

new = '''                        {isActive ? (
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
                        )}'''

if old in c:
    c = c.replace(old, new)
    print("Fixed snap ring marker")
else:
    print("Pattern not found!")

with open("components/renderers/SnapMarkersRenderer.tsx", "w", encoding="utf-8") as f:
    f.write(c)
