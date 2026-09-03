import React from 'react';
import { usePresenceStore } from '@/store/presenceStore';
import { RemoteCursor } from './RemoteCursor';

/**
 * Renders remote collaborator cursors.
 *
 * Reads directly from `usePresenceStore` so that cursor-move updates only
 * re-render this component — NOT the parent `Workspace2D` canvas.
 */
export const CursorOverlay: React.FC = () => {
    const activeUsers = usePresenceStore(s => s.activeUsers);

    return (
        <>
            {activeUsers.map((user) => {
                if (!user.cursor) return null;
                return (
                    <RemoteCursor
                        key={user.sessionId || user.userId}
                        userId={user.userId}
                        userName={user.userName}
                        userAvatar={user.userAvatar}
                        x={user.cursor.x}
                        y={user.cursor.y}
                        color={user.color}
                    />
                );
            })}
        </>
    );
};
