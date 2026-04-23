import { useEffect, useRef, useState, useCallback } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { useUserStore } from '@/store/userStore';
import { useProjectStore } from '@/store/projectStore';
import Cookies from 'js-cookie';
import { useRouter } from 'next/router';

const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_BASE_URL || 'ws://localhost:3001';

export type UserPresence = {
  userId: string;
  userName: string;
  userAvatar?: string;
  cursor?: { x: number; y: number };
  isTyping?: boolean;
  color: string;
  lastSeen: string;
};

export const useCollaboration = (projectId: string | undefined, eventId: string | undefined) => {
  const [activeUsers, setActiveUsers] = useState<UserPresence[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const activeUsersSignatureRef = useRef('');
  const lastCursorSentAtRef = useRef(0);
  const pendingCursorRef = useRef<{ x: number; y: number } | null>(null);
  const cursorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const user = useUserStore((s) => s.user);
  const router = useRouter();
  
  const effectiveProjectId = projectId || (router.query.slug as string);
  const effectiveEventId = eventId || (router.query.id as string);
  
  const projectStore = useProjectStore.getState();

  // Generate consistent color for user based on ID
  const getUserColor = useCallback((userId: string) => {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash) % 360;
    return `hsl(${h}, 70%, 50%)`;
  }, []);

  useEffect(() => {
    if (!effectiveProjectId || !effectiveEventId || !user) return;

    const roomId = `${effectiveProjectId}-${effectiveEventId}`;
    const token = Cookies.get('authToken');

    // 1. Initialize Y.js Document
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    // 2. Setup WebSocket Provider
    const provider = new WebsocketProvider(WS_BASE_URL, roomId, ydoc, {
      params: token ? { token } : {},
      connect: true,
    });
    providerRef.current = provider;

    // 3. Shared Types
    const yAssets = ydoc.getMap<any>('assets');
    const yWalls = ydoc.getMap<any>('walls');
    const yShapes = ydoc.getMap<any>('shapes');
    const yAnnotations = ydoc.getMap<any>('annotations');
    const yArrows = ydoc.getMap<any>('arrows');
    const yDimensions = ydoc.getMap<any>('dimensions');
    const yGroups = ydoc.getMap<any>('groups');
    const yCanvas = ydoc.getMap<any>('canvas');
    const yWallSegments = ydoc.getMap<any>('wallSegments');
    const yComments = ydoc.getMap<any>('comments');

    // 4. Presence / Awareness
    const { awareness } = provider;
    
    // Set local presence
    const userColor = getUserColor(user._id);
    awareness.setLocalStateField('user', {
      userId: user._id,
      userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
      userAvatar: user.avatar,
      color: userColor,
      lastSeen: new Date().toISOString(),
    });

    // Handle incoming awareness updates
    const handleAwarenessUpdate = () => {
      const states = awareness.getStates();
      const users: UserPresence[] = [];
      
      states.forEach((state: any, clientId: number) => {
        if (clientId === awareness.clientID) return;
        if (state.user) {
          users.push({
            ...state.user,
            cursor: state.cursor,
            isTyping: state.isTyping,
          });
        }
      });

      users.sort((a, b) => a.userId.localeCompare(b.userId));
      const signature = JSON.stringify(users.map((activeUser) => [
        activeUser.userId,
        activeUser.cursor?.x ?? null,
        activeUser.cursor?.y ?? null,
        activeUser.isTyping ?? false,
        activeUser.lastSeen,
      ]));

      if (signature !== activeUsersSignatureRef.current) {
        activeUsersSignatureRef.current = signature;
        setActiveUsers(users);
      }
    };

    awareness.on('change', handleAwarenessUpdate);

    // 5. Connection Events
    provider.on('status', (event: any) => {
      setIsConnected(event.status === 'connected');
      console.log(`[Collaboration] Status: ${event.status}`);
    });

    // 6. Data Synchronization Logic
    const isRemoteUpdating = { current: false };

    // Function to apply Y.js changes to local store
    const applyYChangeToStore = (event: Y.YMapEvent<any>, storeAction: (id: string, data: any) => void, removeAction: (id: string) => void) => {
      if (event.transaction.origin === 'local-sync') return;
      
      isRemoteUpdating.current = true;
      event.changes.keys.forEach((change, key) => {
        if (change.action === 'add' || change.action === 'update') {
          const val = event.target.get(key);
          storeAction(key, val);
        } else if (change.action === 'delete') {
          removeAction(key);
        }
      });
      isRemoteUpdating.current = false;
    };

    // Observers for incoming Y.js changes
    yAssets.observe(e => applyYChangeToStore(e, 
      (id, data) => {
        const existing = useProjectStore.getState().assets.find(a => a.id === id);
        if (existing) useProjectStore.getState().updateAsset(id, data, true);
        else useProjectStore.getState().addAsset(data, true);
      },
      (id) => useProjectStore.getState().removeAsset(id, true)
    ));

    yWalls.observe(e => applyYChangeToStore(e,
      (id, data) => {
        const existing = useProjectStore.getState().walls.find(w => w.id === id);
        if (existing) useProjectStore.getState().updateWall(id, data, true);
        else useProjectStore.getState().addWall(data, true);
      },
      (id) => useProjectStore.getState().removeWall(id, true)
    ));

    yShapes.observe(e => applyYChangeToStore(e,
      (id, data) => {
        const existing = useProjectStore.getState().shapes.find(s => s.id === id);
        if (existing) useProjectStore.getState().updateShape(id, data, true);
        else useProjectStore.getState().addShape(data, true);
      },
      (id) => useProjectStore.getState().removeShape(id, true)
    ));

    yAnnotations.observe(e => applyYChangeToStore(e,
      (id, data) => {
        const existing = useProjectStore.getState().textAnnotations.find(a => a.id === id);
        if (existing) useProjectStore.getState().updateTextAnnotation(id, data, true);
        else useProjectStore.getState().addTextAnnotation(data, true);
      },
      (id) => useProjectStore.getState().removeTextAnnotation(id, true)
    ));

    yArrows.observe(e => applyYChangeToStore(e,
      (id, data) => {
        const existing = useProjectStore.getState().labelArrows.find(a => a.id === id);
        if (existing) useProjectStore.getState().updateLabelArrow(id, data, true);
        else useProjectStore.getState().addLabelArrow(data, true);
      },
      (id) => useProjectStore.getState().removeLabelArrow(id, true)
    ));

    yDimensions.observe(e => applyYChangeToStore(e,
      (id, data) => {
        const existing = useProjectStore.getState().dimensions.find(d => d.id === id);
        if (existing) useProjectStore.getState().updateDimension(id, data, true);
        else useProjectStore.getState().addDimension(data, true);
      },
      (id) => useProjectStore.getState().removeDimension(id, true)
    ));

    yGroups.observe(e => applyYChangeToStore(e,
      (id, data) => {
        const existing = useProjectStore.getState().groups.find(g => g.id === id);
        if (existing) useProjectStore.getState().updateGroup(id, data);
        else useProjectStore.getState().addGroup(data, true);
      },
      (id) => useProjectStore.getState().removeGroup(id)
    ));

    yWallSegments.observe(e => applyYChangeToStore(e,
      (id, data) => {
        const existing = useProjectStore.getState().wallSegments.find(s => s.id === id);
        if (existing) useProjectStore.getState().updateWallSegment(id, data);
        else useProjectStore.getState().addWallSegment(data);
      },
      (id) => useProjectStore.getState().removeWallSegment(id)
    ));

    yComments.observe(e => applyYChangeToStore(e,
      (id, data) => {
        const existing = useProjectStore.getState().comments.find(c => c.id === id);
        if (existing) useProjectStore.getState().updateComment(id, data);
        else useProjectStore.getState().addComment(data, true);
      },
      (id) => useProjectStore.getState().removeComment(id, true)
    ));

    yCanvas.observe(e => {
      if (e.transaction.origin === 'local-sync') return;
      isRemoteUpdating.current = true;
      const canvas = yCanvas.get('config');
      if (canvas) useProjectStore.getState().setCanvas(canvas);
      isRemoteUpdating.current = false;
    });

    // 6.b Initial Push (Push existing store data to Y.js if empty or for merging)
    ydoc.transact(() => {
      const state = useProjectStore.getState();
      state.assets.forEach(a => { if (!yAssets.has(a.id)) yAssets.set(a.id, a); });
      state.walls.forEach(w => { if (!yWalls.has(w.id)) yWalls.set(w.id, w); });
      state.shapes.forEach(s => { if (!yShapes.has(s.id)) yShapes.set(s.id, s); });
      state.textAnnotations.forEach(a => { if (!yAnnotations.has(a.id)) yAnnotations.set(a.id, a); });
      state.labelArrows.forEach(a => { if (!yArrows.has(a.id)) yArrows.set(a.id, a); });
      state.dimensions.forEach(d => { if (!yDimensions.has(d.id)) yDimensions.set(d.id, d); });
      state.groups.forEach(g => { if (!yGroups.has(g.id)) yGroups.set(g.id, g); });
      state.wallSegments.forEach(s => { if (!yWallSegments.has(s.id)) yWallSegments.set(s.id, s); });
      state.comments.forEach(c => { if (!yComments.has(c.id)) yComments.set(c.id, c); });
      if (!yCanvas.has('config')) yCanvas.set('config', state.canvas);
    }, 'local-sync');

    // 7. Subscribe to local store changes and push to Y.js
    let lastKnownState = useProjectStore.getState();
    
    const unsubscribe = useProjectStore.subscribe((state) => {
      if (isRemoteUpdating.current) {
        lastKnownState = state;
        return;
      }

      const prevState = lastKnownState;
      lastKnownState = state;

      const syncCollection = <T extends { id: string }>(
        currentItems: T[],
        previousItems: T[],
        targetMap: Y.Map<any>
      ) => {
        const previousById = new Map(previousItems.map((item) => [item.id, item]));

        currentItems.forEach((item) => {
          const previousItem = previousById.get(item.id);
          if (item !== previousItem) {
            targetMap.set(item.id, item);
          }
          previousById.delete(item.id);
        });

        previousById.forEach((_, id) => {
          targetMap.delete(id);
        });
      };

      ydoc.transact(() => {
        // Sync Assets
        if (state.assets !== prevState.assets) {
          syncCollection(state.assets, prevState.assets, yAssets);
        }

        // Sync Walls
        if (state.walls !== prevState.walls) {
          syncCollection(state.walls, prevState.walls, yWalls);
        }

        // Sync Shapes
        if (state.shapes !== prevState.shapes) {
          syncCollection(state.shapes, prevState.shapes, yShapes);
        }

        // Sync Annotations
        if (state.textAnnotations !== prevState.textAnnotations) {
          syncCollection(state.textAnnotations, prevState.textAnnotations, yAnnotations);
        }

        // Sync Arrows
        if (state.labelArrows !== prevState.labelArrows) {
          syncCollection(state.labelArrows, prevState.labelArrows, yArrows);
        }

        // Sync Dimensions
        if (state.dimensions !== prevState.dimensions) {
          syncCollection(state.dimensions, prevState.dimensions, yDimensions);
        }

        // Sync Groups
        if (state.groups !== prevState.groups) {
          syncCollection(state.groups, prevState.groups, yGroups);
        }

        // Sync Wall Segments
        if (state.wallSegments !== prevState.wallSegments) {
          syncCollection(state.wallSegments, prevState.wallSegments, yWallSegments);
        }

        // Sync Comments
        if (state.comments !== prevState.comments) {
          syncCollection(state.comments, prevState.comments, yComments);
        }

        // Sync Canvas
        if (state.canvas !== prevState.canvas) {
          yCanvas.set('config', state.canvas);
        }
      }, 'local-sync');
    });

    return () => {
      if (cursorTimerRef.current) {
        clearTimeout(cursorTimerRef.current);
        cursorTimerRef.current = null;
      }
      unsubscribe();
      provider.disconnect();
      ydoc.destroy();
      providerRef.current = null;
      ydocRef.current = null;
    };
  }, [effectiveProjectId, effectiveEventId, user, getUserColor]);

  const updateCursor = useCallback((x: number, y: number) => {
    if (!providerRef.current) {
      return;
    }

    const cursor = { x, y };
    const sendCursor = (nextCursor: { x: number; y: number }) => {
      providerRef.current?.awareness.setLocalStateField('cursor', nextCursor);
    };

    const now = performance.now();
    const elapsed = now - lastCursorSentAtRef.current;
    const minInterval = 80;

    if (elapsed >= minInterval) {
      lastCursorSentAtRef.current = now;
      pendingCursorRef.current = null;
      sendCursor(cursor);
      return;
    }

    pendingCursorRef.current = cursor;
    if (cursorTimerRef.current) {
      return;
    }

    cursorTimerRef.current = setTimeout(() => {
      cursorTimerRef.current = null;
      const pendingCursor = pendingCursorRef.current;
      if (!pendingCursor) return;

      pendingCursorRef.current = null;
      lastCursorSentAtRef.current = performance.now();
      sendCursor(pendingCursor);
    }, Math.max(0, minInterval - elapsed));
  }, []);

  const updateTyping = useCallback((isTyping: boolean) => {
    if (providerRef.current) {
      providerRef.current.awareness.setLocalStateField('isTyping', isTyping);
    }
  }, []);

  return {
    activeUsers,
    isConnected,
    updateCursor,
    updateTyping,
    ydoc: ydocRef.current,
  };
};
