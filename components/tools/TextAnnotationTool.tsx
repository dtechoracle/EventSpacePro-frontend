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
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [isEditingSelected, setIsEditingSelected] = useState(false);

    // Helper function to safely set selection range
    const setCursorToEnd = useCallback((input: HTMLInputElement) => {
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

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
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
                    
                    // Focus input after a short delay to allow selection to complete
                    setTimeout(() => {
                        if (inputRef.current && inputRef.current instanceof HTMLInputElement) {
                            inputRef.current.focus();
                            // Set cursor to end
                            setCursorToEnd(inputRef.current);
                        }
                    }, 100);
                }

                // Listen for keypress to handle typing
                const handleKeyPress = (e: KeyboardEvent) => {
                    // If typing starts, ensure we're in edit mode
                    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                        if (!isEditingSelected || !currentAnnotation || currentAnnotation.id !== selectedText.id) {
                            setIsEditingSelected(true);
                            setCurrentAnnotation(selectedText);
                            setText(selectedText.text);
                        }
                        // Ensure input is focused
                        setTimeout(() => {
                            if (inputRef.current && inputRef.current instanceof HTMLInputElement) {
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

    // Ensure the invisible input is always focused while creating or editing text
    useEffect(() => {
        if ((isActive && currentAnnotation) || (isEditingSelected && currentAnnotation)) {
            const el = inputRef.current;
            if (el && el instanceof HTMLInputElement) {
                el.focus();
            }
        }
    }, [isActive, currentAnnotation, isEditingSelected]);

    // Invisible input to capture typing
    return (
        <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={handleInputChange}
            onKeyDown={(e) => {
                // Prevent default behavior for special keys
                if (e.key === 'Enter' || e.key === 'Escape') {
                    e.preventDefault();
                }
            }}
            onBlur={() => {
                // Finish editing when input loses focus (but only if actively creating text)
                if (currentAnnotation && isActive && !isEditingSelected) {
                    finalizeCurrent();
                }
            }}
            style={{
                position: 'fixed',
                top: '-9999px',
                left: '-9999px',
                opacity: 0,
                pointerEvents: (isActive || isEditingSelected) ? 'auto' : 'none',
                zIndex: 9999,
            }}
            autoFocus={(isActive && currentAnnotation !== null) || isEditingSelected}
        />
    );
}

