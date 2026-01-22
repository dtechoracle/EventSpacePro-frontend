"use client";

import React from 'react';
import { Shape } from '@/store/projectStore';

interface ShapeRendererProps {
    shape: Shape;
    isSelected: boolean;
    isHovered: boolean;
}

export default function ShapeRenderer({ shape, isSelected, isHovered }: ShapeRendererProps) {
    // Default pure black stroke so new shapes/lines pop clearly
    const strokeColor = shape.stroke || '#000000';
    const fillColor = shape.fill || 'transparent';
    // Ensure strokeWidth is always a valid number, defaulting to 4 if undefined/null/0
    const strokeWidth = (shape.strokeWidth !== undefined && shape.strokeWidth !== null && shape.strokeWidth > 0)
        ? shape.strokeWidth
        : 5;

    const highlightColor = '#3b82f6';
    const showHighlight = isHovered || isSelected;

    // Generate unique IDs for gradients and patterns
    const gradientId = `gradient-${shape.id}`;
    const patternId = `pattern-${shape.id}`;
    const hatchId = `hatch-${shape.id}`;

    // Determine the fill based on fillType
    const getFillValue = (isHighlight: boolean) => {
        if (isHighlight) return 'transparent';

        const fillType = shape.fillType || 'color';

        if (fillType === 'gradient') {
            return `url(#${gradientId})`;
        } else if (fillType === 'hatch') {
            return `url(#${hatchId})`;
        } else if (fillType === 'texture') {
            return shape.fillTexture ? `url(#${shape.fillTexture})` : fillColor;
        } else if (fillType === 'image' && shape.fillImage) {
            return `url(#${patternId})`;
        } else {
            return fillColor;
        }
    };

    const renderShape = (isHighlight: boolean) => {
        // Determine strokeDasharray based on lineType
        let dashArray = shape.strokeDasharray;
        if (shape.lineType === 'dashed') {
            dashArray = '10,10';
        } else if (shape.lineType === 'dotted') {
            dashArray = '2,5';
        } else if (shape.lineType === 'solid' || !shape.lineType) {
            dashArray = undefined;
        }
        // For 'double', we don't use dashArray (handled separately in rendering)

        const commonProps = {
            fill: getFillValue(isHighlight),
            stroke: isHighlight ? highlightColor : strokeColor,
            strokeWidth: isHighlight ? strokeWidth + 12 : strokeWidth,
            opacity: isHighlight ? 0.8 : 1,
            strokeDasharray: shape.lineType !== 'double' ? dashArray : undefined,
            style: { pointerEvents: shape.id === 'background-texture' ? 'none' : 'auto' } as React.CSSProperties,
        };

        if (shape.type === 'rectangle') {
            return (
                <rect
                    x={-shape.width / 2}
                    y={-shape.height / 2}
                    width={shape.width}
                    height={shape.height}
                    {...commonProps}
                />
            );
        }

        if (shape.type === 'ellipse') {
            return (
                <ellipse
                    cx={0}
                    cy={0}
                    rx={shape.width / 2}
                    ry={shape.height / 2}
                    {...commonProps}
                />
            );
        }

        if (shape.type === 'polygon') {
            // Use provided points or generate a regular polygon
            let pts: { x: number; y: number }[] = [];
            if (shape.points && shape.points.length >= 3) {
                pts = shape.points;
            } else {
                const sides = Math.max(3, shape.polygonSides || 4);
                const radius = Math.min(shape.width, shape.height) / 2;
                for (let i = 0; i < sides; i++) {
                    const angle = ((Math.PI * 2) / sides) * i - Math.PI / 2;
                    pts.push({
                        x: Math.cos(angle) * radius,
                        y: Math.sin(angle) * radius,
                    });
                }
            }
            const pointsStr = pts.map(p => `${p.x},${p.y}`).join(' ');
            return (
                <g>
                    <polygon
                        points={pointsStr}
                        {...commonProps}
                    />
                    {!isHighlight && isSelected && pts.map((p, i) => (
                        <circle
                            key={i}
                            cx={p.x}
                            cy={p.y}
                            r={4}
                            fill="#ffffff"
                            stroke="#3b82f6"
                            strokeWidth={1.5}
                            className="cursor-move"
                        />
                    ))}
                </g>
            );
        }

        if (shape.type === 'line') {
            // If this line has explicit polyline points, render them so slanted / multi‑segment lines keep their shape.
            if (shape.points && shape.points.length >= 2) {
                const points = shape.points.map(p => `${p.x},${p.y}`).join(' ');

                if (shape.lineType === 'double') {
                    // Render double line by rendering a thick stroke and a thinner background-colored stroke on top?
                    // Or two offset lines? Offset is hard for arbitrary polyline.
                    // Easiest "double line" effect for arbitrary path is:
                    // 1. Thick line (strokeWidth * 3)
                    // 2. Thinner line (strokeWidth) in background color (or transparent/white) - but transparent won't work if over other things.
                    // Better: Render the line twice with a gap.
                    // Since we can't easily offset a polyline in SVG without complex math, let's use the masking/layering trick if possible,
                    // or just render a thick line with a white inner line (if background is white).
                    // Assuming white background for now as simple solution, or just two parallel lines if it's a simple straight line.

                    // For complex polylines, a "mask" approach is robust:
                    // Render thick line (color), then thinner line (white/bg).
                    // But this occludes things behind it.

                    // Let's stick to the "thick stroke with gap" visual for now using a mask? No, too complex.
                    // Let's try rendering it as a thick line, then a thinner "gap" line in white (assuming white canvas).
                    // If the user needs true transparency, we'd need a mask.

                    const gapWidth = Math.max(2, commonProps.strokeWidth / 2);
                    const outerWidth = commonProps.strokeWidth * 3; // Total width

                    return (
                        <g>
                            {/* Outer/Bottom thick line */}
                            <polyline
                                points={points}
                                fill="none"
                                stroke={commonProps.stroke}
                                strokeWidth={outerWidth}
                                opacity={commonProps.opacity}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                            {/* Inner "gap" line - using white for now */}
                            <polyline
                                points={points}
                                fill="none"
                                stroke="#ffffff" // Assuming white background
                                strokeWidth={gapWidth}
                                opacity={1}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />

                            {/* Control points for polyline */}
                            {!isHighlight && isSelected && shape.points.map((p, i) => (
                                <circle
                                    key={i}
                                    cx={p.x}
                                    cy={p.y}
                                    r={4}
                                    fill="#ffffff"
                                    stroke="#3b82f6"
                                    strokeWidth={1.5}
                                    className="cursor-move"
                                />
                            ))}
                        </g>
                    );
                }

                return (
                    <g>
                        <polyline
                            points={points}
                            fill="none"
                            stroke={commonProps.stroke}
                            strokeWidth={commonProps.strokeWidth}
                            opacity={commonProps.opacity}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeDasharray={commonProps.strokeDasharray}
                        />
                        {/* Control points for polyline */}
                        {!isHighlight && isSelected && shape.points.map((p, i) => (
                            <circle
                                key={i}
                                cx={p.x}
                                cy={p.y}
                                r={4}
                                fill="#ffffff"
                                stroke="#3b82f6"
                                strokeWidth={1.5}
                                className="cursor-move"
                            />
                        ))}
                    </g>
                );
            }

            // Fallback: legacy straight line using width / rotation.
            return (
                <g>
                    <line
                        x1={-shape.width / 2}
                        y1={0}
                        x2={shape.width / 2}
                        y2={0}
                        {...commonProps}
                        strokeDasharray={commonProps.strokeDasharray}
                    />
                    {/* Control points for snapping/editing */}
                    {isSelected && (
                        <>
                            <circle
                                cx={-shape.width / 2}
                                cy={0}
                                r={4}
                                fill="#ffffff"
                                stroke="#3b82f6"
                                strokeWidth={1.5}
                                className="cursor-move"
                            />
                            <circle
                                cx={shape.width / 2}
                                cy={0}
                                r={4}
                                fill="#ffffff"
                                stroke="#3b82f6"
                                strokeWidth={1.5}
                                className="cursor-move"
                            />
                        </>
                    )}
                </g>
            );
        }

        if (shape.type === 'arrow') {
            const headType = shape.arrowHeadType || 'filled-triangle';
            const tailType = shape.arrowTailType || 'none';
            const headSizeMult = shape.arrowHeadSize || 1;
            const tailSizeMult = shape.arrowTailSize || 1;

            // Use 7.5 as default if not specified
            const originalStrokeWidth = shape.strokeWidth || 7.5;

            const renderArrowMarker = (
                from: { x: number; y: number },
                to: { x: number; y: number },
                markerType: string,
                stroke: string,
                drawStrokeWidth: number,
                sizeStrokeWidth: number,
                opacity: number,
                sizeMultiplier: number
            ) => {
                if (markerType === 'none') return null;

                const dx = to.x - from.x;
                const dy = to.y - from.y;
                const len = Math.sqrt(dx * dx + dy * dy) || 1;
                const ux = dx / len;
                const uy = dy / len;

                // Base size calculation - based on ORIGINAL stroke width so it doesn't jump on hover
                const baseSize = Math.max(sizeStrokeWidth * 4, 12);
                const size = Math.min(len / 2, baseSize * sizeMultiplier);

                const perpX = -uy * (size / 2);
                const perpY = ux * (size / 2);

                const commonMarkerProps = {
                    fill: ['filled-triangle', 'circle', 'square', 'diamond', 'field', 'broadhead', 'bodkin', 'bullet', 'target', 'fish'].includes(markerType) ? stroke : 'none',
                    stroke: stroke,
                    strokeWidth: drawStrokeWidth,
                    opacity: opacity,
                    strokeLinecap: "round" as "round",
                    strokeLinejoin: "round" as "round",
                };

                // Rotation transform for shapes defined at 0,0 pointing right
                const angle = Math.atan2(dy, dx) * 180 / Math.PI;
                const transform = `translate(${to.x}, ${to.y}) rotate(${angle})`;

                // Helper to render path in local coords
                const renderPath = (d: string, fillOverride?: string) => (
                    <path
                        d={d}
                        transform={transform}
                        {...commonMarkerProps}
                        fill={fillOverride || commonMarkerProps.fill}
                    />
                );

                switch (markerType) {
                    case 'bar':
                        return renderPath(`M 0 ${-size / 2} L 0 ${size / 2}`);

                    case 'triangle':
                    case 'filled-triangle':
                    case 'field': // Simple bullet/field point
                        return renderPath(`M 0 0 L ${-size} ${-size / 2} L ${-size} ${size / 2} Z`);

                    case 'broadhead': // Wide hunting tip
                        return renderPath(`M 0 0 L ${-size} ${-size * 0.8} L ${-size * 0.8} 0 L ${-size} ${size * 0.8} Z`);

                    case 'bodkin': // Long spike
                        return renderPath(`M 0 0 L ${-size * 1.5} ${-size / 4} L ${-size * 1.5} ${size / 4} Z`);

                    case 'blunt': // Flat tip
                        return renderPath(`M 0 ${-size / 2} L ${-size / 2} ${-size / 2} L ${-size / 2} ${size / 2} L 0 ${size / 2} Z`);

                    case 'judo': // Spring wire arms (simplified)
                        return (
                            <g transform={transform}>
                                <path d={`M 0 0 L ${-size} 0`} {...commonMarkerProps} />
                                <path d={`M ${-size / 2} 0 L ${-size / 4} ${-size / 2}`} {...commonMarkerProps} />
                                <path d={`M ${-size / 2} 0 L ${-size / 4} ${size / 2}`} {...commonMarkerProps} />
                            </g>
                        );

                    case 'bullet': // Rounded tip
                        return renderPath(`M 0 0 L ${-size} ${-size / 2} Q ${-size * 1.2} 0 ${-size} ${size / 2} Z`);

                    case 'target': // Conical
                        return renderPath(`M 0 0 L ${-size} ${-size / 3} L ${-size} ${size / 3} Z`);

                    case 'fish': // Harpoon/Barbed
                        return renderPath(`M 0 0 L ${-size} ${-size / 2} M 0 0 L ${-size} ${size / 2} M ${-size / 2} ${-size / 4} L ${-size} ${-size / 1.5} M ${-size / 2} ${size / 4} L ${-size} ${size / 1.5}`);

                    case 'flu-flu': // Large blunt/brush
                        return renderPath(`M 0 ${-size / 2} Q ${size / 2} 0 0 ${size / 2} L ${-size} ${size / 2} Q ${-size / 2} 0 ${-size} ${-size / 2} Z`);

                    case 'forked': // Crescent
                        return renderPath(`M ${-size / 2} 0 L ${size / 2} ${-size / 2} L ${size / 2} ${size / 2} Z`, 'none'); // Simplified crescent

                    case 'circle':
                        return <circle cx={to.x} cy={to.y} r={size / 2} {...commonMarkerProps} />;

                    case 'square':
                        return (
                            <rect
                                x={-size / 2} y={-size / 2}
                                width={size} height={size}
                                transform={transform}
                                {...commonMarkerProps}
                            />
                        );

                    case 'diamond':
                        return renderPath(`M 0 0 L ${-size / 2} ${-size / 2} L ${-size} 0 L ${-size / 2} ${size / 2} Z`);

                    // Tails / Nocks
                    case 'standard-nock':
                    case 'pin-nock':
                    case 'over-nock':
                    case 'self-nock':
                    case 'flat-nock':
                    case 'g-nock':
                        // Generic nock shape (U-shape)
                        return renderPath(`M 0 0 L ${size} ${size / 3} M 0 0 L ${size} ${-size / 3}`);

                    case 'symmetrical-fletching':
                        // Two vanes
                        return renderPath(`M ${size} ${-size / 4} L ${0} ${-size / 2} L ${size / 4} ${-size / 4} Z M ${size} ${size / 4} L ${0} ${size / 2} L ${size / 4} ${size / 4} Z`, stroke);

                    case 'offset-fletching':
                        // Angled vanes
                        return renderPath(`M ${size} ${-size / 4} L ${0} ${-size / 2} L ${size / 4} ${-size / 4} Z M ${size} ${size / 4} L ${0} ${size / 2} L ${size / 4} ${size / 4} Z`, stroke);

                    case 'helical-fletching':
                        // Curved vanes
                        return renderPath(`M ${size} ${-size / 4} Q ${size / 2} ${-size / 2} 0 ${-size / 2} L ${size / 4} ${-size / 4} Z M ${size} ${size / 4} Q ${size / 2} ${size / 2} 0 ${size / 2} L ${size / 4} ${size / 4} Z`, stroke);

                    case 'flu-flu-fletching':
                        // Large bushy feathers
                        return renderPath(`M ${size} 0 L ${0} ${-size} L ${size / 2} 0 L ${0} ${size} Z`, stroke);

                    default:
                        return null;
                }
            };

            // If polyline points exist, render polyline plus arrow head/tail at the ends
            if (shape.points && shape.points.length >= 2) {
                const pts = shape.points;
                const polyPoints = pts.map(p => `${p.x},${p.y}`).join(' ');
                const first = pts[0];
                const second = pts[1];
                const last = pts[pts.length - 1];
                const prev = pts[pts.length - 2];
                return (
                    <g>
                        <polyline
                            points={polyPoints}
                            fill="none"
                            stroke={commonProps.stroke}
                            strokeWidth={commonProps.strokeWidth}
                            opacity={commonProps.opacity}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeDasharray={commonProps.strokeDasharray}
                        />
                        {renderArrowMarker(prev, last, headType, commonProps.stroke as string, commonProps.strokeWidth as number, originalStrokeWidth, commonProps.opacity as number, headSizeMult)}
                        {renderArrowMarker(second, first, tailType, commonProps.stroke as string, commonProps.strokeWidth as number, originalStrokeWidth, commonProps.opacity as number, tailSizeMult)}
                    </g>
                );
            }

            // Legacy straight arrow
            const arrowHeadLen = (headType !== 'none' ? Math.max(strokeWidth * 4, 12) * headSizeMult : 0);
            const arrowTailLen = (tailType !== 'none' ? Math.max(strokeWidth * 4, 12) * tailSizeMult : 0);

            const startPoint = { x: -shape.width / 2, y: 0 };
            const endPoint = { x: shape.width / 2, y: 0 };

            // Adjust line start/end to not overlap with markers if needed, but usually markers attach to end
            // For simple implementation, we draw line full length and markers on top

            return (
                <g>
                    <line
                        x1={startPoint.x}
                        y1={startPoint.y}
                        x2={endPoint.x}
                        y2={endPoint.y}
                        stroke={commonProps.stroke}
                        strokeWidth={commonProps.strokeWidth}
                        opacity={commonProps.opacity}
                        strokeDasharray={commonProps.strokeDasharray}
                    />
                    {renderArrowMarker(
                        startPoint, // from
                        endPoint,   // to
                        headType,
                        commonProps.stroke as string,
                        commonProps.strokeWidth as number,
                        originalStrokeWidth,
                        commonProps.opacity as number,
                        headSizeMult
                    )}
                    {renderArrowMarker(
                        endPoint,   // from
                        startPoint, // to
                        tailType,
                        commonProps.stroke as string,
                        commonProps.strokeWidth as number,
                        originalStrokeWidth,
                        commonProps.opacity as number,
                        tailSizeMult
                    )}
                </g>
            );
        }

        return null;
    };

    const transform = `translate(${shape.x}, ${shape.y}) rotate(${shape.rotation})`;

    // Render gradient definitions
    const renderGradientDef = () => {
        if (shape.fillType !== 'gradient') return null;

        const colors = shape.gradientColors || ['#ffffff', '#000000'];
        const angle = shape.gradientAngle || 0;

        if (shape.gradientType === 'radial') {
            return (
                <radialGradient id={gradientId}>
                    <stop offset="0%" stopColor={colors[0]} />
                    <stop offset="100%" stopColor={colors[1]} />
                </radialGradient>
            );
        } else {
            // Linear gradient
            const angleRad = (angle * Math.PI) / 180;
            const x1 = 50 - 50 * Math.cos(angleRad);
            const y1 = 50 - 50 * Math.sin(angleRad);
            const x2 = 50 + 50 * Math.cos(angleRad);
            const y2 = 50 + 50 * Math.sin(angleRad);

            return (
                <linearGradient id={gradientId} x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`}>
                    <stop offset="0%" stopColor={colors[0]} />
                    <stop offset="100%" stopColor={colors[1]} />
                </linearGradient>
            );
        }
    };

    // Render hatch pattern definitions
    const renderHatchDef = () => {
        if (shape.fillType !== 'hatch') return null;

        const pattern = shape.hatchPattern || 'horizontal';
        const spacing = shape.hatchSpacing || 5;
        const color = shape.hatchColor || '#000000';

        return (
            <pattern id={hatchId} patternUnits="userSpaceOnUse" width={spacing * 2} height={spacing * 2}>
                <rect width={spacing * 2} height={spacing * 2} fill="transparent" />
                {pattern === 'horizontal' && (
                    <line x1="0" y1={spacing} x2={spacing * 2} y2={spacing} stroke={color} strokeWidth="1" />
                )}
                {pattern === 'vertical' && (
                    <line x1={spacing} y1="0" x2={spacing} y2={spacing * 2} stroke={color} strokeWidth="1" />
                )}
                {pattern === 'diagonal-right' && (
                    <>
                        <line x1="0" y1="0" x2={spacing * 2} y2={spacing * 2} stroke={color} strokeWidth="1" />
                        <line x1="0" y1={spacing * 2} x2={spacing * 2} y2="0" stroke={color} strokeWidth="1" />
                    </>
                )}
                {pattern === 'diagonal-left' && (
                    <>
                        <line x1="0" y1={spacing * 2} x2={spacing * 2} y2="0" stroke={color} strokeWidth="1" />
                        <line x1="0" y1="0" x2={spacing * 2} y2={spacing * 2} stroke={color} strokeWidth="1" />
                    </>
                )}
                {pattern === 'cross' && (
                    <>
                        <line x1="0" y1={spacing} x2={spacing * 2} y2={spacing} stroke={color} strokeWidth="1" />
                        <line x1={spacing} y1="0" x2={spacing} y2={spacing * 2} stroke={color} strokeWidth="1" />
                    </>
                )}
                {pattern === 'diagonal-cross' && (
                    <>
                        <line x1="0" y1="0" x2={spacing * 2} y2={spacing * 2} stroke={color} strokeWidth="1" />
                        <line x1={spacing * 2} y1="0" x2="0" y2={spacing * 2} stroke={color} strokeWidth="1" />
                    </>
                )}
                {pattern === 'dots' && (
                    <>
                        <circle cx={spacing / 2} cy={spacing / 2} r="1" fill={color} />
                        <circle cx={spacing * 1.5} cy={spacing * 1.5} r="1" fill={color} />
                    </>
                )}
                {pattern === 'grid' && (
                    <>
                        <line x1="0" y1={spacing} x2={spacing * 2} y2={spacing} stroke={color} strokeWidth="1" />
                        <line x1={spacing} y1="0" x2={spacing} y2={spacing * 2} stroke={color} strokeWidth="1" />
                    </>
                )}
            </pattern>
        );
    };

    // Render image pattern definition
    const renderImageDef = () => {
        if (shape.fillType !== 'image' || !shape.fillImage) return null;

        const scale = shape.fillImageScale || 1;
        const size = 100 * scale;

        return (
            <pattern id={patternId} patternUnits="userSpaceOnUse" width={size} height={size}>
                <image href={shape.fillImage} x="0" y="0" width={size} height={size} preserveAspectRatio="xMidYMid slice" />
            </pattern>
        );
    };

    return (
        <>
            {/* Define gradients, patterns, and hatches */}
            <defs>
                {renderGradientDef()}
                {renderHatchDef()}
                {renderImageDef()}
            </defs>

            <g transform={transform} style={{ cursor: 'pointer' }}>
                {/* Render highlight behind the shape */}
                {showHighlight && renderShape(true)}
                {/* Render actual shape */}
                {renderShape(false)}
            </g>
        </>
    );
}
