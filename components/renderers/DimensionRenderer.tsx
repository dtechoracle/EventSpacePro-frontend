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
    const fontFamily = (dimension as any).fontFamily || 'Inter, sans-serif';
    const fontWeight = (dimension as any).fontWeight || '600';
    const fontStyle = (dimension as any).fontStyle || 'normal';
    const textDecoration = (dimension as any).textDecoration || 'none';

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

    // Determine the actual offset to use
    // If labelPosition is explicitly set, it determines the side (sign)
    let sign = 1;
    if (dimension.labelPosition === 'top-right') {
        sign = -1;
    } else if (dimension.labelPosition === 'bottom-left') {
        sign = 1;
    } else {
        sign = Math.sign(offset || 1) || 1;
    }
    
    // For automatic dimensions (like overlays), we might want a smaller default offset
    // if one isn't provided. 400 is common for architectural drawings but 15 is better for UI overlays.
    const defaultOffset = (dimension as any).color === '#666' ? 150 : 400; // #666 is used by DimensionOverlay
    const currentOffset = offset !== undefined ? offset : defaultOffset;
    const absOffset = Math.abs(currentOffset);
    const finalOffset = dimension.labelPosition ? absOffset * sign : currentOffset;

    // Calculate offset points for the dimension line
    const p1x = startPoint.x + px * finalOffset;
    const p1y = startPoint.y + py * finalOffset;
    const p2x = endPoint.x + px * finalOffset;
    const p2y = endPoint.y + py * finalOffset;

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

    // Keep extension lines from visually touching the measured element.
    const extensionDirection = Math.sign(finalOffset || sign || 1) || 1;
    const extensionGap = Math.min(Math.abs(finalOffset) * 0.45, 10 / Math.max(zoom, 0.01));
    const overshoot = 10 / Math.max(zoom, 0.01);

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
                    const rectWidth = text.length * (labelFontSize * 0.6);
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
                                fontWeight={fontWeight}
                                fontStyle={fontStyle}
                                textDecoration={textDecoration}
                                fill={color}
                                fontFamily={fontFamily}
                            >
                                {text}
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
                x1={startPoint.x + px * extensionDirection * extensionGap}
                y1={startPoint.y + py * extensionDirection * extensionGap}
                x2={p1x + px * extensionDirection * overshoot}
                y2={p1y + py * extensionDirection * overshoot}
                stroke={color}
                strokeWidth={strokeWidth * 0.5}
                opacity={0.42}
                vectorEffect="non-scaling-stroke"
            />
            <line
                x1={endPoint.x + px * extensionDirection * extensionGap}
                y1={endPoint.y + py * extensionDirection * extensionGap}
                x2={p2x + px * extensionDirection * overshoot}
                y2={p2y + py * extensionDirection * overshoot}
                stroke={color}
                strokeWidth={strokeWidth * 0.5}
                opacity={0.42}
                vectorEffect="non-scaling-stroke"
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
                            fontWeight={fontWeight}
                            fontStyle={fontStyle}
                            textDecoration={textDecoration}
                            fill={color}
                            fontFamily={fontFamily}
                        >
                            {textStr}
                        </text>
                    </g>
                );
            })()}
        </g>
    );
};
