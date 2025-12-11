import React, { useState, useRef, useEffect } from 'react';
import { Comment } from '@/store/projectStore';

interface CommentPopoverProps {
    comment: Comment;
    onUpdate: (id: string, updates: Partial<Comment>) => void;
    onResolve: (id: string) => void;
    onDelete: (id: string) => void;
    onClose: () => void;
}

export default function CommentPopover({ comment, onUpdate, onDelete, onClose }: CommentPopoverProps) {
    const [text, setText] = useState(comment.content);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (text.trim() === '') {
                onDelete(comment.id);
            } else {
                onUpdate(comment.id, { content: text });
                onClose();
            }
        } else if (e.key === 'Escape') {
            if (comment.content === '') {
                onDelete(comment.id);
            } else {
                onClose();
            }
        }
    };

    return (
        <div className="absolute z-50 w-72 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden ring-1 ring-black/5"
            style={{ transform: 'translate(-50%, 12px)' }}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
        >
            <div className="p-3">
                <textarea
                    ref={inputRef}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Write a comment..."
                    className="w-full text-sm border-none focus:ring-0 resize-none p-2 text-gray-800 placeholder-gray-400 bg-transparent leading-relaxed"
                    rows={3}
                    style={{ minHeight: '60px' }}
                />
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
                    <span className="text-[10px] font-medium text-gray-400">
                        Press <kbd className="font-sans bg-gray-100 px-1 py-0.5 rounded text-gray-500">Enter</kbd> to save
                    </span>
                    <button
                        onClick={() => {
                            if (text.trim() === '') onDelete(comment.id);
                            else onClose();
                        }}
                        className="text-[10px] text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
