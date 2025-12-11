import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useUserStore } from '@/store/userStore';

export type RemoteCursor = {
    userId: string;
    userName: string;
    x: number;
    y: number;
    color: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API || 'http://localhost:3001';

// Generate a random color for each user
const generateColor = () => {
    const hue = Math.floor(Math.random() * 360);
    return `hsl(${hue}, 70%, 60%)`;
};

export const useMultiplayer = (eventId: string | undefined, enabled: boolean = true) => {
    const [remoteCursors, setRemoteCursors] = useState<Record<string, RemoteCursor>>({});
    const socketRef = useRef<Socket | null>(null);
    const user = useUserStore((s) => s.user);
    const userColorRef = useRef<string>(generateColor());

    useEffect(() => {
        if (!enabled || !eventId || !user) return;

        // Connect to Socket.IO server
        const socket = io(API_BASE_URL, {
            transports: ['websocket', 'polling'],
            reconnection: true,
        });

        socketRef.current = socket;

        const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;

        socket.on('connect', () => {
            console.log('[Multiplayer] Connected to server');
            // Join the event room
            socket.emit('join-event', {
                eventId,
                userId: user._id,
                userName,
                color: userColorRef.current,
            });
        });

        socket.on('cursor-update', (data: RemoteCursor) => {
            // Update remote cursor positions
            if (data.userId !== user._id) {
                setRemoteCursors((prev) => ({
                    ...prev,
                    [data.userId]: data,
                }));
            }
        });

        socket.on('user-left', (userId: string) => {
            setRemoteCursors((prev) => {
                const updated = { ...prev };
                delete updated[userId];
                return updated;
            });
        });

        socket.on('disconnect', () => {
            console.log('[Multiplayer] Disconnected from server');
        });

        return () => {
            socket.emit('leave-event', { eventId, userId: user._id });
            socket.disconnect();
        };
    }, [enabled, eventId, user]);

    const updateCursor = (x: number, y: number) => {
        if (socketRef.current && user) {
            socketRef.current.emit('cursor-move', {
                eventId,
                userId: user._id,
                userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
                x,
                y,
                color: userColorRef.current,
            });
        }
    };

    return {
        remoteCursors: Object.values(remoteCursors),
        updateCursor,
    };
};
