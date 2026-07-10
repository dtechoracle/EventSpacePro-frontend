"use client";

import React from 'react';
import { Shape, useProjectStore } from '@/store/projectStore';
import { useEditorStore } from '@/store/editorStore';

interface ShapeRendererProps {
    shape: Shape;
    isSelected?: boolean;
    isHovered?: boolean;
    isHighlightOnly?: boolean;
}

const ShapeRenderer = ({ shape, isSelected = false, isHovered = false, isHighlightOnly = false }: ShapeRendererProps) => {
    const isSelectedOrHovered = isSelected || isHovered;
    const hasDashes = shape.lineType === 'dashed' || shape.lineType === 'dotted';
    
    const zoom = useEditorStore(s => {
        if (isSelectedOrHovered || hasDashes) {
            return s.zoom;
        }
        return 1;
    });

    return (
        <InnerShapeRenderer 
            shape={shape} 
            isSelected={isSelected} 
            isHovered={isHovered} 
            isHighlightOnly={isHighlightOnly} 
            zoom={zoom} 
        />
    );
};

const InnerShapeRenderer = ({ shape, isSelected = false, isHovered = false, isHighlightOnly = false, zoom }: ShapeRendererProps & { zoom: number }) => {
    const activeTool = useEditorStore(s => s.activeTool);
    const globalTableFontSize = useProjectStore(s => s.globalTableNumberingFontSize);
    const globalTableFontFamily = useProjectStore(s => s.globalTableNumberingFontFamily);
    const globalTableFontWeight = useProjectStore(s => s.globalTableNumberingFontWeight);
    const globalTableFontStyle = useProjectStore(s => s.globalTableNumberingFontStyle);
    const globalTableTextDecoration = useProjectStore(s => s.globalTableNumberingTextDecoration);
    const globalTableColor = useProjectStore(s => s.globalTableNumberingColor);
    
    // Default pure black stroke so new shapes/lines pop clearly
    const strokeColor = shape.stroke || '#000000';
    const fillColor = shape.fill || 'transparent';
    // Ensure strokeWidth is always a valid number, defaulting to 1 (or 3 for arrows) if undefined/null
    const strokeWidth = (shape.strokeWidth !== undefined && shape.strokeWidth !== null)
        ? shape.strokeWidth
        : (shape.type === 'arrow' ? 3 : 1);

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
        } else if (fillType === 'none') {
            return 'transparent';
        } else if (fillType === 'hatch' || fillType === 'texture' || fillType === 'hash') {
            const scale = shape.fillTextureScale || 4;
            const thickness = shape.fillTextureThickness || 1;
            if (shape.fillTexture) {
                const rotation = shape.hatchRotation || 0;
            return `url(#${shape.fillTexture}-scale-${scale}-thick-${thickness}-rot-${rotation})`;
            }
            if (fillType === 'hatch' || fillType === 'hash') {
                return `url(#${hatchId})`;
            }
            return fillColor;
        } else if (fillType === 'image' && shape.fillImage) {
            return `url(#${patternId})`;
        } else {
            return fillColor;
        }
    };

    const renderPrimitive = (isHighlight: boolean, overrideProps: any = {}) => {
        // Determine strokeDasharray based on lineType
        let dashArray = shape.strokeDasharray;
        if (shape.lineType === 'dashed') {
            dashArray = `${10 / zoom},${10 / zoom}`;
        } else if (shape.lineType === 'dotted') {
            dashArray = `${2 / zoom},${5 / zoom}`;
        } else if (shape.lineType === 'solid' || !shape.lineType) {
            dashArray = undefined;
        }

        const commonProps = {
            fill: getFillValue(isHighlight),
            stroke: isHighlight ? highlightColor : strokeColor,
            strokeWidth: isHighlight ? strokeWidth + 4 : strokeWidth,
            opacity: isHighlight ? 0.8 : 1,
            strokeDasharray: shape.lineType !== 'double' ? dashArray : undefined,
            vectorEffect: 'non-scaling-stroke',
            style: { pointerEvents: shape.id === 'background-texture' ? 'none' : 'auto' } as React.CSSProperties,
            'data-id': shape.id,
            ...overrideProps
        };

        if ((shape.type as string) === 'image') {
            return (
                <g data-id={shape.id}>
                    <image
                        href={shape.fillImage}
                        x={-shape.width / 2}
                        y={-shape.height / 2}
                        width={shape.width}
                        height={shape.height}
                        preserveAspectRatio="none"
                        opacity={isHighlight ? 0.8 : ((shape as any).opacity !== undefined ? (shape as any).opacity : 1)}
                        style={{ pointerEvents: 'auto' } as React.CSSProperties}
                        data-id={shape.id}
                    />
                    {showHighlight && (
                        <rect
                            x={-shape.width / 2}
                            y={-shape.height / 2}
                            width={shape.width}
                            height={shape.height}
                            fill="none"
                            stroke={isHighlight ? highlightColor : '#3b82f6'}
                            strokeWidth={isHighlight ? 3 : 1.5}
                            strokeDasharray={isHighlight ? undefined : '5,5'}
                            data-id={shape.id}
                        />
                    )}
                </g>
            );
        }

        if (shape.type === 'rectangle') {
            return (
                <rect
                    x={-shape.width / 2}
                    y={-shape.height / 2}
                    width={shape.width}
                    height={shape.height}
                    rx={shape.borderRadius || 0}
                    ry={shape.borderRadius || 0}
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
                <g data-id={shape.id}>
                    <polygon
                        points={pointsStr}
                        {...commonProps}
                    />
                    {!isHighlight && isSelected && pts.map((p, i) => (
                        <circle
                            key={i}
                            cx={p.x}
                            cy={p.y}
                            r={4 / zoom}
                            fill="#ffffff"
                            stroke="#3b82f6"
                            strokeWidth={1.5 / zoom}
                            className="cursor-move"
                            data-id={shape.id}
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
                    const gapWidth = Math.max(2, commonProps.strokeWidth / 2);
                    const outerWidth = commonProps.strokeWidth * 3; // Total width

                    return (
                        <g data-id={shape.id}>
                            {/* Outer/Bottom thick line */}
                            <polyline
                                points={points}
                                fill={commonProps.fill}
                                stroke={commonProps.stroke}
                                strokeWidth={outerWidth}
                                opacity={commonProps.opacity}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                data-id={shape.id}
                            />
                            {/* Inner "gap" line - using white for now */}
                            <polyline
                                points={points}
                                fill={commonProps.fill}
                                stroke="#ffffff" // Assuming white background
                                strokeWidth={gapWidth}
                                opacity={1}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                data-id={shape.id}
                            />

                            {/* Control points for polyline */}
                            {!isHighlight && isSelected && shape.points.map((p, i) => (
                                <circle
                                    key={i}
                                    cx={p.x}
                                    cy={p.y}
                                    r={4 / zoom}
                                    fill="#ffffff"
                                    stroke="#3b82f6"
                                    strokeWidth={1.5 / zoom}
                                    className="cursor-move"
                                    data-id={shape.id}
                                />
                            ))}
                        </g>
                    );
                }

                return (
                    <g data-id={shape.id}>
                        <polyline
                            points={points}
                            fill={commonProps.fill}
                            stroke={commonProps.stroke}
                            strokeWidth={commonProps.strokeWidth}
                            opacity={commonProps.opacity}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeDasharray={commonProps.strokeDasharray}
                            data-id={shape.id}
                        />
                        {/* Control points for polyline */}
                        {!isHighlight && isSelected && shape.points.map((p, i) => (
                            <circle
                                key={i}
                                cx={p.x}
                                cy={p.y}
                                r={4 / zoom}
                                fill="#ffffff"
                                stroke="#3b82f6"
                                strokeWidth={1.5 / zoom}
                                className="cursor-move"
                                data-id={shape.id}
                            />
                        ))}
                    </g>
                );
            }

            // Fallback: legacy straight line using width / rotation.
            return (
                <g data-id={shape.id}>
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
                                r={4 / zoom}
                                fill="#ffffff"
                                stroke="#3b82f6"
                                strokeWidth={1.5 / zoom}
                                className="cursor-move"
                                data-id={shape.id}
                            />
                            <circle
                                cx={shape.width / 2}
                                cy={0}
                                r={4 / zoom}
                                fill="#ffffff"
                                stroke="#3b82f6"
                                strokeWidth={1.5 / zoom}
                                className="cursor-move"
                                data-id={shape.id}
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

                // Base size calculation - based on ORIGINAL stroke width so it doesn't jump on hover
                const baseSize = Math.max(sizeStrokeWidth * 4, 12);
                const size = Math.min(len / 2, baseSize * sizeMultiplier);

                const commonMarkerProps = {
                    fill: ['filled-triangle', 'circle', 'square', 'diamond', 'field', 'broadhead', 'bodkin', 'bullet', 'target', 'fish'].includes(markerType) ? stroke : 'none',
                    stroke: stroke,
                    strokeWidth: drawStrokeWidth,
                    opacity: opacity,
                    strokeLinecap: "round" as "round",
                    strokeLinejoin: "round" as "round",
                    'data-id': shape.id,
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
                            <g transform={transform} data-id={shape.id}>
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
                    <g data-id={shape.id}>
                        <polyline
                            points={polyPoints}
                            fill={commonProps.fill}
                            stroke={commonProps.stroke}
                            strokeWidth={commonProps.strokeWidth}
                            opacity={commonProps.opacity}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeDasharray={commonProps.strokeDasharray}
                            data-id={shape.id}
                        />
                        {renderArrowMarker(prev, last, headType, commonProps.stroke as string, commonProps.strokeWidth as number, originalStrokeWidth, commonProps.opacity as number, headSizeMult)}
                        {renderArrowMarker(second, first, tailType, commonProps.stroke as string, commonProps.strokeWidth as number, originalStrokeWidth, commonProps.opacity as number, tailSizeMult)}
                    </g>
                );
            }

            // Legacy straight arrow
            const startPoint = { x: -shape.width / 2, y: 0 };
            const endPoint = { x: shape.width / 2, y: 0 };

            return (
                <g data-id={shape.id}>
                    <line
                        x1={startPoint.x}
                        y1={startPoint.y}
                        x2={endPoint.x}
                        y2={endPoint.y}
                        stroke={commonProps.stroke}
                        strokeWidth={commonProps.strokeWidth}
                        opacity={commonProps.opacity}
                        strokeDasharray={commonProps.strokeDasharray}
                        data-id={shape.id}
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

        if (shape.type === 'arc' && shape.points && shape.points.length >= 3) {
            // compound arc (>3 points)
            if (shape.points.length > 3 && shape.points.length % 2 === 1) {
                const pts = shape.points;
                let d = `M ${pts[0].x} ${pts[0].y}`;
                for (let i = 1; i < pts.length - 1; i += 2) {
                    const start = pts[i - 1];
                    const passThrough = pts[i];
                    const next = pts[i + 1];

                    const qcx = 2 * passThrough.x - (start.x + next.x) / 2;
                    const qcy = 2 * passThrough.y - (start.y + next.y) / 2;

                    d += ` Q ${qcx} ${qcy} ${next.x} ${next.y}`;
                }

                return (
                    <g data-id={shape.id}>
                        <path
                            d={d}
                            {...commonProps}
                            stroke={commonProps.stroke}
                        />
                        {!isHighlight && isSelected && pts.map((p, i) => (
                            <circle
                                key={i}
                                cx={p.x} cy={p.y} r={4 / zoom}
                                fill={i % 2 === 0 ? '#ffffff' : '#fbbf24'}
                                stroke={i % 2 === 0 ? '#3b82f6' : '#f59e0b'}
                                strokeWidth={1.5 / zoom}
                                className="cursor-move"
                                data-id={shape.id}
                            />
                        ))}
                    </g>
                );
            }

            // Single quadratic-bezier arc (exactly 3 points)
            const [p1, p2, p3] = shape.points;
            const qcx = 2 * p2.x - (p1.x + p3.x) / 2;
            const qcy = 2 * p2.y - (p1.y + p3.y) / 2;
            const pathData = `M ${p1.x} ${p1.y} Q ${qcx} ${qcy} ${p3.x} ${p3.y}`;

            return (
                <g data-id={shape.id}>
                    <path
                        d={pathData}
                        {...commonProps}
                        stroke={commonProps.stroke}
                    />
                    {!isHighlight && isSelected && shape.points.map((p, i) => (
                        <circle
                            key={i}
                            cx={p.x} cy={p.y} r={4 / zoom}
                            fill={i === 2 ? '#fbbf24' : '#ffffff'}
                            stroke={i === 2 ? '#f59e0b' : '#3b82f6'}
                            strokeWidth={1.5 / zoom}
                            className="cursor-move"
                            data-id={shape.id}
                        />
                    ))}
                </g>
            );
        }

        if (shape.type === 'freehand' && shape.points && shape.points.length >= 2) {
            const pathData = `M ${shape.points[0].x} ${shape.points[0].y} ` +
                shape.points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');

            return (
                <path
                    d={pathData}
                    {...commonProps}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            );
        }

        if (shape.type === 'path' && shape.svgPath) {
            return (
                <path
                    d={shape.svgPath}
                    {...commonProps}
                />
            );
        }

        return null;
    };

    const scaleX = (shape as any).flipX ? -1 : 1;
    const scaleY = (shape as any).flipY ? -1 : 1;
    const transform = `translate(${shape.x}, ${shape.y}) rotate(${shape.rotation}) scale(${scaleX}, ${scaleY})`;


    // Render gradient definitions
    const renderGradientDef = () => {
        if (shape.fillType !== 'gradient') return null;

        const colors = shape.gradientColors || ['#ffffff', '#000000'];
        const angle = shape.gradientAngle || 0;

        if (shape.gradientType === 'radial') {
            return (
                <radialGradient id={gradientId} data-id={shape.id}>
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
                <linearGradient id={gradientId} x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`} data-id={shape.id}>
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
        const spacing = (shape.hatchSpacing || 25) * (shape.fillTextureScale || 4);
        const color = shape.hatchColor || '#000000';
        const strokeWidth = shape.hatchThickness || 1;

        return (
            <pattern 
                id={hatchId} 
                patternUnits="userSpaceOnUse" 
                width={spacing * 2} 
                height={spacing * 2} 
                patternTransform={`rotate(${(shape as any).hatchRotation || 0})`}
                data-id={shape.id}
            >
                <rect width={spacing * 2} height={spacing * 2} fill="transparent" data-id={shape.id} />
                {pattern === 'horizontal' && (
                    <line x1="0" y1={spacing} x2={spacing * 2} y2={spacing} stroke={color} strokeWidth={strokeWidth} data-id={shape.id} />
                )}
                {pattern === 'vertical' && (
                    <line x1={spacing} y1="0" x2={spacing} y2={spacing * 2} stroke={color} strokeWidth={strokeWidth} data-id={shape.id} />
                )}
                {pattern === 'diagonal-right' && (
                    <line x1="0" y1={spacing * 2} x2={spacing * 2} y2="0" stroke={color} strokeWidth={strokeWidth} data-id={shape.id} />
                )}
                {pattern === 'diagonal-left' && (
                    <line x1="0" y1="0" x2={spacing * 2} y2={spacing * 2} stroke={color} strokeWidth={strokeWidth} data-id={shape.id} />
                )}
                {pattern === 'cross' && (
                    <>
                        <line x1="0" y1={spacing} x2={spacing * 2} y2={spacing} stroke={color} strokeWidth={strokeWidth} data-id={shape.id} />
                        <line x1={spacing} y1="0" x2={spacing} y2={spacing * 2} stroke={color} strokeWidth={strokeWidth} data-id={shape.id} />
                    </>
                )}
                {pattern === 'diagonal-cross' && (
                    <>
                        <line x1="0" y1="0" x2={spacing * 2} y2={spacing * 2} stroke={color} strokeWidth={strokeWidth} data-id={shape.id} />
                        <line x1={spacing * 2} y1="0" x2="0" y2={spacing * 2} stroke={color} strokeWidth={strokeWidth} data-id={shape.id} />
                    </>
                )}
                {pattern === 'dots' && (
                    <>
                        <circle cx={spacing / 2} cy={spacing / 2} r={strokeWidth} fill={color} data-id={shape.id} />
                        <circle cx={spacing * 1.5} cy={spacing * 1.5} r={strokeWidth} fill={color} data-id={shape.id} />
                    </>
                )}

                {pattern === 'brick' && (
                    <>
                        <line x1="0" y1={spacing} x2={spacing * 2} y2={spacing} stroke={color} strokeWidth={strokeWidth} data-id={shape.id} />
                        <line x1={spacing} y1="0" x2={spacing} y2={spacing} stroke={color} strokeWidth={strokeWidth} data-id={shape.id} />
                        <line x1="0" y1={spacing} x2={0} y2={spacing * 2} stroke={color} strokeWidth={strokeWidth} data-id={shape.id} />
                        <path d={`M 0,${spacing} H ${spacing * 2} M 0,${spacing * 2} H ${spacing * 2} M ${spacing},0 V ${spacing} M 0,${spacing} V ${spacing * 2} M ${spacing * 2},${spacing} V ${spacing * 2}`} stroke={color} strokeWidth="1" fill={getFillValue(false)} data-id={shape.id} />
                    </>
                )}
            </pattern>
        );
    };

    // Render image pattern definition
    const renderImageDef = () => {
        if (shape.fillType !== 'image' || !shape.fillImage) return null;

        const scale = shape.fillImageScale || 1;
        const tileW = Math.max(1, 1024 * scale);
        const tileH = Math.max(1, 1024 * scale);

        return (
            <pattern id={patternId} patternUnits="userSpaceOnUse"
                x={-shape.width / 2} y={-shape.height / 2}
                width={tileW} height={tileH} data-id={shape.id}>
                <image href={shape.fillImage} x="0" y="0"
                    width={tileW} height={tileH}
                    preserveAspectRatio="xMidYMid slice" data-id={shape.id} />
            </pattern>
        );
    };

    return (
        <>
            {/* Define gradients, patterns, and hatches */}
            <defs data-id={shape.id}>
                {renderGradientDef()}
                {renderHatchDef()}
                {renderImageDef()}
            </defs>

            <g 
                transform={transform} 
                className={activeTool === 'select' || activeTool === 'trim-to-blend' ? 'cursor-pointer' : ''}
                style={{ 
                    color: shape.hatchColor || shape.fill || '#000000'
                }}
                data-id={shape.id}
            >
                {/* Render only the component requested by the layer */}
                {isHighlightOnly ? (
                    showHighlight && renderPrimitive(true)
                ) : (
                    <>
                        {/* Render actual shape */}
                        {renderPrimitive(false)}

                        {/* Table Numbering / Labeling (Billboarded) */}
                        {shape.tableName && (
                            <g transform={`rotate(${-shape.rotation})`}>
                                <circle
                                    cx={0}
                                    cy={0}
                                    r={Math.max(16, (shape.width || 100) * 0.12)}
                                    fill="white"
                                    stroke="#000000"
                                    strokeWidth={Math.max(1.5, (shape.width || 100) * 0.01)}
                                    pointerEvents="none"
                                    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}
                                />
                                <text
                                    x={0}
                                    y={0}
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    fontSize={(shape as any).tableNumberingFontSize || globalTableFontSize || Math.max(14, (shape.width || 100) * 0.14)}
                                    fill={(shape as any).tableNumberingColor || globalTableColor || '#000000'}
                                    fontWeight={(shape as any).tableNumberingFontWeight || globalTableFontWeight || '900'}
                                    fontStyle={(shape as any).tableNumberingFontStyle || globalTableFontStyle || 'normal'}
                                    textDecoration={(shape as any).tableNumberingTextDecoration || globalTableTextDecoration || 'none'}
                                    pointerEvents="none"
                                    style={{
                                        userSelect: 'none',
                                        fontFamily: (shape as any).tableNumberingFontFamily || globalTableFontFamily || 'Inter, sans-serif'
                                    }}
                                >
                                    {shape.tableName}
                                </text>
                            </g>
                        )}
                    </>
                )}
            </g>
        </>
    );

};

export default React.memo(ShapeRenderer);
