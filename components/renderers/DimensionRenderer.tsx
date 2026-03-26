import React from 'react';
import { Dimension } from '@/store/projectStore';
import { useSceneStore } from '@/store/sceneStore';

interface DimensionRendererProps {
    dimension: Dimension;
    zoom: number;
}

export const DimensionRenderer: React.FC<DimensionRendererProps> = ({ dimension, zoom }) => {
    const unitSystem = useSceneStore(s => s.unitSystem) || 'metric-mm';
    const { 
        startPoint, 
        endPoint, 
        offset = 400, 
        value, 
        strokeWidth = 1.5, 
        color = '#000000', 
        fontSize = 11,
        textPosition = 'inbetween' 
    } = dimension;

    const formatValue = (mmValue: number) => {
        if (unitSystem === 'imperial-ft') {
            const feet = mmValue / 304.8;
            return `${feet.toFixed(2)} ft`;
        } else if (unitSystem === 'metric-m') {
            const meters = mmValue / 1000;
            return `${meters.toFixed(2)} m`;
        }
        return `${Math.round(mmValue)} mm`;
    };

    // Calculate vector from start to end
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length === 0) return null;

    // Normalized direction vector
    const nx = dx / length;
    const ny = dy / length;

    // Perpendicular vector (rotated 90 degrees)
    // We want the offset to be applied in the direction of the offset value
    // If offset is positive, it goes one way; negative, the other.
    // Standard rotation (-y, x) for 90 degrees counter-clockwise
    const px = -ny;
    const py = nx;

    // Calculate offset points for the dimension line
    const p1x = startPoint.x + px * offset;
    const p1y = startPoint.y + py * offset;
    const p2x = endPoint.x + px * offset;
    const p2y = endPoint.y + py * offset;

    // Calculate text position (midpoint of dimension line)
    const midX = (p1x + p2x) / 2;
    const midY = (p1y + p2y) / 2;

    // Calculate rotation angle for text
    let angle = Math.atan2(dy, dx) * (180 / Math.PI);
    // Keep text readable (not upside down)
    if (angle > 90 || angle < -90) {
        angle += 180;
    }

    // Display value
    const mmValue = value !== undefined ? value : length;
    const textStr = formatValue(mmValue);

    // Arrow size scaled by zoom (inverse scale to keep constant visual size)
    // Actually, in SVG world space, we want it to look consistent relative to the drawing?
    // Or consistent relative to the screen?
    // Usually dimensions scale with the drawing, but text size might need to be readable.
    // For now, let's make it fixed in world units or slightly adaptive.
    const arrowSize = 100; // 100mm arrow size? Might be too big/small depending on scale.
    // Let's assume 1 unit = 1mm. 100mm is 10cm.

    // Extension line overshoot (how far the tick extends past the dimension line)
    const overshoot = 10;

    // Convert fontSize to world units (fontSize is in points, we scale it)
    const worldFontSize = fontSize * 2; // Approximate conversion

    const isRadial = dimension.type === 'radial' || dimension.type === 'circular';

    if (isRadial) {
        // Radial Dimension Rendering
        // Line from center (start) to edge (end)
        // Arrow at end only
        // Text "R {value}"

        const text = `R ${Math.round(value || length)}`;

        // Calculate angle for text
        let angle = Math.atan2(dy, dx) * (180 / Math.PI);
        if (angle > 90 || angle < -90) angle += 180;

        return (
            <g className="dimension-group" style={{ pointerEvents: 'all', cursor: 'pointer' }}>
                {/* Main Line */}
                <line
                    x1={startPoint.x}
                    y1={startPoint.y}
                    x2={endPoint.x}
                    y2={endPoint.y}
                    stroke={color}
                    strokeWidth={strokeWidth}
                />

                {/* Arrow at End (Edge) */}
                <path
                    d={`M ${endPoint.x} ${endPoint.y} L ${endPoint.x - nx * arrowSize + px * (arrowSize * 0.3)} ${endPoint.y - ny * arrowSize + py * (arrowSize * 0.3)} M ${endPoint.x} ${endPoint.y} L ${endPoint.x - nx * arrowSize - px * (arrowSize * 0.3)} ${endPoint.y - ny * arrowSize - py * (arrowSize * 0.3)}`}
                    stroke={color}
                    strokeWidth={strokeWidth}
                    fill="none"
                />

                {/* Text Label */}
                {(() => {
                    const labelFontSize = fontSize || 11;
                    const rectWidth = textStr.length * (labelFontSize * 0.6);
                    const rectHeight = labelFontSize * 1.8;
                    return (
                        <g transform={`translate(${midX}, ${midY}) scale(${1 / zoom}) rotate(${angle})`}>
                            <rect
                                x={-rectWidth / 2}
                                y={-rectHeight / 2}
                                width={rectWidth}
                                height={rectHeight}
                                fill="white"
                                rx="4"
                                opacity="0.9"
                                style={{ filter: 'drop-shadow(0px 1px 2px rgba(0,0,0,0.1))' }}
                            />
                            <text
                                x="0"
                                y="1"
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fontSize={labelFontSize}
                                fontWeight="600"
                                fill={color}
                                fontFamily="sans-serif"
                            >
                                {textStr}
                            </text>
                        </g>
                    );
                })()}
                {/* Center Mark */}
                <path
                    d={`M ${startPoint.x - 10} ${startPoint.y} L ${startPoint.x + 10} ${startPoint.y} M ${startPoint.x} ${startPoint.y - 10} L ${startPoint.x} ${startPoint.y + 10}`}
                    stroke={color}
                    strokeWidth={strokeWidth * 0.5}
                />
            </g>
        );
    }

    return (
        <g className="dimension-group" style={{ pointerEvents: 'all', cursor: 'pointer' }}>
            {/* Extension Lines */}
            <line
                x1={startPoint.x}
                y1={startPoint.y}
                x2={p1x + px * overshoot}
                y2={p1y + py * overshoot}
                stroke={color}
                strokeWidth={strokeWidth * 0.5}
                opacity={0.5}
                vectorEffect="non-scaling-stroke"
            />
            <line
                x1={endPoint.x}
                y1={endPoint.y}
                x2={p2x + px * overshoot}
                y2={p2y + py * overshoot}
                stroke={color}
                strokeWidth={strokeWidth * 0.5}
                opacity={0.5}
            />

            {/* Main Dimension Line */}
            {dimension.lineStyle === 'double' ? (
                <>

                    {/* Double Line Implementation */}
                    <line
                        x1={p1x + px * (strokeWidth * 0.75)}
                        y1={p1y + py * (strokeWidth * 0.75)}
                        x2={p2x + px * (strokeWidth * 0.75)}
                        y2={p2y + py * (strokeWidth * 0.75)}
                        stroke={color}
                        strokeWidth={strokeWidth * 0.5}
                        strokeDasharray={`${10 / zoom} ${10 / zoom}`}
                    />
                    <line
                        x1={p1x - px * (strokeWidth * 0.75)}
                        y1={p1y - py * (strokeWidth * 0.75)}
                        x2={p2x - px * (strokeWidth * 0.75)}
                        y2={p2y - py * (strokeWidth * 0.75)}
                        stroke={color}
                        strokeWidth={strokeWidth * 0.5}
                        strokeDasharray={`${10 / zoom} ${10 / zoom}`}
                    />
                </>
            ) : (
                <line
                    x1={p1x}
                    y1={p1y}
                    x2={p2x}
                    y2={p2y}
                    stroke={color}
                    strokeWidth={strokeWidth}
                    vectorEffect="non-scaling-stroke"
                    strokeDasharray={
                        dimension.lineStyle === 'dotted' ? `${4 / zoom} ${4 / zoom}` :
                            dimension.lineStyle === 'dashed' ? `${15 / zoom} ${10 / zoom}` :
                                undefined
                    }
                />
            )}

            {/* Arrows / Ticks */}
            {/* Start Arrow (pointing IN) */}
            <path
                d={`M ${p1x} ${p1y} L ${p1x + nx * arrowSize + px * (arrowSize * 0.3)} ${p1y + ny * arrowSize + py * (arrowSize * 0.3)} M ${p1x} ${p1y} L ${p1x + nx * arrowSize - px * (arrowSize * 0.3)} ${p1y + ny * arrowSize - py * (arrowSize * 0.3)}`}
                stroke={color}
                strokeWidth={strokeWidth}
                fill="none"
                vectorEffect="non-scaling-stroke"
            />
            {/* End Arrow (pointing IN) */}
            <path
                d={`M ${p2x} ${p2y} L ${p2x - nx * arrowSize + px * (arrowSize * 0.3)} ${p2y - ny * arrowSize + py * (arrowSize * 0.3)} M ${p2x} ${p2y} L ${p2x - nx * arrowSize - px * (arrowSize * 0.3)} ${p2y - ny * arrowSize - py * (arrowSize * 0.3)}`}
                stroke={color}
                strokeWidth={strokeWidth}
                fill="none"
                vectorEffect="non-scaling-stroke"
            />

            {/* Text Label */}
            {(() => {
                const labelFontSize = fontSize || 11;
                // standard px/py for offset logic. textPosition shifts are in world units or screen units?
                // since we are in fixed screen scale(1/zoom), shifts in text coordinates are in screen pixels.
                let offsetY = 0;
                if (textPosition === 'above') offsetY = -labelFontSize;
                if (textPosition === 'below') offsetY = labelFontSize;

                const rectWidth = textStr.length * (labelFontSize * 0.6);
                const rectHeight = labelFontSize * 1.8;

                return (
                    <g transform={`translate(${midX}, ${midY}) scale(${1 / zoom}) rotate(${angle}) translate(0, ${offsetY})`}>
                        <rect
                            x={-rectWidth / 2}
                            y={-rectHeight / 2}
                            width={rectWidth}
                            height={rectHeight}
                            fill="white"
                            rx="4"
                            opacity="0.9"
                            style={{ filter: 'drop-shadow(0px 1px 2px rgba(0,0,0,0.1))' }}
                        />
                        <text
                            x="0"
                            y="1"
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fontSize={labelFontSize}
                            fontWeight="600"
                            fill={color}
                            fontFamily="sans-serif"
                        >
                            {textStr}
                        </text>
                    </g>
                );
            })()}
        </g>
    );
};
