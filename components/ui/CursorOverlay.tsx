import React from 'react';
import { RemoteCursor } from '@/hooks/useMultiplayer';

type CursorOverlayProps = {
    cursors: RemoteCursor[];
};

export const CursorOverlay: React.FC<CursorOverlayProps> = ({ cursors }) => {
    return (
        <>
            {cursors.map((cursor) => (
                <div
                    key={cursor.userId}
                    style={{
                        position: 'absolute',
                        left: cursor.x,
                        top: cursor.y,
                        pointerEvents: 'none',
                        zIndex: 10000,
                        transform: 'translate(-2px, -2px)',
                    }}
                >
                    {/* Cursor SVG */}
                    <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        style={{
                            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
                        }}
                    >
                        <path
                            d="M5.65376 12.3673L13.2372 8.57602C14.0784 8.14728 15.0192 8.99926 14.6741 9.88966L11.6776 17.2506C11.3493 18.1 10.1194 18.1 9.79112 17.2506L8.65193 14.3806C8.53324 14.0746 8.28895 13.8303 7.98291 13.7116L5.11294 12.5724C4.26333 12.2441 4.26333 11.0142 5.11294 10.686L5.65376 12.3673Z"
                            fill={cursor.color}
                            stroke="white"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>

                    {/* User name label */}
                    <div
                        style={{
                            position: 'absolute',
                            top: '20px',
                            left: '10px',
                            background: cursor.color,
                            color: 'white',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: '500',
                            whiteSpace: 'nowrap',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                        }}
                    >
                        {cursor.userName}
                    </div>
                </div>
            ))}
        </>
    );
};
