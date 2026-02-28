import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { useProjectStore, Shape } from '@/store/projectStore';
import ShapeRenderer from '../renderers/ShapeRenderer';
import { findSnapPointInShapes } from '@/utils/snapToDrawing';

interface ArchToolProps {
    isActive: boolean;
}

// A single committed arc segment
interface ArcSegment {
    start: { x: number; y: number };
    end: { x: number; y: number };
    control: { x: number; y: number };
}

export default function ArchTool({ isActive }: ArchToolProps) {
    const { canvasOffset, zoom, panX, panY, snapToGrid, gridSize, archWaveMode, snapToObjects } = useEditorStore();
    const { addShape, getNextZIndex, shapes, walls, assets } = useProjectStore();

    // Drawing step: 0 = idle, 1 = chord (set end), 2 = control (set bulge)
    const [step, setStep] = useState<0 | 1 | 2>(0);
    const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
    const [endPoint, setEndPoint] = useState<{ x: number; y: number } | null>(null);
    const [mouse, setMouse] = useState<{ x: number; y: number } | null>(null);

    // Wave mode comes from editorStore so the toolbar button controls it
    const waveMode = archWaveMode;
    const [segments, setSegments] = useState<ArcSegment[]>([]);
    const segmentsRef = useRef<ArcSegment[]>([]);
    useEffect(() => { segmentsRef.current = segments; }, [segments]);

    // ── Helpers ────────────────────────────────────────────────────────────────
    const screenToWorld = useCallback((sx: number, sy: number) => ({
        x: (sx - canvasOffset.left - panX) / zoom,
        y: (sy - canvasOffset.top - panY) / zoom,
    }), [canvasOffset, zoom, panX, panY]);

    const snap = useCallback((pos: { x: number; y: number }) => {
        if (snapToObjects) {
            const allElements = [...shapes, ...walls, ...assets];
            const snapResult = findSnapPointInShapes(pos, allElements, 20 / zoom);
            if (snapResult) return { x: snapResult.x, y: snapResult.y };
        }
        if (!snapToGrid) return pos;
        return {
            x: Math.round(pos.x / gridSize) * gridSize,
            y: Math.round(pos.y / gridSize) * gridSize,
        };
    }, [snapToGrid, gridSize, snapToObjects, shapes, walls, assets, zoom]);

    // Quadratic bezier path string from start→control→end
    // Uses the "pass-through" formula so the curve actually touches the control point
    const arcPath = (s: { x: number; y: number }, e: { x: number; y: number }, c: { x: number; y: number }) => {
        const mx = (s.x + e.x) / 2;
        const my = (s.y + e.y) / 2;
        const qcx = 2 * c.x - mx;
        const qcy = 2 * c.y - my;
        return `M ${s.x} ${s.y} Q ${qcx} ${qcy} ${e.x} ${e.y}`;
    };

    const resetDrawing = useCallback(() => {
        setStep(0);
        setStartPoint(null);
        setEndPoint(null);
        setMouse(null);
    }, []);

    // ── Commit a single arc to the store ──────────────────────────────────────
    const commitArc = useCallback((seg: ArcSegment) => {
        const cx = (seg.start.x + seg.end.x + seg.control.x) / 3;
        const cy = (seg.start.y + seg.end.y + seg.control.y) / 3;
        const allX = [seg.start.x, seg.end.x, seg.control.x];
        const allY = [seg.start.y, seg.end.y, seg.control.y];
        addShape({
            id: crypto.randomUUID(),
            type: 'arc',
            x: cx,
            y: cy,
            width: Math.max(1, Math.max(...allX) - Math.min(...allX)),
            height: Math.max(1, Math.max(...allY) - Math.min(...allY)),
            rotation: 0,
            points: [
                { x: seg.start.x - cx, y: seg.start.y - cy },
                { x: seg.control.x - cx, y: seg.control.y - cy },
                { x: seg.end.x - cx, y: seg.end.y - cy },
            ],
            stroke: '#000000',
            strokeWidth: 150,
            fill: 'transparent',
            fillType: 'color',
            zIndex: getNextZIndex(),
        });
    }, [addShape, getNextZIndex]);

    // ── Commit the whole wave (multi-arc) as ONE compound arc shape ──────────
    const commitWave = useCallback(() => {
        const segs = segmentsRef.current;
        if (segs.length === 0) {
            resetDrawing();
            return;
        }

        if (segs.length === 1) {
            commitArc(segs[0]);
        } else {
            // Calculate compound bounding box
            const allX = segs.flatMap(s => [s.start.x, s.end.x, s.control.x]);
            const allY = segs.flatMap(s => [s.start.y, s.end.y, s.control.y]);
            const minX = Math.min(...allX), maxX = Math.max(...allX);
            const minY = Math.min(...allY), maxY = Math.max(...allY);
            const cx = (minX + maxX) / 2;
            const cy = (minY + maxY) / 2;

            // Points stored as: [start0, ctrl0, start1, ctrl1, ..., lastEnd]
            // ShapeRenderer uses this to build the compound path.
            const pts = segs.flatMap(seg => [
                { x: seg.start.x - cx, y: seg.start.y - cy },
                { x: seg.control.x - cx, y: seg.control.y - cy },
            ]);
            pts.push({ x: segs[segs.length - 1].end.x - cx, y: segs[segs.length - 1].end.y - cy });

            addShape({
                id: crypto.randomUUID(),
                type: 'arc',
                x: cx,
                y: cy,
                width: Math.max(1, maxX - minX),
                height: Math.max(1, maxY - minY),
                rotation: 0,
                points: pts,
                stroke: '#000000',
                strokeWidth: 150,
                fill: 'transparent',
                fillType: 'color',
                zIndex: getNextZIndex(),
            });
        }

        setSegments([]);
        segmentsRef.current = [];
        resetDrawing();
    }, [commitArc, addShape, getNextZIndex, resetDrawing]);

    // ── Mouse events ───────────────────────────────────────────────────────────
    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isActive) return;
        setMouse(snap(screenToWorld(e.clientX, e.clientY)));
    }, [isActive, screenToWorld, snap]);

    const handleMouseDown = useCallback((e: MouseEvent) => {
        if (!isActive || e.button !== 0) return;
        const target = e.target as Element | null;
        if (!target?.closest('svg[data-workspace-root="true"]')) return;

        const pos = snap(screenToWorld(e.clientX, e.clientY));

        if (step === 0) {
            setStartPoint(pos);
            setStep(1);
        } else if (step === 1) {
            setEndPoint(pos);
            setStep(2);
        } else if (step === 2 && startPoint && endPoint) {
            const seg: ArcSegment = { start: startPoint, end: endPoint, control: pos };

            if (waveMode || e.shiftKey) {
                // Append segment, chain: next arc starts at this arc's end
                const next = [...segmentsRef.current, seg];
                setSegments(next);
                segmentsRef.current = next;
                // Start next arc from the current end
                setStartPoint(endPoint);
                setEndPoint(null);
                setStep(1);
            } else {
                commitArc(seg);
                resetDrawing();
                // Removed auto-select tool switch to allow drawing multiple arcs in a row
            }
        }
    }, [isActive, step, startPoint, endPoint, waveMode, screenToWorld, snap, commitArc, resetDrawing]);

    // Double-click to finalise wave (works for both Wave mode and Shift-chained arcs)
    const handleDblClick = useCallback((e: MouseEvent) => {
        if (!isActive || segmentsRef.current.length === 0) return;
        commitWave();
    }, [isActive, commitWave]);

    // Escape = cancel
    useEffect(() => {
        if (!isActive) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setSegments([]);
                segmentsRef.current = [];
                resetDrawing();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isActive, resetDrawing]);

    useEffect(() => {
        if (!isActive) {
            setSegments([]);
            segmentsRef.current = [];
            resetDrawing();
            return;
        }
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('dblclick', handleDblClick);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('dblclick', handleDblClick);
        };
    }, [isActive, handleMouseMove, handleMouseDown, handleDblClick]);

    // ── Render ─────────────────────────────────────────────────────────────────
    if (!isActive || !mouse) return null;

    const guideLineProps = {
        stroke: '#6366f1',
        strokeWidth: 1 / zoom,
        strokeDasharray: `${6 / zoom} ${4 / zoom}`,
        opacity: 0.7,
        style: { pointerEvents: 'none' as const },
    };
    const dotR = 5 / zoom;

    return (
        <g style={{ pointerEvents: 'none' }}>
            {/* ─── Center-finding guides (Green/Red crosshairs) ─────────────── */}
            {mouse && (
                <>
                    {/* Horizontal Red Guideline */}
                    <line
                        x1={mouse.x - 2000 / zoom} y1={mouse.y}
                        x2={mouse.x + 2000 / zoom} y2={mouse.y}
                        stroke="#ef4444"
                        strokeWidth={1 / zoom}
                        opacity={0.4}
                        strokeDasharray={`${5 / zoom} ${5 / zoom}`}
                    />
                    {/* Vertical Green Guideline */}
                    <line
                        x1={mouse.x} y1={mouse.y - 2000 / zoom}
                        x2={mouse.x} y2={mouse.y + 2000 / zoom}
                        stroke="#22c55e"
                        strokeWidth={1 / zoom}
                        opacity={0.4}
                        strokeDasharray={`${5 / zoom} ${5 / zoom}`}
                    />
                </>
            )}

            {/* ─── Wave mode toggle hint ──────────────────────────────────────── */}
            {/* (rendered by toolbar, not here) */}

            {/* ─── Already-committed wave segments preview ─────────────────────── */}
            {segments.map((seg, i) => (
                <path
                    key={i}
                    d={arcPath(seg.start, seg.end, seg.control)}
                    fill="none"
                    stroke="#6366f1"
                    strokeWidth={4 / zoom}
                    strokeLinecap="round"
                    opacity={0.6}
                />
            ))}

            {/* ─── Step 1: chord line start→mouse (before end is set) ─────────── */}
            {step === 1 && startPoint && (
                <>
                    {/* Chord guide */}
                    <line
                        x1={startPoint.x} y1={startPoint.y}
                        x2={mouse.x} y2={mouse.y}
                        {...guideLineProps}
                    />
                    {/* Start dot */}
                    <circle cx={startPoint.x} cy={startPoint.y} r={dotR}
                        fill="#6366f1" opacity={0.9} />
                    {/* Midpoint crosshair hint */}
                    <circle cx={(startPoint.x + mouse.x) / 2}
                        cy={(startPoint.y + mouse.y) / 2}
                        r={dotR * 0.6} fill="#a5b4fc" opacity={0.8} />
                    {/* Mouse dot */}
                    <circle cx={mouse.x} cy={mouse.y} r={dotR}
                        fill="white" stroke="#6366f1" strokeWidth={1.5 / zoom} />
                </>
            )}

            {/* ─── Step 2: live arc + control guidelines ───────────────────────── */}
            {step === 2 && startPoint && endPoint && (
                <>
                    {/* Live arc curve */}
                    <path
                        d={arcPath(startPoint, endPoint, mouse)}
                        fill="none"
                        stroke="#111827"
                        strokeWidth={3 / zoom}
                        strokeLinecap="round"
                        opacity={0.85}
                    />

                    {/* Control handle lines: start→control and end→control */}
                    <line
                        x1={startPoint.x} y1={startPoint.y}
                        x2={mouse.x} y2={mouse.y}
                        {...guideLineProps}
                    />
                    <line
                        x1={endPoint.x} y1={endPoint.y}
                        x2={mouse.x} y2={mouse.y}
                        {...guideLineProps}
                    />

                    {/* Chord baseline */}
                    <line
                        x1={startPoint.x} y1={startPoint.y}
                        x2={endPoint.x} y2={endPoint.y}
                        stroke="#d1d5db"
                        strokeWidth={1 / zoom}
                        strokeDasharray={`${4 / zoom} ${4 / zoom}`}
                        opacity={0.5}
                    />

                    {/* Start / end / control dots */}
                    <circle cx={startPoint.x} cy={startPoint.y} r={dotR}
                        fill="#6366f1" opacity={0.9} />
                    <circle cx={endPoint.x} cy={endPoint.y} r={dotR}
                        fill="#6366f1" opacity={0.9} />
                    <circle cx={mouse.x} cy={mouse.y} r={dotR}
                        fill="#f59e0b" stroke="white" strokeWidth={1.5 / zoom} opacity={0.95} />

                    {/* Perpendicular bisector tick (visual aid for bulge height) */}
                    {(() => {
                        const mx = (startPoint.x + endPoint.x) / 2;
                        const my = (startPoint.y + endPoint.y) / 2;
                        const dx = endPoint.x - startPoint.x;
                        const dy = endPoint.y - startPoint.y;
                        const len = Math.hypot(dx, dy) || 1;
                        const px = -dy / len; const py = dx / len;
                        const fullH = Math.hypot(mouse.x - mx, mouse.y - my);
                        return (
                            <line
                                x1={mx} y1={my}
                                x2={mx + px * fullH} y2={my + py * fullH}
                                stroke="#f59e0b"
                                strokeWidth={1 / zoom}
                                strokeDasharray={`${3 / zoom} ${3 / zoom}`}
                                opacity={0.5}
                            />
                        );
                    })()}

                    {/* Height dimension label */}
                    {(() => {
                        const mx = (startPoint.x + endPoint.x) / 2;
                        const my = (startPoint.y + endPoint.y) / 2;
                        const bulge = Math.hypot(mouse.x - mx, mouse.y - my);
                        return (
                            <text
                                x={mouse.x + 12 / zoom}
                                y={mouse.y}
                                fontSize={11 / zoom}
                                fill="#f59e0b"
                                fontFamily="system-ui, monospace"
                                fontWeight="700"
                            >
                                {Math.round(bulge)} mm
                            </text>
                        );
                    })()}

                    {/* Chord length label */}
                    {(() => {
                        const mx = (startPoint.x + endPoint.x) / 2;
                        const my = (startPoint.y + endPoint.y) / 2;
                        const chordLen = Math.hypot(endPoint.x - startPoint.x, endPoint.y - startPoint.y);
                        return (
                            <text
                                x={mx}
                                y={my + 18 / zoom}
                                fontSize={10 / zoom}
                                fill="#6b7280"
                                textAnchor="middle"
                                fontFamily="system-ui, monospace"
                            >
                                {Math.round(chordLen)} mm
                            </text>
                        );
                    })()}

                    {/* Wave mode hint */}
                    <text
                        x={mouse.x + 12 / zoom}
                        y={mouse.y + 16 / zoom}
                        fontSize={10 / zoom}
                        fill="#6366f1"
                        fontFamily="system-ui, sans-serif"
                        className="select-none pointer-events-none"
                    >
                        {waveMode
                            ? 'Click to add segment • Dbl-click to finish'
                            : 'Click start/end/bulge • Hold Shift to chain arcs'
                        }
                    </text>
                </>
            )}
        </g>
    );
}

// ── Wave Mode toggle button (exported for toolbar to use) ──────────────────
export function ArchWaveModeToggle({ waveMode, onToggle }: { waveMode: boolean; onToggle: () => void }) {
    return (
        <button
            onClick={onToggle}
            title={waveMode ? 'Wave mode ON — dbl-click to finish' : 'Enable wave/multi-arc mode'}
            style={{
                padding: '4px 8px',
                fontSize: 11,
                borderRadius: 6,
                border: `1.5px solid ${waveMode ? '#6366f1' : '#d1d5db'}`,
                background: waveMode ? '#ede9fe' : '#fff',
                color: waveMode ? '#6366f1' : '#374151',
                cursor: 'pointer',
                fontWeight: waveMode ? 700 : 400,
            }}
        >
            {waveMode ? '〰 Wave ON' : '〰 Wave'}
        </button>
    );
}
