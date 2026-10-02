"use client";

import React from 'react';
import { LabelArrow, useProjectStore } from '@/store/projectStore';
import { useEditorStore } from '@/store/editorStore';

interface LabelArrowRendererProps {
    arrow: LabelArrow;
    zoom: number;
    isSelected?: boolean;
    isHovered?: boolean;
    isHighlightOnly?: boolean;
}

type MarkerType = NonNullable<LabelArrow['arrowHeadType']>;

function markerLabel(type: MarkerType | undefined) {
    return type || 'none';
}

export default function LabelArrowRenderer({ arrow, zoom, isSelected, isHovered, isHighlightOnly }: LabelArrowRendererProps) {
    const editingTextId = useEditorStore(s => s.editingTextId);
    const updateLabelArrow = useProjectStore(s => s.updateLabelArrow);
    const setEditingTextId = useEditorStore(s => s.setEditingTextId);
    const dx = arrow.endPoint.x - arrow.startPoint.x;
    const dy = arrow.endPoint.y - arrow.startPoint.y;
    const length = Math.hypot(dx, dy);
    if (length < 0.01) return null;

    const safeZoom = Math.max(zoom, 0.01);
    const ux = dx / length;
    const uy = dy / length;
    const perpX = -uy;
    const perpY = ux;
    const color = arrow.color || '#000000';
    const strokeWidth = arrow.strokeWidth || 3;
    const headType = markerLabel(arrow.arrowHeadType || 'filled-triangle');
    const tailType = markerLabel(arrow.arrowTailType || 'none');
    const headSize = arrow.arrowHeadSize || 20;
    const tailSize = arrow.arrowTailSize || 20;

    const renderMarker = (
        type: MarkerType,
        point: { x: number; y: number },
        dir: { x: number; y: number },
        size: number,
        key: string
    ) => {
        if (type === 'none') return null;

        const px = -dir.y;
        const py = dir.x;
        const baseX = point.x - dir.x * size;
        const baseY = point.y - dir.y * size;
        const side = size * 0.48;
        const markerStroke = Math.max(1.5, strokeWidth);

        if (type === 'triangle' || type === 'filled-triangle') {
            return (
                <polygon
                    key={key}
                    points={`${point.x},${point.y} ${baseX + px * side},${baseY + py * side} ${baseX - px * side},${baseY - py * side}`}
                    fill={type === 'filled-triangle' ? color : '#ffffff'}
                    stroke={color}
                    strokeWidth={markerStroke}
                    vectorEffect="non-scaling-stroke"
                    strokeLinejoin="round"
                />
            );
        }

        if (type === 'open') {
            return (
                <path
                    key={key}
                    d={`M ${point.x} ${point.y} L ${baseX + px * side} ${baseY + py * side} M ${point.x} ${point.y} L ${baseX - px * side} ${baseY - py * side}`}
                    fill="none"
                    stroke={color}
                    strokeWidth={markerStroke}
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                />
            );
        }

        if (type === 'circle') {
            return (
                <circle
                    key={key}
                    cx={point.x}
                    cy={point.y}
                    r={size * 0.36}
                    fill="#ffffff"
                    stroke={color}
                    strokeWidth={markerStroke}
                    vectorEffect="non-scaling-stroke"
                />
            );
        }

        if (type === 'square') {
            const squareSize = size * 0.72;
            return (
                <rect
                    key={key}
                    x={point.x - squareSize / 2}
                    y={point.y - squareSize / 2}
                    width={squareSize}
                    height={squareSize}
                    fill="#ffffff"
                    stroke={color}
                    strokeWidth={markerStroke}
                    vectorEffect="non-scaling-stroke"
                    transform={`rotate(${Math.atan2(dir.y, dir.x) * 180 / Math.PI} ${point.x} ${point.y})`}
                />
            );
        }

        if (type === 'diamond') {
            const backX = point.x - dir.x * size;
            const backY = point.y - dir.y * size;
            const centerX = point.x - dir.x * size * 0.5;
            const centerY = point.y - dir.y * size * 0.5;
            return (
                <polygon
                    key={key}
                    points={`${point.x},${point.y} ${centerX + px * side},${centerY + py * side} ${backX},${backY} ${centerX - px * side},${centerY - py * side}`}
                    fill="#ffffff"
                    stroke={color}
                    strokeWidth={markerStroke}
                    vectorEffect="non-scaling-stroke"
                    strokeLinejoin="round"
                />
            );
        }

        return (
            <line
                key={key}
                x1={point.x + px * size * 0.5}
                y1={point.y + py * size * 0.5}
                x2={point.x - px * size * 0.5}
                y2={point.y - py * size * 0.5}
                stroke={color}
                strokeWidth={markerStroke}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
            />
        );
    };

    const labelPosition = arrow.textPosition || 'bottom';
    let labelX = arrow.startPoint.x + dx * 0.5;
    let labelY = arrow.startPoint.y + dy * 0.5;
    
    const fontSize = arrow.fontSize || 120;
    const labelStr = arrow.label || '';
    const rectPadH = fontSize * 0.5;
    const rectWidth = Math.max(fontSize * 2, labelStr.length * fontSize * 0.62 + rectPadH * 2);

    const offsetMag = fontSize / 2 + 10;
    let textAngle = Math.atan2(dy, dx) * (180 / Math.PI);
    let px = -uy;
    let py = ux;
    if (textAngle > 90 || textAngle < -90) {
        textAngle += 180;
        px = uy;
        py = -ux;
    }
    
    if (labelPosition === 'bottom') {
        labelX += px * offsetMag;
        labelY += py * offsetMag;
    } else if (labelPosition === 'top') {
        labelX -= px * offsetMag;
        labelY -= py * offsetMag;
    }

    const fontFamily = arrow.fontFamily || 'Inter, sans-serif';
    const fontWeight = arrow.fontWeight || '700';
    const fontStyle = arrow.fontStyle || 'normal';
    const textDecoration = arrow.textDecoration || 'none';
    const rectPadV = fontSize * 0.35;
    const rectHeight = fontSize + rectPadV * 2;
    const label = labelStr; // Map to the one declared above


    
    const highlightColor = '#3b82f6';
    const showHighlight = isHovered || isSelected;

    if (isHighlightOnly) {
        if (!showHighlight) return null;
        return (
            <g data-id={arrow.id}>
                <line
                    x1={arrow.startPoint.x}
                    y1={arrow.startPoint.y}
                    x2={arrow.endPoint.x}
                    y2={arrow.endPoint.y}
                    stroke={highlightColor}
                    strokeWidth={strokeWidth + 4}
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                    opacity={0.8}
                />
            </g>
        );
    }

    return (
        <g data-id={arrow.id}>

            <line
                x1={arrow.startPoint.x}
                y1={arrow.startPoint.y}
                x2={arrow.endPoint.x}
                y2={arrow.endPoint.y}
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
            />

            {renderMarker(headType, arrow.endPoint, { x: ux, y: uy }, headSize, 'head')}
            {renderMarker(tailType, arrow.startPoint, { x: -ux, y: -uy }, tailSize, 'tail')}

            <g transform={`translate(${labelX}, ${labelY}) rotate(${textAngle})`}>
                <rect
                    x={-rectWidth / 2}
                    y={-rectHeight / 2}
                    width={rectWidth}
                    height={rectHeight}
                    fill={arrow.backgroundColor || '#ffffff'}
                    rx={fontSize * 0.12}
                    opacity="0.96"
                    stroke="rgba(15, 23, 42, 0.08)"
                    style={{ filter: 'drop-shadow(0px 1px 2px rgba(0,0,0,0.12))' }}
                />
                                {editingTextId === arrow.id ? (
                    <foreignObject
                        x={-rectWidth / 2}
                        y={-rectHeight / 2}
                        width={rectWidth + 40}
                        height={rectHeight}
                        style={{ overflow: 'visible' }}
                    >
                        <input
                            type="text"
                            defaultValue={label}
                            autoFocus
                            onMouseDown={(e) => e.stopPropagation()}
                            onFocus={(e) => {
                                const val = e.target.value;
                                e.target.value = '';
                                e.target.value = val;
                            }}
                            onChange={(e) => {
                                updateLabelArrow(arrow.id, { label: e.target.value });
                            }}
                            onBlur={() => {
                                setEditingTextId(null);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === 'Escape') {
                                    e.preventDefault();
                                    e.currentTarget.blur();
                                }
                            }}
                            style={{
                                width: '100%',
                                height: '100%',
                                fontSize: `${fontSize}px`,
                                fontWeight,
                                fontStyle,
                                textDecoration,
                                color: color,
                                background: 'transparent',
                                border: 'none',
                                outline: 'none',
                                textAlign: 'center',
                                fontFamily
                            }}
                        />
                    </foreignObject>
                ) : (
                    <text
                        x="0"
                        y="1"
                        fontSize={fontSize}
                        fontWeight={fontWeight}
                        fontStyle={fontStyle}
                        textDecoration={textDecoration}
                        fill={color}
                        dominantBaseline="middle"
                        textAnchor="middle"
                        fontFamily={fontFamily}
                    >
                        {label}
                    </text>
                )}
            </g>
        </g>
    );
}
