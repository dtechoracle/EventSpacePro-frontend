import { useEffect, useRef, useState, useCallback } from "react";
import * as Y from "yjs";
import { io, Socket } from "socket.io-client";
import Cookies from "js-cookie";
import { useRouter } from "next/router";
import { useUserStore } from "@/store/userStore";
import { useProjectStore } from "@/store/projectStore";
import { apiRequest } from "@/helpers/Config";
import {
  CollaborationHttpUser,
  CollaborationStatusPayload,
  forceSyncCollaborationRoom,
  getCollaborationStatus,
  getCollaborationUsers,
  initCollaborationSession,
} from "@/lib/collaborationApi";

const API_BASE_URL = process.env.NEXT_PUBLIC_API || "http://localhost:3001";
const SOCKET_BASE_URL = process.env.NEXT_PUBLIC_WS_BASE_URL || API_BASE_URL || "http://localhost:3001";

export type UserPresence = {
  userId: string;
  userName: string;
  userAvatar?: string;
  cursor?: { x: number; y: number };
  isTyping?: boolean;
  color: string;
  lastSeen: string;
  role?: string;
};

const resolveProjectRecord = async (slug: string) => {
  try {
    const res = await apiRequest(`/projects/${slug}`, "GET", null, true);
    return res?.data || res;
  } catch {
    const allRes = await apiRequest("/projects", "GET", null, true);
    const list = allRes?.data || allRes || [];
    return Array.isArray(list) ? list.find((p: any) => p.slug === slug) : null;
  }
};

const normalizeUpdatePayload = (payload: any): Uint8Array | null => {
  const source = payload?.update ?? payload?.data?.update ?? payload?.data ?? payload;
  if (!source) return null;
  if (source instanceof Uint8Array) return source;
  if (Array.isArray(source)) return Uint8Array.from(source);
  if (typeof source === "object" && Array.isArray(source.data)) return Uint8Array.from(source.data);
  return null;
};

const extractUserArray = (payload: any): CollaborationHttpUser[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.users)) return payload.users;
  if (Array.isArray(payload?.activeUsers)) return payload.activeUsers;
  if (Array.isArray(payload?.data?.users)) return payload.data.users;
  if (Array.isArray(payload?.data?.activeUsers)) return payload.data.activeUsers;
  return [];
};

