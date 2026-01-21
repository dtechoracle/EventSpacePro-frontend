"use client";

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { useProjectStore, TextAnnotation } from '@/store/projectStore';

interface TextAnnotationToolProps {
    isActive: boolean;
}

export default function TextAnnotationTool({ isActive }: TextAnnotationToolProps) {
    const { screenToWorld, setActiveTool, setSelectedIds, selectedIds } = useEditorStore();
    const { addTextAnnotation, getNextZIndex, textAnnotations, updateTextAnnotation, removeTextAnnotation } = useProjectStore();

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
            fontSize: 200,
            color: '#000000',
            fontFamily: 'Arial',
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
            if (e.key === 'Enter' || e.key === 'Escape') {
                if (e.key === 'Enter') {
                    updateTextAnnotation(currentAnnotation.id, { text: text.trim() || ' ' });
                }
                setIsEditingSelected(false);
                setCurrentAnnotation(null);
                setText('');
                return;
            }
            return; // Let input handle other keys
        }

        // Handle creating new text
        if (!isActive || !currentAnnotation) return;

        // Typing characters directly into the canvas (Figma-like)
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            const newText = (text + e.key);
            setText(newText);
            updateTextAnnotation(currentAnnotation.id, { text: newText });
            return;
        }

        // Handle Backspace when there is content
        if (e.key === 'Backspace' && text.length > 0) {
            e.preventDefault();
            const newText = text.slice(0, -1);
            setText(newText);
            updateTextAnnotation(currentAnnotation.id, { text: newText });
            return;
        }

        if (e.key === 'Enter' || e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            if (e.key === 'Enter') {
                finalizeCurrent();
                return; // Exit immediately after finalizing
            } else if (e.key === 'Escape') {
                // On escape, treat empty as delete, non-empty as commit
                finalizeCurrent();
                return; // Exit immediately after finalizing
            }
        } else if (e.key === 'Backspace' && text.length === 0) {
            e.preventDefault();
            // Remove annotation if backspace on empty text
            finalizeCurrent();
        }
    }, [isActive, isEditingSelected, currentAnnotation, text, finalizeCurrent]);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (!currentAnnotation) return;
        const newText = e.target.value;
        setText(newText);
        // Update annotation in real-time
        updateTextAnnotation(currentAnnotation.id, { text: newText });
    }, [currentAnnotation, updateTextAnnotation]);

    // Handle editing selected text (when select tool is active and text is selected)
    useEffect(() => {
        if (!isActive && selectedIds.length === 1) {
            const selectedId = selectedIds[0];
            const selectedText = textAnnotations.find(t => t.id === selectedId);
            if (selectedText) {
                // Set up for editing when text is selected
                // Only start editing if not already editing or if it's a different text
                if (!currentAnnotation || currentAnnotation.id !== selectedText.id) {
                    setCurrentAnnotation(selectedText);
                    setText(selectedText.text);
                    setIsEditingSelected(true);

                    // Focus textarea after a short delay to allow selection to complete
                    setTimeout(() => {
                        if (inputRef.current && (inputRef.current instanceof HTMLInputElement || inputRef.current instanceof HTMLTextAreaElement)) {
                            inputRef.current.focus();
                            // Set cursor to end
                            if (inputRef.current instanceof HTMLInputElement) {
                                setCursorToEnd(inputRef.current);
                            } else if (inputRef.current instanceof HTMLTextAreaElement) {
                                inputRef.current.setSelectionRange(inputRef.current.value.length, inputRef.current.value.length);
                            }
                        }
                    }, 100);
                }

                // Listen for keypress to handle typing
                const handleKeyPress = (e: KeyboardEvent) => {
                    // If typing starts, ensure we're in edit mode
                    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                        if (!isEditingSelected || !currentAnnotation || currentAnnotation.id !== selectedText.id) {
                            setIsEditingSelected(true);
                            setText(selectedText.text);
                            setCurrentAnnotation(selectedText);
                            useEditorStore.getState().setEditingTextId(selectedText.id); // Set editing ID
                        }
                        // Ensure textarea is focused
                        setTimeout(() => {
                            if (inputRef.current && (inputRef.current instanceof HTMLInputElement || inputRef.current instanceof HTMLTextAreaElement)) {
                                inputRef.current.focus();
                            }
                        }, 10);
                    }
                };
                window.addEventListener('keydown', handleKeyPress);
                return () => {
                    window.removeEventListener('keydown', handleKeyPress);
                };
            } else if (!selectedText && isEditingSelected) {
                // Clear editing state when text is deselected
                setIsEditingSelected(false);
                setCurrentAnnotation(null);
                setText('');
            }
        } else if (selectedIds.length === 0 && isEditingSelected) {
            // Clear editing state when nothing is selected
            setIsEditingSelected(false);
            setCurrentAnnotation(null);
            setText('');
        }
    }, [isActive, selectedIds, textAnnotations, currentAnnotation, isEditingSelected, setCursorToEnd]);

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
                    top: currentAnnotation ? `${(currentAnnotation.y * zoom + panY + canvasOffset.top) - 10}px` : '-9999px',
                    left: currentAnnotation ? `${(currentAnnotation.x * zoom + panX + canvasOffset.left)}px` : '-9999px',
                    opacity: showTextarea ? 1 : 0,
                    pointerEvents: showTextarea ? 'auto' : 'none',
                    zIndex: 9999,
                    background: 'rgba(255, 255, 255, 0.95)',
                    border: '2px solid #3b82f6',
                    borderRadius: '4px',
                    outline: 'none',
                    color: currentAnnotation?.color || '#000',
                    fontSize: `${(currentAnnotation?.fontSize || 200) * zoom * 0.8}px`,
                    fontFamily: currentAnnotation?.fontFamily || 'Arial',
                    padding: '8px',
                    margin: '0',
                    minWidth: '200px',
                    minHeight: '60px',
                    resize: 'both',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                }}
                autoFocus={showTextarea}
                placeholder="Type your text here..."
            />
        </>
    );
}

