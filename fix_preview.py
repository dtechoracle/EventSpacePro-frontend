with open("components/tools/ShapeTool.tsx", "r", encoding="utf-8") as f:
    c = f.read()

old_rect_preview = """                {shapeType === 'rectangle' && (
                    <rect
                        x={centerX - previewWidth / 2}
                        y={centerY - previewHeight / 2}
                        width={previewWidth}
                        height={previewHeight}
                        fill="transparent"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        opacity={0.7}
                        vectorEffect="non-scaling-stroke"
                    />
                )}"""

new_preview = """                {shapeType === 'rectangle' && (
                    <rect
                        x={centerX - previewWidth / 2}
                        y={centerY - previewHeight / 2}
                        width={previewWidth}
                        height={previewHeight}
                        fill="transparent"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        opacity={0.7}
                        vectorEffect="non-scaling-stroke"
                    />
                )}

                {(shapeType === 'line' || shapeType === 'arrow') && (
                    <line
                        x1={startPoint.x}
                        y1={startPoint.y}
                        x2={endPoint.x}
                        y2={endPoint.y}
                        stroke="#3b82f6"
                        strokeWidth={2}
                        opacity={0.7}
                        vectorEffect="non-scaling-stroke"
                    />
                )}"""

c = c.replace(old_rect_preview, new_preview)

# I should also remove the old `isLineMode` preview block since it's now unreachable, 
# but it doesn't hurt to leave it.
with open("components/tools/ShapeTool.tsx", "w", encoding="utf-8") as f:
    f.write(c)
print("Added preview for line/arrow")
