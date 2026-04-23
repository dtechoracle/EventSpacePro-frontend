"use client";

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { useProjectStore, TextAnnotation } from '@/store/projectStore';

interface TextAnnotationToolProps {
    isActive: boolean;
}

export default function TextAnnotationTool({ isActive }: TextAnnotationToolProps) {
    const { screenToWorld, setActiveTool, setSelectedIds, selectedIds, editingTextId } = useEditorStore();
    const addTextAnnotation = useProjectStore(s => s.addTextAnnotation);
    const getNextZIndex = useProjectStore(s => s.getNextZIndex);
    const updateTextAnnotation = useProjectStore(s => s.updateTextAnnotation);
    const removeTextAnnotation = useProjectStore(s => s.removeTextAnnotation);

    const [currentAnnotation, setCurrentAnnotation] = useState<TextAnnotation | null>(null);
    const [text, setText] = useState<string>('');
    const inputRef = useRef<HTMLTextAreaElement | null>(null);
    const [isEditingSelected, setIsEditingSelected] = useState(false);

    // Helper function to safely set selection range
    const setCursorToEnd = useCallback((input: HTMLTextAreaElement) => {
        try {
            if (input && typeof input.setSelectionRange === 'function') {
                const length = input.value.length;
                input.setSelectionRange(length, length);
            }
        } catch (e) {
            // Ignore errors if setSelectionRange fails
            console.warn('Failed to set selection range:', e);
        }
    }, []);

    const finalizeCurrent = useCallback(() => {
        if (!currentAnnotation) return;

        const trimmed = text.trim();
        if (trimmed) {
            updateTextAnnotation(currentAnnotation.id, { text: trimmed });
        } else {
            removeTextAnnotation(currentAnnotation.id);
        }

        setCurrentAnnotation(null);
        setText('');
        setIsEditingSelected(false);
        useEditorStore.getState().setEditingTextId(null); // Clear editing ID
        setActiveTool('select');
    }, [currentAnnotation, text, updateTextAnnotation, removeTextAnnotation, setActiveTool]);

    const handleClick = useCallback((e: MouseEvent) => {
        if (!isActive) return;

        // If we're already editing/creating text, a click ends it instead of creating another
        if (currentAnnotation) {
            finalizeCurrent();
            return;
        }

        // Only handle clicks on the workspace SVG or its container, not window-wide
        const target = e.target as Element | null;
        const svgElement = target?.closest('svg[data-workspace-root="true"]');
        const containerElement = target?.closest('div[class*="relative"]'); // The canvas container

        if (!svgElement && !containerElement) {
            return;
        }

        // Don't create annotation if clicking on existing text
        if (target?.tagName === 'text' || target?.closest('text')) {
            // Let the selection tool handle clicking on existing text
            return;
        }

        // Check if we're clicking on an existing text annotation
        const { textAnnotations } = useProjectStore.getState();
        const worldPos = screenToWorld(e.clientX, e.clientY);

        // Check if clicking on existing annotation (let selection handle it)
        for (let i = textAnnotations.length - 1; i >= 0; i--) {
            const annotation = textAnnotations[i];
            const fontSize = annotation.fontSize || 200;
            const hitRadius = Math.max(fontSize * 2, 30);
            const dist = Math.hypot(worldPos.x - annotation.x, worldPos.y - annotation.y);
            if (dist <= hitRadius) {
                // Don't create new annotation, let selection tool handle it
                return;
            }
        }

        // Create new annotation
        const newAnnotation: TextAnnotation = {
            id: `text-annotation-${Date.now()}`,
            x: worldPos.x,
            y: worldPos.y,
            text: '',
            fontSize: 250,
            color: '#000000',
            fontFamily: 'Inter, sans-serif',
            rotation: 0,
            zIndex: getNextZIndex(),
        };

        addTextAnnotation(newAnnotation);
        setCurrentAnnotation(newAnnotation);
        setText('');
        setSelectedIds([newAnnotation.id]);

        // Focus invisible input immediately to capture typing (Figma-like)
        // Use requestAnimationFrame for better timing
        requestAnimationFrame(() => {
            const el = inputRef.current;
            if (el && el instanceof HTMLInputElement) {
                el.focus();
                // Select all text so user can immediately start typing to replace
                if (typeof el.select === 'function') {
                    el.select();
                }
            }
        });
    }, [isActive, screenToWorld, addTextAnnotation, getNextZIndex, setSelectedIds]);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        // Handle editing selected text
        if (!isActive && isEditingSelected && currentAnnotation) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                updateTextAnnotation(currentAnnotation.id, { text: text.trim() || ' ' });
                setIsEditingSelected(false);
                setCurrentAnnotation(null);
                setText('');
                useEditorStore.getState().setEditingTextId(null);
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                setIsEditingSelected(false);
                setCurrentAnnotation(null);
                setText('');
                useEditorStore.getState().setEditingTextId(null);
                return;
            }
            return; // Let input handle other keys natively
        }

        // Handle creating new text
        if (!isActive || !currentAnnotation) return;

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();
            finalizeCurrent();
            return;
        } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            finalizeCurrent();
            return;
        }
        
        // Let Backspace and character typing be handled naturally by the textarea
    }, [isActive, isEditingSelected, currentAnnotation, text, finalizeCurrent, updateTextAnnotation]);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (!currentAnnotation) return;
        const newText = e.target.value;
        setText(newText);
        // Update annotation in real-time
        updateTextAnnotation(currentAnnotation.id, { text: newText });
    }, [currentAnnotation, updateTextAnnotation]);

    // Handle editing state based on editingTextId from store
    // IMPORTANT: only depend on editingTextId here — NOT textAnnotations.
    // If textAnnotations is in deps, every updateTextAnnotation call re-triggers
    // this effect, which moves the cursor to the end 50ms later.
    useEffect(() => {
        if (editingTextId) {
            const annotation = useProjectStore.getState().textAnnotations
                .find(t => t.id === editingTextId);
            if (annotation && !isEditingSelected) {
                setCurrentAnnotation(annotation);
                setText(annotation.text);
                setIsEditingSelected(true);

                // Focus textarea and set cursor to end ONLY on first entry
                setTimeout(() => {
                    if (inputRef.current) {
                        inputRef.current.focus();
                        const len = inputRef.current.value.length;
                        inputRef.current.setSelectionRange(len, len);
                    }
                }, 50);
            }
        } else if (isEditingSelected) {
            setIsEditingSelected(false);
            setCurrentAnnotation(null);
            setText('');
        }
    }, [editingTextId, isEditingSelected]); // added isEditingSelected to safeguard the "first entry" logic

    useEffect(() => {
        if (isActive) {
            // Listen to clicks on the workspace SVG directly
            const svgElement = document.querySelector('svg[data-workspace-root="true"]');
            const containerElement = document.querySelector('div[class*="relative"][class*="overflow-hidden"]');

            if (svgElement) {
                svgElement.addEventListener('click', handleClick as any, true); // Use capture phase
            }
            if (containerElement) {
                containerElement.addEventListener('click', handleClick as any, true); // Use capture phase
            }
            window.addEventListener('keydown', handleKeyDown);
            // Set cursor style on body and workspace
            document.body.style.cursor = 'text';
            if (svgElement) {
                (svgElement as HTMLElement).style.cursor = 'text';
            }
            if (containerElement) {
                (containerElement as HTMLElement).style.cursor = 'text';
            }
        }
        return () => {
            const svgElement = document.querySelector('svg[data-workspace-root="true"]');
            const containerElement = document.querySelector('div[class*="relative"][class*="overflow-hidden"]');

            if (svgElement) {
                svgElement.removeEventListener('click', handleClick as any, true);
                (svgElement as HTMLElement).style.cursor = '';
            }
            if (containerElement) {
                containerElement.removeEventListener('click', handleClick as any, true);
                (containerElement as HTMLElement).style.cursor = '';
            }
            window.removeEventListener('keydown', handleKeyDown);
            document.body.style.cursor = '';
        };
    }, [isActive, handleClick, handleKeyDown]);

    // Always listen for keydown when editing selected text
    useEffect(() => {
        if (isEditingSelected && currentAnnotation) {
            window.addEventListener('keydown', handleKeyDown);
            return () => {
                window.removeEventListener('keydown', handleKeyDown);
            };
        }
    }, [isEditingSelected, currentAnnotation, handleKeyDown]);

    // Ensure the textarea is always focused while creating or editing text
    useEffect(() => {
        if ((isActive && currentAnnotation) || (isEditingSelected && currentAnnotation)) {
            const el = inputRef.current;
            if (el && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
                el.focus();
            }
        }
    }, [isActive, currentAnnotation, isEditingSelected]);

    // Visible textarea at cursor position
    const { zoom, panX, panY, canvasOffset } = useEditorStore();
    const showTextarea = (isActive && currentAnnotation !== null) || isEditingSelected;

    return (
        <>
            <textarea
                ref={inputRef as any}
                value={text}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                    // Prevent default behavior for special keys
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        finalizeCurrent();
                    } else if (e.key === 'Escape') {
                        e.preventDefault();
                        finalizeCurrent();
                    }
                }}
                onBlur={() => {
                    // Finish editing when textarea loses focus (but only if actively creating text)
                    if (currentAnnotation && isActive && !isEditingSelected) {
                        finalizeCurrent();
                    }
                }}
                style={{
                    position: 'fixed',
                    top: currentAnnotation ? `${(currentAnnotation.y * zoom + panY + canvasOffset.top)}px` : '-9999px',
                    left: currentAnnotation ? `${(currentAnnotation.x * zoom + panX + canvasOffset.left)}px` : '-9999px',
                    transform: 'translate(-50%, -50%)',
                    width: 'auto',
                    minWidth: '100px',
                    minHeight: '40px',
                    display: showTextarea ? 'block' : 'none',
                    opacity: showTextarea ? 1 : 0,
                    pointerEvents: showTextarea ? 'auto' : 'none',
                    zIndex: 9999,
                    background: 'white',
                    border: '1.5px solid #3b82f6',
                    borderRadius: '6px',
                    outline: 'none',
                    color: currentAnnotation?.color || '#000',
                    fontSize: `${(currentAnnotation?.fontSize || 250) * zoom}px`,
                    fontFamily: currentAnnotation?.fontFamily || 'Inter, sans-serif',
                    padding: '4px 8px',
                    margin: '0',
                    textAlign: currentAnnotation?.textAlign || 'center',
                    resize: 'none',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    overflow: 'hidden',
                    lineHeight: '1.2'
                }}
                autoFocus={showTextarea}
                placeholder="Type here..."
            />
        </>
    );
}

