import React, { useState } from 'react';
import { FaComment } from 'react-icons/fa';
import { Comment } from '@/store/projectStore';
import CommentPopover from '../ui/CommentPopover';

interface CommentRendererProps {
    comment: Comment;
    zoom: number;
    panX: number;
    panY: number;
    isActive: boolean;
    onActivate: (id: string) => void;
    onDeactivate: () => void;
    onUpdate: (id: string, updates: Partial<Comment>) => void;
    onResolve: (id: string) => void;
    onDelete: (id: string) => void;
}

export default function CommentRenderer({
    comment,
    zoom,
    panX,
    panY,
    isActive,
    onActivate,
    onDeactivate,
    onUpdate,
    onResolve,
    onDelete
}: CommentRendererProps) {
    const [isHovered, setIsHovered] = useState(false);

    // Calculate screen position
    const screenX = comment.x * zoom + panX;
    const screenY = comment.y * zoom + panY;

    // Don't render resolved comments unless specifically asked
    if (comment.resolved) return null;

    // Show popover ONLY if it's a new comment (empty content) and active
    const showPopover = isActive && comment.content === '';

    return (
        <div
            className="absolute"
            style={{
                left: screenX,
                top: screenY,
                zIndex: isActive || isHovered ? 100 : 50,
                pointerEvents: 'auto',
            }}
        >
            {/* Pin Icon */}
            <div
                className={`
                    relative -translate-x-1/2 -translate-y-full cursor-pointer transition-transform duration-200
                    ${isActive ? 'scale-125 text-blue-600' : isHovered ? 'scale-110 text-blue-500' : 'text-gray-500'}
                `}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                onClick={(e) => {
                    e.stopPropagation();
                    // If it's a new comment, activate it to show popover
                    if (comment.content === '') {
                        onActivate(comment.id);
                    }
                    // Existing comments: maybe toggle resolved? or just do nothing as hover shows content
                }}
            >
                <div className="bg-white rounded-full p-1 shadow-md border border-current">
                    <FaComment size={20} />
                </div>

                {/* Author Avatar/Initial */}
                <div className="absolute -top-1 -right-1 bg-blue-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-white">
                    {comment.author.charAt(0).toUpperCase()}
                </div>
            </div>

            {/* Hover Bubble for Existing Comments */}
            {isHovered && comment.content !== '' && (
                <div
                    className="absolute left-full top-1/2 -translate-y-1/2 ml-3 w-64 bg-white rounded-lg shadow-xl border border-gray-200 p-3 z-[60] origin-left animate-in fade-in slide-in-from-left-2 duration-200"
                >
                    {/* Arrow pointing left to the icon */}
                    <div className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-3 bg-white border-l border-b border-gray-200 transform rotate-45"></div>

                    <div className="flex items-center justify-between mb-1 relative z-10">
                        <span className="text-xs font-bold text-gray-700">{comment.author}</span>
                        <span className="text-[10px] text-gray-400">
                            {new Date(comment.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                    <div className="text-sm text-gray-800 whitespace-pre-wrap relative z-10">{comment.content}</div>
                </div>
            )}

            {/* Input Popover for New Comments */}
            {showPopover && (
                <CommentPopover
                    comment={comment}
                    onUpdate={onUpdate}
                    onResolve={onResolve}
                    onDelete={onDelete}
                    onClose={onDeactivate}
                />
            )}
        </div>
    );
}
