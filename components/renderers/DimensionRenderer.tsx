import React from 'react';
import { Dimension } from '@/store/projectStore';
import { useSceneStore } from '@/store/sceneStore';

interface DimensionRendererProps {
    dimension: Dimension;
    zoom: number;
}

export const DimensionRenderer: React.FC<DimensionRendererProps> = ({ dimension, zoom }) => {
    const unitSystem = useSceneStore(s => s.unitSystem) || 'metric-mm';

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

    const color = '#333333'; 
    const strokeWidth = 2; 

    const { 
        startPoint, 
        endPoint, 
        offset,
        fontSize,
        value, 
        textPosition = 'inbetween' 
    } = dimension;

    if (!startPoint || !endPoint) return null;

    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length === 0) return null;

    // --- 1. THE FIXED WORLD GAP ---
    // Enforcing 100,000 units so the gap NEVER visually "grows/reduces" abnormally 
    // when you zoom like the old '/ zoom' logic did. It stays perfectly 
    // proportionally away from the element like you asked.
    const finalOffset = (offset && offset >= 100000) ? offset : 100000;

    // --- 2. THE UI "101 VANISHING" FIX (SMART SCALING) ---
    // The text didn't change from 12 to 100 because I was stubbornly clamping it to 25,000. 
    // When you finally reached 101, the clamp turned off, passing literal "101" world units 
    // to the renderer. 101 is a microscopic grain of dust compared to a 100,000 unit gap, so it vanished!
    //
    // FIX: I now map your normal sidebar numbers (12, 13, 24, etc.) as MULTIPLIERS. 
    // 12 is the 1.0 (baseline 25,000). 24 is twice as big (50,000). 
    // Now EVERY single click up or down in the sidebar will perfectly scale the text visually!
    const uiFont = fontSize || 12;
    let finalFontSize;
    
    if (uiFont < 1000) {
        // Multiplier mode: Safe scaling where 12 = perfectly visible 25,000 unit baseline.
        const multiplier = uiFont / 12;
        finalFontSize = 25000 * multiplier;
    } else {
        // Literal mode (if someone manually types "50000" into the box to force literal units)
        finalFontSize = uiFont;
    }

    // --- 3. BROWSER LIMIT BYPASS ---
    const baseFontSize = 100;
    const fontScaleFactor = finalFontSize / baseFontSize;

    const nx = dx / length;
    const ny = dy / length;
    
    // Perpendicular vector for OUTWARD movement (Right Turn)
    const px = ny;
    const py = -nx;

    const p1x = startPoint.x + px * finalOffset;
    const p1y = startPoint.y + py * finalOffset;
    const p2x = endPoint.x + px * finalOffset;
    const p2y = endPoint.y + py * finalOffset;

    let angle = Math.atan2(dy, dx) * (180 / Math.PI);
    if (angle > 90 || angle < -90) angle += 180;

    const midX = (p1x + p2x) / 2;
    const midY = (p1y + p2y) / 2;

    const mmValue = value !== undefined ? value : length;
    const textStr = formatValue(mmValue);

    return (
        <g className="dimension-group" style={{ pointerEvents: 'none' }}>
            {/* Consistent Extension Lines bridge the gap (Light Gray) */}
            <line x1={startPoint.x} y1={startPoint.y} x2={p1x} y2={p1y} stroke="#AAAAAA" strokeWidth={1} opacity={0.6} vectorEffect="non-scaling-stroke" />
            <line x1={endPoint.x} y1={endPoint.y} x2={p2x} y2={p2y} stroke="#AAAAAA" strokeWidth={1} opacity={0.6} vectorEffect="non-scaling-stroke" />
            
            {/* World-Bound Dimension Line */}
            <line x1={p1x} y1={p1y} x2={p2x} y2={p2y} stroke={color} strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke" />

            {/* Architectural Arrows */}
            <g transform={`translate(${p1x}, ${p1y}) rotate(${Math.atan2(dy, dx) * 180 / Math.PI})`}>
                <path d={`M ${finalFontSize * 0.4} ${finalFontSize * 0.15} L 0 0 L ${finalFontSize * 0.4} ${-finalFontSize * 0.15}`} stroke={color} strokeWidth={strokeWidth * 1.5} fill="none" vectorEffect="non-scaling-stroke" />
            </g>
            <g transform={`translate(${p2x}, ${p2y}) rotate(${Math.atan2(dy, dx) * 180 / Math.PI + 180})`}>
                <path d={`M ${finalFontSize * 0.4} ${finalFontSize * 0.15} L 0 0 L ${finalFontSize * 0.4} ${-finalFontSize * 0.15}`} stroke={color} strokeWidth={strokeWidth * 1.5} fill="none" vectorEffect="non-scaling-stroke" />
            </g>

            {/* THE SCALE HACK: We scale the entire group so the browser doesn't hit the font-size limit */}
            <g transform={`translate(${midX}, ${midY}) rotate(${angle}) scale(${fontScaleFactor})`}>
                <rect 
                    x={-(textStr.length * baseFontSize * 0.45)} y={-baseFontSize * 0.85} 
                    width={textStr.length * baseFontSize * 0.9} height={baseFontSize * 1.7} 
                    fill="white" stroke="#DDDDDD" strokeWidth={1 / (zoom * fontScaleFactor)} rx={4 / (zoom * fontScaleFactor)} 
                />
                <text 
                    textAnchor="middle" dominantBaseline="middle" 
                    fontSize={baseFontSize} fontWeight="700" fill={color} fontFamily="sans-serif"
                >
                    {textStr}
                </text>
            </g>
        </g>
    );
};