export const useCollaboration = (projectId: string | undefined, eventId: string | undefined) => {
  const [activeUsers, setActiveUsers] = useState<UserPresence[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [resolvedProjectId, setResolvedProjectId] = useState<string | null>(projectId || null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [collaborationStatus, setCollaborationStatus] = useState<CollaborationStatusPayload | null>(null);

  const ydocRef = useRef<Y.Doc | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const roomIdRef = useRef<string | null>(null);
  const cursorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeUsersSignatureRef = useRef("");
  const lastCursorSentAtRef = useRef(0);
  const pendingCursorRef = useRef<{ x: number; y: number } | null>(null);

  const user = useUserStore((s) => s.user);
  const router = useRouter();

  const effectiveProjectSlug = router.query.slug as string | undefined;
  const effectiveEventId = eventId || (router.query.id as string | undefined);

  const getUserColor = useCallback((userId: string) => {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash) % 360;
    return `hsl(${h}, 70%, 50%)`;
  }, []);

  const mapPresenceUser = useCallback((rawUser: CollaborationHttpUser): UserPresence | null => {
    const userId = rawUser.userId || rawUser._id || rawUser.id || rawUser.email;
    if (!userId) return null;

    const userName =
      rawUser.userName ||
      rawUser.name ||
      [rawUser?.user?.firstName, rawUser?.user?.lastName].filter(Boolean).join(" ").trim() ||
      rawUser.email ||
      "Unknown User";

    return {
      userId,
      userName,
      userAvatar: rawUser.userAvatar || rawUser.avatar || rawUser?.user?.avatar,
      cursor: rawUser.cursor,
      isTyping: rawUser.isTyping,
      color: rawUser.color || getUserColor(userId),
      lastSeen: rawUser.lastSeen || new Date().toISOString(),
      role: rawUser.role,
    };
  }, [getUserColor]);

  const setPresenceUsers = useCallback((users: CollaborationHttpUser[]) => {
    const mapped = users
      .map(mapPresenceUser)
      .filter((entry): entry is UserPresence => !!entry)
      .filter((entry) => entry.userId !== user?._id)
      .sort((a, b) => a.userId.localeCompare(b.userId));

    const signature = JSON.stringify(
      mapped.map((activeUser) => [
        activeUser.userId,
        activeUser.cursor?.x ?? null,
        activeUser.cursor?.y ?? null,
        activeUser.isTyping ?? false,
        activeUser.lastSeen,
        activeUser.role ?? null,
      ])
    );

    if (signature !== activeUsersSignatureRef.current) {
      activeUsersSignatureRef.current = signature;
      setActiveUsers(mapped);
    }
  }, [mapPresenceUser, user?._id]);

  const mergePresenceUser = useCallback((rawUser: CollaborationHttpUser) => {
    const mapped = mapPresenceUser(rawUser);
    if (!mapped || mapped.userId === user?._id) return;

    setActiveUsers((prev) => {
      const next = [...prev];
      const index = next.findIndex((entry) => entry.userId === mapped.userId);
      if (index >= 0) next[index] = { ...next[index], ...mapped };
      else next.push(mapped);
      next.sort((a, b) => a.userId.localeCompare(b.userId));

      const signature = JSON.stringify(
        next.map((activeUser) => [
          activeUser.userId,
          activeUser.cursor?.x ?? null,
          activeUser.cursor?.y ?? null,
          activeUser.isTyping ?? false,
          activeUser.lastSeen,
          activeUser.role ?? null,
        ])
      );
      activeUsersSignatureRef.current = signature;
      return next;
    });
  }, [mapPresenceUser, user?._id]);

  const removePresenceUser = useCallback((userId?: string) => {
    if (!userId) return;
    setActiveUsers((prev) => {
      const next = prev.filter((entry) => entry.userId !== userId);
      const signature = JSON.stringify(
        next.map((activeUser) => [
          activeUser.userId,
          activeUser.cursor?.x ?? null,
          activeUser.cursor?.y ?? null,
          activeUser.isTyping ?? false,
          activeUser.lastSeen,
          activeUser.role ?? null,
        ])
      );
      activeUsersSignatureRef.current = signature;
      return next;
    });
  }, []);

  const refreshStatus = useCallback(async (explicitProjectId?: string) => {
    const activeProjectId = explicitProjectId || resolvedProjectId;
    if (!activeProjectId || !effectiveEventId) return null;
    const status = await getCollaborationStatus(activeProjectId, effectiveEventId);
    setCollaborationStatus(status);
    if (status?.roomId) {
      setRoomId(status.roomId);
      roomIdRef.current = status.roomId;
    }
    const statusUsers = extractUserArray(status);
    if (statusUsers.length > 0) setPresenceUsers(statusUsers);
    return status;
  }, [effectiveEventId, resolvedProjectId, setPresenceUsers]);

  const refreshUsers = useCallback(async (explicitProjectId?: string) => {
    const activeProjectId = explicitProjectId || resolvedProjectId;
    if (!activeProjectId || !effectiveEventId) return [];
    const usersPayload = await getCollaborationUsers(activeProjectId, effectiveEventId);
    const users = extractUserArray(usersPayload);
    if (users.length > 0) setPresenceUsers(users);
    return users;
  }, [effectiveEventId, resolvedProjectId, setPresenceUsers]);

  const forceSync = useCallback(async () => {
    if (!resolvedProjectId || !effectiveEventId) return null;
    return forceSyncCollaborationRoom(resolvedProjectId, effectiveEventId);
  }, [effectiveEventId, resolvedProjectId]);

  useEffect(() => {
    let isCancelled = false;

    const hydrateProjectId = async () => {
      if (projectId) {
        setResolvedProjectId(projectId);
        return;
      }

      if (!effectiveProjectSlug) return;

      try {
        const project = await resolveProjectRecord(effectiveProjectSlug);
        const nextProjectId = project?._id || project?.id || null;
        if (!isCancelled) setResolvedProjectId(nextProjectId);
      } catch (error) {
        console.error("[Collaboration] Failed to resolve project ID from slug:", error);
      }
    };

    hydrateProjectId();

    return () => {
      isCancelled = true;
    };
  }, [effectiveProjectSlug, projectId]);

  useEffect(() => {
    if (!resolvedProjectId || !effectiveEventId || !user) return;

    const token = Cookies.get("authToken");
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;
    const isRemoteUpdating = { current: false };

    const yAssets = ydoc.getMap<any>("assets");
    const yWalls = ydoc.getMap<any>("walls");
    const yShapes = ydoc.getMap<any>("shapes");
    const yAnnotations = ydoc.getMap<any>("annotations");
    const yArrows = ydoc.getMap<any>("arrows");
    const yDimensions = ydoc.getMap<any>("dimensions");
    const yGroups = ydoc.getMap<any>("groups");
    const yCanvas = ydoc.getMap<any>("canvas");
    const yWallSegments = ydoc.getMap<any>("wallSegments");
    const yComments = ydoc.getMap<any>("comments");

    const socket = io(SOCKET_BASE_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      auth: token ? { token } : undefined,
      query: token ? { token } : undefined,
    });
    socketRef.current = socket;

    const applyYChangeToStore = (
      event: Y.YMapEvent<any>,
      storeAction: (id: string, data: any) => void,
      removeAction: (id: string) => void
    ) => {
      if (event.transaction.origin === "local-sync") return;

      isRemoteUpdating.current = true;
      event.changes.keys.forEach((change, key) => {
        if (change.action === "add" || change.action === "update") {
          const value = event.target.get(key);
          storeAction(key, value);
        } else if (change.action === "delete") {
          removeAction(key);
        }
      });
      isRemoteUpdating.current = false;
    };

    yAssets.observe((event) => applyYChangeToStore(
      event,
      (id, data) => {
        const existing = useProjectStore.getState().assets.find((asset) => asset.id === id);
        if (existing) useProjectStore.getState().updateAsset(id, data, true);
        else useProjectStore.getState().addAsset(data, true);
      },
      (id) => useProjectStore.getState().removeAsset(id, true)
    ));

    yWalls.observe((event) => applyYChangeToStore(
      event,
      (id, data) => {
        const existing = useProjectStore.getState().walls.find((wall) => wall.id === id);
        if (existing) useProjectStore.getState().updateWall(id, data, true);
        else useProjectStore.getState().addWall(data, true);
      },
      (id) => useProjectStore.getState().removeWall(id, true)
    ));

    yShapes.observe((event) => applyYChangeToStore(
      event,
      (id, data) => {
        const existing = useProjectStore.getState().shapes.find((shape) => shape.id === id);
        if (existing) useProjectStore.getState().updateShape(id, data, true);
        else useProjectStore.getState().addShape(data, true);
      },
      (id) => useProjectStore.getState().removeShape(id, true)
    ));

    yAnnotations.observe((event) => applyYChangeToStore(
      event,
      (id, data) => {
        const existing = useProjectStore.getState().textAnnotations.find((annotation) => annotation.id === id);
        if (existing) useProjectStore.getState().updateTextAnnotation(id, data, true);
        else useProjectStore.getState().addTextAnnotation(data, true);
      },
      (id) => useProjectStore.getState().removeTextAnnotation(id, true)
    ));

    yArrows.observe((event) => applyYChangeToStore(
      event,
      (id, data) => {
        const existing = useProjectStore.getState().labelArrows.find((arrow) => arrow.id === id);
        if (existing) useProjectStore.getState().updateLabelArrow(id, data, true);
        else useProjectStore.getState().addLabelArrow(data, true);
      },
      (id) => useProjectStore.getState().removeLabelArrow(id, true)
    ));

    yDimensions.observe((event) => applyYChangeToStore(
      event,
      (id, data) => {
        const existing = useProjectStore.getState().dimensions.find((dimension) => dimension.id === id);
        if (existing) useProjectStore.getState().updateDimension(id, data, true);
        else useProjectStore.getState().addDimension(data, true);
      },
      (id) => useProjectStore.getState().removeDimension(id, true)
    ));

    yGroups.observe((event) => applyYChangeToStore(
      event,
      (id, data) => {
        const existing = useProjectStore.getState().groups.find((group) => group.id === id);
        if (existing) useProjectStore.getState().updateGroup(id, data);
        else useProjectStore.getState().addGroup(data, true);
      },
      (id) => useProjectStore.getState().removeGroup(id)
    ));

    yWallSegments.observe((event) => applyYChangeToStore(
      event,
      (id, data) => {
        const existing = useProjectStore.getState().wallSegments.find((segment) => segment.id === id);
        if (existing) useProjectStore.getState().updateWallSegment(id, data);
        else useProjectStore.getState().addWallSegment(data);
      },
      (id) => useProjectStore.getState().removeWallSegment(id)
    ));

    yComments.observe((event) => applyYChangeToStore(
      event,
      (id, data) => {
        const existing = useProjectStore.getState().comments.find((comment) => comment.id === id);
        if (existing) useProjectStore.getState().updateComment(id, data);
        else useProjectStore.getState().addComment(data, true);
      },
      (id) => useProjectStore.getState().removeComment(id, true)
    ));

    yCanvas.observe((event) => {
      if (event.transaction.origin === "local-sync") return;
      isRemoteUpdating.current = true;
      const canvas = yCanvas.get("config");
      if (canvas) useProjectStore.getState().setCanvas(canvas);
      isRemoteUpdating.current = false;
    });

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

    let lastKnownState = useProjectStore.getState();
    const unsubscribe = useProjectStore.subscribe((state) => {
      if (isRemoteUpdating.current) {
        lastKnownState = state;
        return;
      }

      const previousState = lastKnownState;
      lastKnownState = state;

      ydoc.transact(() => {
        if (state.assets !== previousState.assets) syncCollection(state.assets, previousState.assets, yAssets);
        if (state.walls !== previousState.walls) syncCollection(state.walls, previousState.walls, yWalls);
        if (state.shapes !== previousState.shapes) syncCollection(state.shapes, previousState.shapes, yShapes);
        if (state.textAnnotations !== previousState.textAnnotations) syncCollection(state.textAnnotations, previousState.textAnnotations, yAnnotations);
        if (state.labelArrows !== previousState.labelArrows) syncCollection(state.labelArrows, previousState.labelArrows, yArrows);
        if (state.dimensions !== previousState.dimensions) syncCollection(state.dimensions, previousState.dimensions, yDimensions);
        if (state.groups !== previousState.groups) syncCollection(state.groups, previousState.groups, yGroups);
        if (state.wallSegments !== previousState.wallSegments) syncCollection(state.wallSegments, previousState.wallSegments, yWallSegments);
        if (state.comments !== previousState.comments) syncCollection(state.comments, previousState.comments, yComments);
        if (state.canvas !== previousState.canvas) yCanvas.set("config", state.canvas);
      }, "local-sync");
    });

    ydoc.on("update", (update, origin) => {
      if (origin === "remote-sync" || !socket.connected || !roomIdRef.current) return;
      socket.emit("yjs-update", {
        roomId: roomIdRef.current,
        update: Array.from(update),
      });
    });

    const refreshAllStatus = async () => {
      try {
        const status = await refreshStatus(resolvedProjectId);
        if (status?.roomId) {
          setRoomId(status.roomId);
          roomIdRef.current = status.roomId;
        } else if (!roomIdRef.current) {
          const fallbackRoomId = `${resolvedProjectId}-${effectiveEventId}`;
          setRoomId(fallbackRoomId);
          roomIdRef.current = fallbackRoomId;
        }
      } catch (error) {
        console.warn("[Collaboration] Failed to refresh collaboration status:", error);
      }

      try {
        await refreshUsers(resolvedProjectId);
      } catch (error) {
        console.warn("[Collaboration] Failed to refresh collaboration users:", error);
      }
    };

    initCollaborationSession(resolvedProjectId, effectiveEventId)
      .then((status) => {
        setCollaborationStatus(status);
        const nextRoomId = status?.roomId || `${resolvedProjectId}-${effectiveEventId}`;
        setRoomId(nextRoomId);
        roomIdRef.current = nextRoomId;
        const statusUsers = extractUserArray(status);
        if (statusUsers.length > 0) setPresenceUsers(statusUsers);
      })
      .catch((error) => {
        console.warn("[Collaboration] Failed to initialize collaboration session:", error);
        const fallbackRoomId = `${resolvedProjectId}-${effectiveEventId}`;
        setRoomId(fallbackRoomId);
        roomIdRef.current = fallbackRoomId;
      })
      .finally(() => {
        refreshAllStatus();
      });

    const pushInitialStoreState = () => {
      const state = useProjectStore.getState();
      ydoc.transact(() => {
        state.assets.forEach((asset) => { if (!yAssets.has(asset.id)) yAssets.set(asset.id, asset); });
        state.walls.forEach((wall) => { if (!yWalls.has(wall.id)) yWalls.set(wall.id, wall); });
        state.shapes.forEach((shape) => { if (!yShapes.has(shape.id)) yShapes.set(shape.id, shape); });
        state.textAnnotations.forEach((annotation) => { if (!yAnnotations.has(annotation.id)) yAnnotations.set(annotation.id, annotation); });
        state.labelArrows.forEach((arrow) => { if (!yArrows.has(arrow.id)) yArrows.set(arrow.id, arrow); });
        state.dimensions.forEach((dimension) => { if (!yDimensions.has(dimension.id)) yDimensions.set(dimension.id, dimension); });
        state.groups.forEach((group) => { if (!yGroups.has(group.id)) yGroups.set(group.id, group); });
        state.wallSegments.forEach((segment) => { if (!yWallSegments.has(segment.id)) yWallSegments.set(segment.id, segment); });
        state.comments.forEach((comment) => { if (!yComments.has(comment.id)) yComments.set(comment.id, comment); });
        if (!yCanvas.has("config")) yCanvas.set("config", state.canvas);
      }, "local-sync");
    };

    pushInitialStoreState();

    socket.on("connect", () => {
      setIsConnected(true);
      socket.emit("join-collaboration", {
        projectId: resolvedProjectId,
        eventId: effectiveEventId,
      });
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("users-list", (payload: any) => {
      const users = extractUserArray(payload);
      if (users.length > 0) setPresenceUsers(users);
    });

    socket.on("user-joined", (payload: any) => {
      mergePresenceUser(payload?.user || payload);
    });

    socket.on("user-left", (payload: any) => {
      removePresenceUser(payload?.userId || payload?.id || payload);
    });

    socket.on("cursor-move", (payload: any) => {
      mergePresenceUser({
        ...payload,
        userId: payload?.userId || payload?.id,
        cursor: payload?.cursor || (payload?.x !== undefined && payload?.y !== undefined ? { x: payload.x, y: payload.y } : undefined),
      });
    });

    socket.on("typing-start", (payload: any) => {
      mergePresenceUser({
        ...payload,
        userId: payload?.userId || payload?.id,
        isTyping: true,
      });
    });

    socket.on("typing-stop", (payload: any) => {
      mergePresenceUser({
        ...payload,
        userId: payload?.userId || payload?.id,
        isTyping: false,
      });
    });

    socket.on("awareness-update", (payload: any) => {
      mergePresenceUser({
        ...payload,
        userId: payload?.userId || payload?.id,
        cursor: payload?.cursor || payload?.awareness?.cursor,
        isTyping: payload?.isTyping ?? payload?.awareness?.isTyping,
      });
    });

    socket.on("collaboration-error", (payload: any) => {
      console.error("[Collaboration] collaboration-error:", payload);
    });

    const applyRemoteYUpdate = (payload: any) => {
      const update = normalizeUpdatePayload(payload);
      if (!update) return;
      Y.applyUpdate(ydoc, update, "remote-sync");
    };

    socket.on("yjs-sync", applyRemoteYUpdate);
    socket.on("yjs-update", applyRemoteYUpdate);

    statusIntervalRef.current = setInterval(() => {
      refreshAllStatus();
    }, 15000);

    syncIntervalRef.current = setInterval(() => {
      forceSyncCollaborationRoom(resolvedProjectId, effectiveEventId).catch((error) => {
        console.warn("[Collaboration] Periodic sync failed:", error);
      });
    }, 30000);

    return () => {
      if (statusIntervalRef.current) {
        clearInterval(statusIntervalRef.current);
        statusIntervalRef.current = null;
      }
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
      if (cursorTimerRef.current) {
        clearTimeout(cursorTimerRef.current);
        cursorTimerRef.current = null;
      }
      forceSyncCollaborationRoom(resolvedProjectId, effectiveEventId).catch((error) => {
        console.warn("[Collaboration] Final sync on cleanup failed:", error);
      });
      unsubscribe();
      socket.disconnect();
      socketRef.current = null;
      roomIdRef.current = null;
      ydoc.destroy();
      ydocRef.current = null;
      setIsConnected(false);
    };
  }, [
    effectiveEventId,
    refreshStatus,
    refreshUsers,
    resolvedProjectId,
    setPresenceUsers,
    mergePresenceUser,
    removePresenceUser,
    user,
  ]);

  const updateCursor = useCallback((x: number, y: number) => {
    const emitCursor = (nextCursor: { x: number; y: number }) => {
      if (!socketRef.current || !roomIdRef.current) return;
      socketRef.current.emit("cursor-move", {
        roomId: roomIdRef.current,
        cursor: nextCursor,
      });
      socketRef.current.emit("awareness-update", {
        roomId: roomIdRef.current,
        awareness: { cursor: nextCursor },
      });
    };

    const cursor = { x, y };
    const now = performance.now();
    const elapsed = now - lastCursorSentAtRef.current;
    const minInterval = 80;

    if (elapsed >= minInterval) {
      lastCursorSentAtRef.current = now;
      pendingCursorRef.current = null;
      emitCursor(cursor);
      return;
    }

    pendingCursorRef.current = cursor;
    if (cursorTimerRef.current) return;

    cursorTimerRef.current = setTimeout(() => {
      cursorTimerRef.current = null;
      const pendingCursor = pendingCursorRef.current;
      if (!pendingCursor) return;
      pendingCursorRef.current = null;
      lastCursorSentAtRef.current = performance.now();
      emitCursor(pendingCursor);
    }, Math.max(0, minInterval - elapsed));
  }, []);

  const updateTyping = useCallback((isTyping: boolean) => {
    if (!socketRef.current || !roomIdRef.current) return;
    socketRef.current.emit(isTyping ? "typing-start" : "typing-stop", {
      roomId: roomIdRef.current,
    });
    socketRef.current.emit("awareness-update", {
      roomId: roomIdRef.current,
      awareness: { isTyping },
    });
  }, []);

  return {
    activeUsers,
    isConnected,
    updateCursor,
    updateTyping,
    refreshStatus,
    refreshUsers,
    forceSync,
    collaborationStatus,
    resolvedProjectId,
    roomId,
    ydoc: ydocRef.current,
  };
};
