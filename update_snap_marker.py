with open('components/renderers/SnapMarkersRenderer.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

target = '''return (
        <g pointerEvents="none" className="snap-markers">
            {snapPoints.map((point, index) => (
                <g key={`${point.elementId}-${index}`} transform={`translate(${point.x}, ${point.y})`}>
                    <circle
                        r={markerRadius}
                        fill="#22c55e"
                        opacity={activePoint && activePoint.x === point.x && activePoint.y === point.y ? 1 : 0.8}
                    />
                </g>
            ))}
        </g>
    );'''

replacement = '''return (
        <g pointerEvents="none" className="snap-markers">
            {snapPoints.map((point, index) => {
                const isActive = activePoint && activePoint.x === point.x && activePoint.y === point.y;
                return (
                    <g key={`${point.elementId}-${index}`} transform={`translate(${point.x}, ${point.y})`}>
                        <circle
                            r={markerRadius}
                            fill="#22c55e"
                            opacity={isActive ? 1 : 0.6}
                        />
                        {isActive && activeTool !== 'select' && activeTool !== 'pan' && (
                            <g className="cad-snap-crosshair">
                                <line x1={-12 / zoom} y1={0} x2={12 / zoom} y2={0} stroke="#22c55e" strokeWidth={1.5 / zoom} />
                                <line x1={0} y1={-12 / zoom} x2={0} y2={12 / zoom} stroke="#22c55e" strokeWidth={1.5 / zoom} />
                            </g>
                        )}
                    </g>
                );
            })}
        </g>
    );'''

c = c.replace(target, replacement)
with open('components/renderers/SnapMarkersRenderer.tsx', 'w', encoding='utf-8') as f:
    f.write(c)

print("Updated SnapMarkersRenderer.tsx")
