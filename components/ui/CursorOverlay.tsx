import React from 'react';
import { UserPresence } from '@/hooks/useCollaboration';
import { RemoteCursor } from './RemoteCursor';

type CursorOverlayProps = {
    cursors: UserPresence[];
};

export const CursorOverlay: React.FC<CursorOverlayProps> = ({ cursors }) => {
    return (
        <>
            {cursors.map((user) => {
                if (!user.cursor) return null;
                return (
                    <RemoteCursor
                        key={user.userId}
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
