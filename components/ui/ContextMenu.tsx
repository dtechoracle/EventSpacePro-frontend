import React, { useState, useEffect, useRef } from 'react';
import { FaChevronRight } from 'react-icons/fa';

export interface MenuItem {
    label?: string;
    action?: () => void;
    shortcut?: string;
    children?: MenuItem[];
    disabled?: boolean;
    separator?: boolean;
    icon?: React.ReactNode;
}

interface ContextMenuProps {
    x: number;
    y: number;
    onClose: () => void;
    actions: MenuItem[];
}

export default function ContextMenu({ x, y, onClose, actions }: ContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    // Adjust position to keep in viewport
    const [adjustedPos, setAdjustedPos] = useState({ x, y });

    useEffect(() => {
        if (menuRef.current) {
            const rect = menuRef.current.getBoundingClientRect();
            let newX = x;
            let newY = y;

            if (x + rect.width > window.innerWidth) {
                newX = x - rect.width;
            }
            if (y + rect.height > window.innerHeight) {
                newY = y - rect.height;
            }
            setAdjustedPos({ x: newX, y: newY });
        }
    }, [x, y]);

    return (
        <div
            ref={menuRef}
            className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[200px]"
            style={{ top: adjustedPos.y, left: adjustedPos.x }}
            onContextMenu={(e) => e.preventDefault()}
            onMouseDown={(e) => e.stopPropagation()}
        >
            <MenuList items={actions} onClose={onClose} />
        </div>
    );
}

function MenuList({ items, onClose }: { items: MenuItem[]; onClose: () => void }) {
    const [activeSubmenu, setActiveSubmenu] = useState<number | null>(null);

    return (
        <div className="flex flex-col">
            {items.map((item, index) => {
                if (item.separator) {
                    return <div key={index} className="h-px bg-gray-200 my-1 mx-2" />;
                }

                const hasChildren = item.children && item.children.length > 0;

                return (
                    <div
                        key={index}
                        className={`relative px-3 py-1.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 cursor-pointer flex items-center justify-between group ${item.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                        onMouseEnter={() => setActiveSubmenu(index)}
                        onMouseLeave={() => setActiveSubmenu(null)}
                        onClick={(e) => {
                            if (item.disabled) return;
                            if (!hasChildren && item.action) {
                                item.action();
                                onClose();
                            }
                            e.stopPropagation();
                        }}
                    >
                        <div className="flex items-center gap-2">
                            {item.icon && <span className="text-gray-400 group-hover:text-blue-500">{item.icon}</span>}
                            <span>{item.label}</span>
                        </div>

                        {item.shortcut && <span className="text-xs text-gray-400 ml-4">{item.shortcut}</span>}
                        {hasChildren && <FaChevronRight className="text-xs text-gray-400" />}

                        {/* Submenu */}
                        {hasChildren && activeSubmenu === index && (
                            <div className="absolute left-full top-0 ml-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[180px]">
                                <MenuList items={item.children!} onClose={onClose} />
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
