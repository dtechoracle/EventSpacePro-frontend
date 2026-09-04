import { useEffect, useRef, useState, useCallback } from "react";
import * as Y from "yjs";
import { io, Socket } from "socket.io-client";
import Cookies from "js-cookie";
import { useRouter } from "next/router";
import { useUserStore } from "@/store/userStore";
import { useProjectStore } from "@/store/projectStore";
import { useEditorStore } from "@/store/editorStore";
import { apiRequest } from "@/helpers/Config";
import { setCollabAuthority, clearCollabAuthority } from "@/lib/collabAuthority";
import { isStandaloneSlug } from "@/lib/standaloneEvent";
import { usePresenceStore } from "@/store/presenceStore";
import {
  CollaborationHttpUser,
  CollaborationStatusPayload,
  initCollaborationSession,
} from "@/lib/collaborationApi";

const API_BASE_URL = process.env.NEXT_PUBLIC_API || "http://localhost:3001";
const SOCKET_BASE_URL = process.env.NEXT_PUBLIC_WS_BASE_URL || API_BASE_URL?.replace(/\/api\/?$/, '') || "http://localhost:3001";

export type UserPresence = {
  userId: string;
  userName: string;
  userAvatar?: string;
  cursor?: { x: number; y: number };
  isTyping?: boolean;
  color: string;
  lastSeen: string;
  role?: string;
  sessionId?: string;
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

/**
 * Coerce whatever the transport handed us into the byte array Yjs expects.
 *
 * The backend emits `update` as a `Uint8Array`. socket.io serialises that as a
 * binary attachment, and socket.io-client hands binary attachments to browser
 * code as an **ArrayBuffer** — not a Uint8Array. Without an ArrayBuffer branch
 * every inbound `yjs-update` and `yjs-sync` decoded to `null` and was silently
 * dropped, which is what stopped collaborative edits from ever crossing between
 * sessions. Keep every branch below: node/test callers send Buffers, older
 * clients send plain arrays, and the redis relay path sends base64.
 */
const toUint8Array = (source: unknown): Uint8Array | null => {
  if (source === null || source === undefined) return null;
  if (source instanceof Uint8Array) return source;
  // Any other typed array or DataView (also covers Node Buffers structurally).
  if (ArrayBuffer.isView(source)) {
    const view = source as ArrayBufferView;
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  }
  if (source instanceof ArrayBuffer) return new Uint8Array(source);
  if (Array.isArray(source)) return Uint8Array.from(source);
  if (typeof source === "object" && Array.isArray((source as any).data)) {
    return Uint8Array.from((source as any).data);
  }
  if (typeof source === "string") {
    try {
      const binary = atob(source);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return bytes;
    } catch { return null; }
  }
  return null;
};

const normalizeUpdatePayload = (payload: any): Uint8Array | null => {
  const source = payload?.update ?? payload?.data?.update ?? payload?.data ?? payload;
  const bytes = toUint8Array(source);
  // A zero-length update carries nothing and makes Y.applyUpdate throw.
  return bytes && bytes.byteLength > 0 ? bytes : null;
};

/** Byte length of a payload regardless of which shape the transport used. */
const updateByteLength = (payload: any): number =>
  normalizeUpdatePayload(payload)?.byteLength ?? 0;

/** Describes an undecodable payload well enough to debug it from a log line. */
const describePayload = (payload: any): string => {
  const source = payload?.update ?? payload?.data?.update ?? payload?.data ?? payload;
  const type = source === null || source === undefined
    ? String(source)
    : (source as any)?.constructor?.name || typeof source;
  const size = (source as any)?.byteLength ?? (source as any)?.length ?? "unknown";
  return `${type} (size: ${size}), payload keys: [${Object.keys(payload || {}).join(", ")}]`;
};

const toPlainYValue = (value: any) =>
  value && typeof value.toJSON === "function" ? value.toJSON() : value;

/**
 * Rooms are keyed by the project's mongo `_id`, never its slug — see
 * docs/frontend-collaboration-contract.md. The editor passes the slug in as
 * `projectId`, so treating that value as already-resolved made the hook open a
 * socket and call /init against the slug, then tear the whole session down and
 * redo it once the real id arrived. Wait for the id.
 */
const isProjectObjectId = (value?: string | null): value is string =>
  !!value && /^[a-f0-9]{24}$/i.test(value);

const extractUserArray = (payload: any): CollaborationHttpUser[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.users)) return payload.users;
  if (Array.isArray(payload?.activeUsers)) return payload.activeUsers;
  if (Array.isArray(payload?.data?.users)) return payload.data.users;
  if (Array.isArray(payload?.data?.activeUsers)) return payload.data.activeUsers;
  return [];
};

export const useCollaboration = (projectId: string | undefined, eventId: string | undefined) => {
  // activeUsers lives in usePresenceStore — NOT in React local state.
  // This is the critical performance fix: cursor-move events from collaborators
  // used to call setActiveUsers() here, which re-rendered the huge Workspace2D
  // component on every mouse move. Now only CursorOverlay (which subscribes to
  // the store) re-renders on cursor updates.
  const activeUsers = usePresenceStore((s) => s.activeUsers);
  const storeSetActiveUsers = usePresenceStore.getState().setActiveUsers;
  const storeMergePresenceUser = usePresenceStore.getState().mergePresenceUser;
  const storeRemovePresenceUser = usePresenceStore.getState().removePresenceUser;
  const storeClearPresence = usePresenceStore.getState().clearPresence;
  const [isConnected, setIsConnected] = useState(false);
  const [resolvedProjectId, setResolvedProjectId] = useState<string | null>(
    isProjectObjectId(projectId) ? projectId : null
  );
  const [roomId, setRoomId] = useState<string | null>(null);
  const [collaborationStatus, setCollaborationStatus] = useState<CollaborationStatusPayload | null>(null);
  const [collaborationError, setCollaborationError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  // Optimistic by default: a user whose collaboration status we cannot read is
  // still allowed to edit locally, exactly as before. We only drop to read-only
  // when the server positively tells us this account is a viewer.
  const [canEdit, setCanEdit] = useState(true);
  const [projectRole, setProjectRole] = useState<string | null>(null);

  const ydocRef = useRef<Y.Doc | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const roomIdRef = useRef<string | null>(null);
  const cursorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeUsersSignatureRef = useRef("");
  const lastCursorSentAtRef = useRef(0);
  const pendingCursorRef = useRef<{ x: number; y: number } | null>(null);
  const lastEmittedCursorRef = useRef<{ x: number; y: number } | null>(null);
  const userInfoCacheRef = useRef<Map<string, { userName?: string; userAvatar?: string; color?: string; role?: string }>>(new Map());
  const resolvedProjectIdRef = useRef<string | null>(
    isProjectObjectId(projectId) ? projectId : null
  );
  const [hasJoined, setHasJoined] = useState(false);
  const hasJoinedRef = useRef(false);
  const joinRequestedRef = useRef(false);
  const isInitializedRef = useRef(false);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const isRemoteUpdatingRef = useRef(false);

  const user = useUserStore((s) => s.user);
  const router = useRouter();

  // The presence callbacks and the main socket effect only ever need the
  // current user's id, but they used to close over the whole `user` object.
  // userStore replaces that object at least twice per page load (initial read,
  // then the profile fetch), which re-created every callback and tore the
  // socket effect down and back up mid-handshake — three connects, three
  // /init calls and four yjs-sync events for a single page load. Reading the id
  // through a ref keeps the callbacks stable, and the effect below keys off the
  // id string instead of the object identity.
  const currentUserId = user?._id;
  const currentUserIdRef = useRef<string | undefined>(currentUserId);
  currentUserIdRef.current = currentUserId;

  const effectiveProjectSlug = router.query.slug as string | undefined;
  const effectiveEventId = eventId || (router.query.id as string | undefined);

  const mapPresenceUser = useCallback((rawUser: CollaborationHttpUser): UserPresence | null => {
    const userId = rawUser.userId || rawUser._id || rawUser.id || rawUser.email;
    if (!userId) return null;

    const cached = userInfoCacheRef.current.get(userId);

    const rawName =
      rawUser.userName ||
      rawUser.name ||
      [rawUser?.user?.firstName, rawUser?.user?.lastName].filter(Boolean).join(" ").trim() ||
      rawUser.email ||
      cached?.userName ||
      "Unknown User";
    const userName = rawName.split(" ")[0] || rawName;

    const userAvatar = rawUser.userAvatar || rawUser.avatar || rawUser?.user?.avatar || cached?.userAvatar;
    const color = rawUser.color || cached?.color || "#999999";
    const role = rawUser.role || cached?.role;
    userInfoCacheRef.current.set(userId, {
      userName: rawName === "Unknown User" ? cached?.userName : rawName,
      userAvatar,
      color,
      role,
    });

    return {
      userId,
      userName,
      userAvatar,
      cursor: rawUser.cursor,
      isTyping: rawUser.isTyping,
      color,
      lastSeen: rawUser.lastSeen || new Date().toISOString(),
      role,
      sessionId: (rawUser as any).sessionId || (rawUser as any).socketId,
    };
  }, []);

  const setPresenceUsers = useCallback((users: CollaborationHttpUser[]) => {
    const mapped = users
      .map(mapPresenceUser)
      .filter((entry): entry is UserPresence => !!entry)
      .filter((entry) => entry.userId !== currentUserIdRef.current)
      .sort((a, b) => a.userId.localeCompare(b.userId));

    // Delegate to the Zustand presence store — does not cause Workspace2D re-render
    storeSetActiveUsers(mapped);
  }, [mapPresenceUser, storeSetActiveUsers]);

  const mergePresenceUser = useCallback((rawUser: CollaborationHttpUser) => {
    const mapped = mapPresenceUser(rawUser);
    if (!mapped || mapped.userId === currentUserIdRef.current) return;
    // Delegate to the Zustand presence store — does not cause Workspace2D re-render
    storeMergePresenceUser(mapped);
  }, [mapPresenceUser, storeMergePresenceUser]);

  const removePresenceUser = useCallback((userId?: string) => {
    if (!userId) return;
    storeRemovePresenceUser(userId);
  }, [storeRemovePresenceUser]);


  useEffect(() => {
    let isCancelled = false;

    const hydrateProjectId = async () => {
      const slug = projectId || effectiveProjectSlug;
      if (!slug) return;
      if (isStandaloneSlug(slug)) return;

      try {
        const project = await resolveProjectRecord(slug);
        const nextProjectId = project?._id || project?.id || null;

        // Surface the project's real owner so the editor stops labelling the
        // signed-in user as the owner regardless of their actual role.
        const owner = Array.isArray(project?.users)
          ? project.users.find((member: any) => member?.role === "owner")
          : null;
        if (owner) {
          const ownerUser = owner.user && typeof owner.user === "object" ? owner.user : null;
          const ownerName = [ownerUser?.firstName, ownerUser?.lastName]
            .filter(Boolean)
            .join(" ")
            .trim();
          useEditorStore
            .getState()
            .setProjectOwnerLabel(ownerName || owner.email || null);
        }
        console.log("[Collaboration] Resolved project:", slug, "->", nextProjectId);
        if (!isCancelled && nextProjectId) {
          resolvedProjectIdRef.current = nextProjectId;
          setResolvedProjectId(nextProjectId);
        }
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
    if (!isProjectObjectId(resolvedProjectId) || !effectiveEventId || !currentUserId) return;

    const token = Cookies.get("authToken");
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;
    hasJoinedRef.current = false;
    joinRequestedRef.current = false;
    setHasJoined(false);
    setCollaborationError(null);
    isInitializedRef.current = false;
    const isRemoteUpdating = isRemoteUpdatingRef;

    const yAssets = ydoc.getMap<any>("yAssets");
    const yWalls = ydoc.getMap<any>("yWalls");
    const yShapes = ydoc.getMap<any>("yShapes");
    const yAnnotations = ydoc.getMap<any>("yAnnotations");
    const yArrows = ydoc.getMap<any>("yArrows");
    const yDimensions = ydoc.getMap<any>("yDimensions");
    const yGroups = ydoc.getMap<any>("yGroups");
    const yCanvas = ydoc.getMap<any>("yCanvas");
    const yWallSegments = ydoc.getMap<any>("yWallSegments");
    const yComments = ydoc.getMap<any>("yComments");

    const readYCollection = (map: Y.Map<any>) =>
      Array.from(map.values()).map((value) => toPlainYValue(value)).filter(Boolean);

    const syncVisibleStoreFromYDoc = () => {
      const nextShapes = readYCollection(yShapes);
      const nextAssets = readYCollection(yAssets);
      const nextWalls = readYCollection(yWalls);
      const nextTextAnnotations = readYCollection(yAnnotations);
      const nextDimensions = readYCollection(yDimensions);
      const nextLabelArrows = readYCollection(yArrows);
      const nextGroups = readYCollection(yGroups);
      const nextWallSegments = readYCollection(yWallSegments);
      const nextComments = readYCollection(yComments);
      const nextCanvas = toPlainYValue(yCanvas.get("config"));

      const hasRoomContent =
        nextShapes.length > 0 ||
        nextAssets.length > 0 ||
        nextWalls.length > 0 ||
        nextTextAnnotations.length > 0 ||
        nextDimensions.length > 0 ||
        nextLabelArrows.length > 0 ||
        nextGroups.length > 0 ||
        nextWallSegments.length > 0 ||
        nextComments.length > 0 ||
        !!nextCanvas;

      if (!hasRoomContent) {
        return false;
      }

      isRemoteUpdating.current = true;
      try {
        useProjectStore.setState((state) => ({
          ...state,
          shapes: nextShapes,
          assets: nextAssets,
          walls: nextWalls,
          textAnnotations: nextTextAnnotations,
          dimensions: nextDimensions,
          labelArrows: nextLabelArrows,
          groups: nextGroups,
          wallSegments: nextWallSegments,
          comments: nextComments,
          ...(nextCanvas ? { canvas: nextCanvas } : {}),
          hasUnsavedChanges: false,
        }));
      } finally {
        isRemoteUpdating.current = false;
      }

      return true;
    };

    // ─── Step 1: Connect socket with auth token ───
    console.log("[Collaboration] Step 1: Connecting socket...");
    const socket = io(SOCKET_BASE_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      auth: token ? { token } : undefined,
      query: token ? { token } : undefined,
    });
    socketRef.current = socket;

    // ─── Step 4 (inbound): Listen for yjs-sync / yjs-update ───
    const hasAppliedInitialSync = { current: false };

    const applyRemoteYUpdate = (payload: any, isInitialSync = false) => {
      const update = normalizeUpdatePayload(payload);
      if (!update) {
        // Never downgrade this to a warning: an undecodable update means this
        // client is now silently diverging from every other session.
        console.error(
          "[Collaboration] Could not decode inbound yjs update — dropping it.",
          describePayload(payload)
        );
        setCollaborationError("Could not read an update from the server. Reload to resync.");
        return;
      }

      // Snapshot the local store BEFORE applying the remote update. The initial
      // sync branch below uses it to decide whether to push local content into
      // the (empty) server room.
      const storeBefore = useProjectStore.getState();

      isRemoteUpdating.current = true;
      try {
        Y.applyUpdate(ydoc, update, "remote-sync");
      } finally {
        isRemoteUpdating.current = false;
      }

      if (isInitialSync && !hasAppliedInitialSync.current) {
        hasAppliedInitialSync.current = true;
        resendAttempts = 0;
        // We have read the room, so the Yjs document — not this client's REST
        // autosave — now owns `Event.canvasAssets`. See lib/collabAuthority.ts.
        setCollabAuthority(effectiveEventId || null);
        const storeItems = storeBefore.shapes.length + storeBefore.assets.length + storeBefore.walls.length +
          storeBefore.textAnnotations.length + storeBefore.dimensions.length + storeBefore.labelArrows.length +
          storeBefore.groups.length + storeBefore.wallSegments.length + storeBefore.comments.length;

        const appliedRoomSnapshot = syncVisibleStoreFromYDoc();

        if (appliedRoomSnapshot) {
          console.log("[Collaboration] Step 4: Applied server Yjs snapshot to visible store");
        } else if (storeItems === 0 && (yShapes.size > 0 || yAssets.size > 0 || yWalls.size > 0)) {
          console.log("[Collaboration] Step 4: Zustand empty, server has data — applied yjs-sync");
        } else if (storeItems > 0) {
          console.log("[Collaboration] Step 4: Both store and server have data — server wins via yjs-sync");
        } else {
          console.log("[Collaboration] Step 4: Both store and server empty — nothing to sync");
        }
      }
    };

    socket.on("yjs-sync", (payload) => {
      console.log("[Collaboration] Step 4: Received yjs-sync — server confirms join");

      // yjs-sync confirms we've joined the room. NOW safe to emit.
      hasJoinedRef.current = true;
      setHasJoined(true);
      setCollaborationError(null);
      console.log("[Collaboration] Step 4: hasJoined = true — safe to emit");
      applyRemoteYUpdate(payload, true);

      // Flush any updates that were buffered while waiting for join
      flushPendingUpdates();
    });

    // Inbound yjs updates are coalesced per animation frame. A remote drag
    // bursts many small deltas; applying each one synchronously made the local
    // canvas re-render the whole workspace N times per frame, which is what
    // felt like lag when a collaborator moved something. Buffering and merging
    // them into one apply per frame keeps the remote motion smooth.
    const pendingRemoteUpdates: { payload: any; isInitial: boolean }[] = [];
    let remoteApplyRaf = 0;
    let suppressYObservers = false;

    const flushRemoteUpdates = () => {
      remoteApplyRaf = 0;
      if (pendingRemoteUpdates.length === 0) return;
      const batch = pendingRemoteUpdates.splice(0, pendingRemoteUpdates.length);
      // Batch all inbound deltas into one Y apply + one Zustand sync to avoid
      // N setState per frame (each observer did its own setState).
      suppressYObservers = true;
      isRemoteUpdating.current = true;
      try {
        for (const { payload } of batch) {
          const update = normalizeUpdatePayload(payload);
          if (!update) continue;
          Y.applyUpdate(ydoc, update, "remote-sync");
        }
      } finally {
        suppressYObservers = false;
        isRemoteUpdating.current = false;
      }
      // Do NOT call syncVisibleStoreFromYDoc here for non-initial updates.
      // The Yjs observers (applyYChangeToStore) already applied each remote
      // change incrementally to Zustand. A full-state replacement would overwrite
      // unflushed local changes (moves, deletes) that haven't been pushed to Yjs
      // yet, causing them to revert.
      //
      // Full-state replacement is only needed on the initial sync when the
      // Zustand store is empty and we need to hydrate from the room.
      if (!hasAppliedInitialSync.current) {
        syncVisibleStoreFromYDoc();
      }

      // After remote updates are applied, flush any local changes that were
      // held back while isRemoteUpdating was true. This ensures local deletes
      // and moves get pushed to Yjs and are not lost.
      if (pendingHeldLocalFlush) {
        pendingHeldLocalFlush = false;
        requestAnimationFrame(() => flushLocalChanges());
      }
    };

    const scheduleRemoteFlush = () => {
      if (remoteApplyRaf === 0) {
        remoteApplyRaf = requestAnimationFrame(flushRemoteUpdates);
      }
    };

    socket.on("yjs-update", (payload) => {
      pendingRemoteUpdates.push({ payload, isInitial: false });
      scheduleRemoteFlush();
    });

    // Yjs observers → Zustand (apply remote changes to local store)
    //
    // Values read out of a Y.Map are not always plain objects. A live client
    // writes plain JSON, but when the backend rebuilds a room from persisted
    // Mongo data it reconstructs every nested object as a `Y.Map`, so
    // `target.get(key)` hands back a Y type. Storing that directly gave zustand
    // an object with no `id`, `type`, `x` or `y` — the item counted towards the
    // store totals but rendered as `translate(undefined, undefined)` and
    // collided with other malformed entries on React's `key`. Always take a
    // plain snapshot before it reaches the store.
    const applyYChangeToStore = (
      event: Y.YMapEvent<any>,
      storeAction: (id: string, data: any) => void,
      removeAction: (id: string) => void,
      collectionName?: string
    ) => {
      if (suppressYObservers) return;
      if (event.transaction.origin === "local-sync") return;

      isRemoteUpdating.current = true;
      event.changes.keys.forEach((change, key) => {
        if (change.action === "add" || change.action === "update") {
          const value = toPlainYValue(event.target.get(key));
          storeAction(key, value);
        } else if (change.action === "delete") {
          removeAction(key);
        }
      });
      useProjectStore.setState((s) => ({ ...s, hasUnsavedChanges: true }));
      isRemoteUpdating.current = false;
    };

    yAssets.observe((event) => applyYChangeToStore(event,
      (id, data) => {
        const existing = useProjectStore.getState().assets.find((a) => a.id === id);
        if (existing) useProjectStore.getState().updateAsset(id, data, true);
        else useProjectStore.getState().addAsset(data, true);
      },
      (id) => useProjectStore.getState().removeAsset(id, true),
      "assets"
    ));

    yWalls.observe((event) => applyYChangeToStore(event,
      (id, data) => {
        const existing = useProjectStore.getState().walls.find((w) => w.id === id);
        if (existing) useProjectStore.getState().updateWall(id, data, true);
        else useProjectStore.getState().addWall(data, true);
      },
      (id) => useProjectStore.getState().removeWall(id, true),
      "walls"
    ));

    yShapes.observe((event) => applyYChangeToStore(event,
      (id, data) => {
        const existing = useProjectStore.getState().shapes.find((s) => s.id === id);
        if (existing) useProjectStore.getState().updateShape(id, data, true);
        else useProjectStore.getState().addShape(data, true);
      },
      (id) => useProjectStore.getState().removeShape(id, true),
      "shapes"
    ));

    yAnnotations.observe((event) => applyYChangeToStore(event,
      (id, data) => {
        const existing = useProjectStore.getState().textAnnotations.find((a) => a.id === id);
        if (existing) useProjectStore.getState().updateTextAnnotation(id, data, true);
        else useProjectStore.getState().addTextAnnotation(data, true);
      },
      (id) => useProjectStore.getState().removeTextAnnotation(id, true),
      "textAnnotations"
    ));

    yArrows.observe((event) => applyYChangeToStore(event,
      (id, data) => {
        const existing = useProjectStore.getState().labelArrows.find((a) => a.id === id);
        if (existing) useProjectStore.getState().updateLabelArrow(id, data, true);
        else useProjectStore.getState().addLabelArrow(data, true);
      },
      (id) => useProjectStore.getState().removeLabelArrow(id, true),
      "labelArrows"
    ));

    yDimensions.observe((event) => applyYChangeToStore(event,
      (id, data) => {
        const existing = useProjectStore.getState().dimensions.find((d) => d.id === id);
        if (existing) useProjectStore.getState().updateDimension(id, data, true);
        else useProjectStore.getState().addDimension(data, true);
      },
      (id) => useProjectStore.getState().removeDimension(id, true),
      "dimensions"
    ));

    yGroups.observe((event) => applyYChangeToStore(event,
      (id, data) => {
        const existing = useProjectStore.getState().groups.find((g) => g.id === id);
        if (existing) useProjectStore.getState().updateGroup(id, data, true);
        else useProjectStore.getState().addGroup(data, true);
      },
      (id) => useProjectStore.getState().removeGroup(id, true),
      "groups"
    ));

    yWallSegments.observe((event) => applyYChangeToStore(event,
      (id, data) => {
        const existing = useProjectStore.getState().wallSegments.find((s) => s.id === id);
        if (existing) useProjectStore.getState().updateWallSegment(id, data, true);
        else useProjectStore.getState().addWallSegment(data, true);
      },
      (id) => useProjectStore.getState().removeWallSegment(id, true),
      "wallSegments"
    ));

    yComments.observe((event) => applyYChangeToStore(event,
      (id, data) => {
        const existing = useProjectStore.getState().comments.find((c) => c.id === id);
        if (existing) useProjectStore.getState().updateComment(id, data, true);
        else useProjectStore.getState().addComment(data, true);
      },
      (id) => useProjectStore.getState().removeComment(id, true),
      "comments"
    ));

    yCanvas.observe((event) => {
      if (suppressYObservers) return;
      if (event.transaction.origin === "local-sync") return;
      isRemoteUpdating.current = true;
      const canvas = toPlainYValue(yCanvas.get("config"));
      if (canvas) useProjectStore.getState().setCanvas(canvas, true);
      isRemoteUpdating.current = false;
    });

    // ─── Step 5 (outbound): Local edits → Yjs → socket ───
    const syncCollection = <T extends { id: string }>(
      currentItems: T[],
      previousItems: T[],
      targetMap: Y.Map<any>,
      collectionName?: string
    ) => {
      const previousById = new Map(previousItems.map((item) => [item.id, item]));

      currentItems.forEach((item) => {
        const previousItem = previousById.get(item.id);
        // Reference equality: if the object is the exact same reference,
        // nothing changed — skip the expensive write. Zustand always produces
        // new references for mutated items.
        if (previousItem !== item) {
          targetMap.set(item.id, { ...item });
        }
        previousById.delete(item.id);
      });

      previousById.forEach((_, id) => {
        targetMap.delete(id);
      });
    };

    let lastKnownState = useProjectStore.getState();
    // Coalesce local edits: store writes happen on every mouse-move / change,
    // and running a full ydoc.transact + BroadcastChannel full-state post on
    // each one made two-person sessions lag badly. Batch changes per animation
    // frame so a drag frame collapses to ONE ydoc diff + ONE broadcast.
    let pendingLocalState = useProjectStore.getState();
    let localSyncRaf = 0;
    let dragThrottleTimer: ReturnType<typeof setTimeout> | null = null;
    let pendingHeldLocalFlush = false;

    const flushLocalChanges = () => {
      localSyncRaf = 0;
      if (dragThrottleTimer) {
        clearTimeout(dragThrottleTimer);
        dragThrottleTimer = null;
      }
      const state = pendingLocalState;

      if (isRemoteUpdating.current) {
        // Don't discard the pending state — flag it so flushRemoteUpdates
        // can retry the flush after the remote batch is applied. Previous
        // behavior stored lastKnownState and returned, which meant local
        // deletes and moves were silently lost when a remote update arrived
        // before the local flush could run.
        pendingHeldLocalFlush = true;
        return;
      }
      const previousState = lastKnownState;
      lastKnownState = state;

      const hasChanges =
        state.assets !== previousState.assets ||
        state.walls !== previousState.walls ||
        state.shapes !== previousState.shapes ||
        state.textAnnotations !== previousState.textAnnotations ||
        state.labelArrows !== previousState.labelArrows ||
        state.dimensions !== previousState.dimensions ||
        state.groups !== previousState.groups ||
        state.wallSegments !== previousState.wallSegments ||
        state.comments !== previousState.comments ||
        state.canvas !== previousState.canvas;

      if (!hasChanges) return;

      // BroadcastChannel: always broadcast (doesn't need backend join)
      const bc = broadcastChannelRef.current;
      if (bc) {
        try {
          const payload = JSON.stringify({
            type: "state-update",
            shapes: state.shapes,
            assets: state.assets,
            walls: state.walls,
            wallSegments: state.wallSegments,
            textAnnotations: state.textAnnotations,
            labelArrows: state.labelArrows,
            dimensions: state.dimensions,
            groups: state.groups,
            comments: state.comments,
            canvas: state.canvas,
          });
          bc.postMessage(payload);
        } catch (err) {
          console.error("[BroadcastChannel] Failed to broadcast:", err);
        }
      }

      // Yjs sync: only after the backend join AND after we have successfully
      // applied the server's initial state.
      //
      // The second condition is the important one. `syncCollection` below turns
      // "present in my previous local snapshot, absent now" into a hard
      // `targetMap.delete()`. If we were to write before reading the room, a
      // client whose local store is a subset of the room would delete every
      // object it has simply never seen — which is exactly how collaborators'
      // work went missing. If we could not read the room, we do not write to it.
      if (!hasJoinedRef.current) return;
      if (!hasAppliedInitialSync.current) {
        console.warn("[Collaboration] Holding local changes: initial server sync not applied yet");
        return;
      }

      ydoc.transact(() => {
        if (state.assets !== previousState.assets) syncCollection(state.assets, previousState.assets, yAssets, "assets");
        if (state.walls !== previousState.walls) syncCollection(state.walls, previousState.walls, yWalls, "walls");
        if (state.shapes !== previousState.shapes) syncCollection(state.shapes, previousState.shapes, yShapes, "shapes");
        if (state.textAnnotations !== previousState.textAnnotations) syncCollection(state.textAnnotations, previousState.textAnnotations, yAnnotations, "textAnnotations");
        if (state.labelArrows !== previousState.labelArrows) syncCollection(state.labelArrows, previousState.labelArrows, yArrows, "labelArrows");
        if (state.dimensions !== previousState.dimensions) syncCollection(state.dimensions, previousState.dimensions, yDimensions, "dimensions");
        if (state.groups !== previousState.groups) syncCollection(state.groups, previousState.groups, yGroups, "groups");
        if (state.wallSegments !== previousState.wallSegments) syncCollection(state.wallSegments, previousState.wallSegments, yWallSegments, "wallSegments");
        if (state.comments !== previousState.comments) syncCollection(state.comments, previousState.comments, yComments, "comments");
        if (state.canvas !== previousState.canvas) yCanvas.set("config", state.canvas);
      }, "local-sync");
    };

    const scheduleLocalFlush = () => {
      if (localSyncRaf === 0) {
        localSyncRaf = requestAnimationFrame(flushLocalChanges);
      }
    };

    const unsubscribe = useProjectStore.subscribe((state) => {
      if (isRemoteUpdating.current) {
        lastKnownState = state;
        return;
      }
      // Always track the latest state, even while dragging, so live preview and
      // final drop have the correct position. While dragging we throttle to
      // ~12Hz to keep live movement without 60Hz thrash.
      pendingLocalState = state;
      if (useEditorStore.getState().isDragging) {
        if (!dragThrottleTimer) {
          dragThrottleTimer = setTimeout(() => {
            dragThrottleTimer = null;
            flushLocalChanges();
          }, 80);
        }
        return;
      }
      // Only coalesce when the store actually changed relative to what we last
      // flushed (reference inequality), otherwise skip the rAF entirely.
      const prev = lastKnownState;
      const changed =
        state.assets !== prev.assets ||
        state.walls !== prev.walls ||
        state.shapes !== prev.shapes ||
        state.textAnnotations !== prev.textAnnotations ||
        state.labelArrows !== prev.labelArrows ||
        state.dimensions !== prev.dimensions ||
        state.groups !== prev.groups ||
        state.wallSegments !== prev.wallSegments ||
        state.comments !== prev.comments ||
        state.canvas !== prev.canvas;
      if (!changed) return;
      scheduleLocalFlush();
    });

    // When a drag ends, flush the final position immediately.
    const unsubscribeDragWatcher = useEditorStore.subscribe((state, prevState) => {
      if (prevState.isDragging && !state.isDragging) {
        if (dragThrottleTimer) {
          clearTimeout(dragThrottleTimer);
          dragThrottleTimer = null;
        }
        const prev = lastKnownState;
        const pending = pendingLocalState;
        const hasPendingChanges =
          pending.assets !== prev.assets ||
          pending.walls !== prev.walls ||
          pending.shapes !== prev.shapes ||
          pending.textAnnotations !== prev.textAnnotations ||
          pending.labelArrows !== prev.labelArrows ||
          pending.dimensions !== prev.dimensions ||
          pending.groups !== prev.groups ||
          pending.wallSegments !== prev.wallSegments ||
          pending.comments !== prev.comments ||
          pending.canvas !== prev.canvas;
        if (hasPendingChanges) {
          scheduleLocalFlush();
        }
      }
    });

    // ─── Pending updates buffer ───
    // Updates produced before join are buffered and flushed once the socket
    // confirms join (yjs-sync). This prevents losing edits made while the
    // socket is still connecting.
    const pendingUpdates: Uint8Array[] = [];
    let outboundDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    let pendingOutbound: Uint8Array[] = [];

    const flushOutbound = () => {
      outboundDebounceTimer = null;
      if (pendingOutbound.length === 0) return;
      if (!socket.connected || !hasJoinedRef.current || !roomIdRef.current) {
        // Can't send yet — move them to the pending buffer for later
        pendingUpdates.push(...pendingOutbound);
        pendingOutbound = [];
        return;
      }
      // Merge all pending updates into one Yjs update for fewer network packets
      const merged = Y.mergeUpdates(pendingOutbound);
      pendingOutbound = [];
      if (merged.byteLength === 0) return;
      socket.emit("yjs-update", {
        roomId: roomIdRef.current,
        update: Array.from(merged),
        userId: currentUserIdRef.current,
      });
    };

    // Yjs doc update → socket emit (debounced)
    ydoc.on("update", (update: Uint8Array, origin: any) => {
      if (origin === "remote-sync") return;
      if (!update || update.byteLength === 0) return;

      if (!hasJoinedRef.current || !socket.connected) {
        // Buffer for later flush
        pendingUpdates.push(update);
        return;
      }

      pendingOutbound.push(update);
      if (!outboundDebounceTimer) {
        outboundDebounceTimer = setTimeout(flushOutbound, 50);
      }
    });

    // Flush any buffered updates once the socket joins
    const flushPendingUpdates = () => {
      if (pendingUpdates.length === 0) return;
      if (!socket.connected || !hasJoinedRef.current || !roomIdRef.current) return;
      const merged = Y.mergeUpdates(pendingUpdates);
      pendingUpdates.length = 0;
      if (merged.byteLength === 0) return;
      socket.emit("yjs-update", {
        roomId: roomIdRef.current,
        update: Array.from(merged),
        userId: currentUserIdRef.current,
      });
    };

    // ─── Recovery: replay the full document after a rejected update ───
    // Bounded and backed off so a server that keeps refusing (a revoked role,
    // a room that no longer exists) cannot turn into a resend loop.
    let resendAttempts = 0;
    let resendTimer: ReturnType<typeof setTimeout> | null = null;
    const MAX_RESEND_ATTEMPTS = 5;

    const scheduleFullStateResend = () => {
      if (resendTimer) return;
      if (resendAttempts >= MAX_RESEND_ATTEMPTS) {
        console.error("[Collaboration] Giving up resending state after", resendAttempts, "attempts");
        setCollaborationError("Your changes could not be synced. Reload the page to resync.");
        return;
      }
      const delay = 500 * 2 ** resendAttempts;
      resendAttempts += 1;
      resendTimer = setTimeout(() => {
        resendTimer = null;
        if (!socket.connected || !hasJoinedRef.current || !roomIdRef.current) return;
        const fullState = Y.encodeStateAsUpdate(ydoc);
        socket.emit("yjs-update", {
          roomId: roomIdRef.current,
          update: Array.from(fullState),
          userId: currentUserIdRef.current,
        });
      }, delay);
    };

    // ─── Step 2 & 3: Init → join → wait for yjs-sync ───
    const joinRetryTimers: ReturnType<typeof setTimeout>[] = [];

    const doJoin = (reason: string) => {
      if (joinRequestedRef.current) return;
      if (!socket.connected) return;
      const currentRoomId = roomIdRef.current;
      if (!currentRoomId) return;
      joinRequestedRef.current = true;
      socket.emit("join-collaboration", {
        projectId: resolvedProjectId,
        eventId: effectiveEventId,
      });
    };

    socket.on("connect", () => {
      console.log("[Collaboration] Step 3: Socket connected");
      setIsConnected(true);
      setCollaborationError(null);
      doJoin("socket connected");
      // One bounded retry covers the case where /init is still in flight and
      // its own callback races with this handler.
      joinRetryTimers.push(setTimeout(() => doJoin("retry after connect"), 1000));
    });

    socket.on("disconnect", () => {
      console.log("[Collaboration] Socket disconnected");
      setIsConnected(false);
      hasJoinedRef.current = false;
      joinRequestedRef.current = false;
      hasAppliedInitialSync.current = false;
      setHasJoined(false);
      // NOTE: we intentionally do NOT clear collab authority here. A disconnect
      // is usually transient (socket.io reconnects and re-syncs within moments).
      // If we dropped authority, the next 30s autosave would send this client's
      // full local canvasAssets over REST and overwrite the collaboration room's
      // state — resurrecting deleted items and erasing collaborators' edits.
      // Authority is only released on a real teardown (collab error that tears
      // the session down, or the effect cleanup when leaving the editor).
    });

    // ─── Step 2: HTTP init to get the canonical roomId ───
    initCollaborationSession(resolvedProjectId, effectiveEventId)
      .then((status) => {
        setCollaborationStatus(status);
        const role = (status?.userRole || status?.role) as string | undefined;
        if (role) setProjectRole(role);
        setCanEdit(
          typeof status?.canEdit === "boolean" ? status.canEdit : role !== "viewer"
        );
        const nextRoomId = status?.roomId || `${resolvedProjectId}-${effectiveEventId}`;
        setRoomId(nextRoomId);
        roomIdRef.current = nextRoomId;
        console.log("[Collaboration] Step 2: /init succeeded. roomId:", nextRoomId);

        const statusUsers = extractUserArray(status);
        if (statusUsers.length > 0) setPresenceUsers(statusUsers);

        doJoin("/init resolved");
      })
      .catch((error) => {
        console.warn("[Collaboration] Step 2: /init failed:", error);
        const fallbackRoomId = `${resolvedProjectId}-${effectiveEventId}`;
        setRoomId(fallbackRoomId);
        roomIdRef.current = fallbackRoomId;
        console.log("[Collaboration] Step 2: Fallback roomId:", fallbackRoomId);

        doJoin("/init failed, using fallback roomId");
      });

    // ─── Presence events ───
    socket.on("users-list", (payload: any) => {
      const users = extractUserArray(payload);
      if (users.length > 0) {
        users.forEach((u: any) => {
          const uid = u.userId || u._id || u.id;
          if (uid) {
            const name = u.userName || u.name || [u?.user?.firstName, u?.user?.lastName].filter(Boolean).join(" ").trim() || u.email;
            const avatar = u.userAvatar || u.avatar || u?.user?.avatar;
            const cached = userInfoCacheRef.current.get(uid);
            userInfoCacheRef.current.set(uid, {
              userName: name || cached?.userName,
              userAvatar: avatar || cached?.userAvatar,
              color: u.color || cached?.color,
              role: u.role || cached?.role,
            });
          }
        });
        setPresenceUsers(users);
      }
    });

    socket.on("user-joined", (payload: any) => {
      const raw = payload?.user || payload;
      const uid = raw?.userId || raw?._id || raw?.id;
      if (uid) {
        const name = raw?.userName || raw?.name || [raw?.user?.firstName, raw?.user?.lastName].filter(Boolean).join(" ").trim() || raw?.email;
        const avatar = raw?.userAvatar || raw?.avatar || raw?.user?.avatar;
        const cached = userInfoCacheRef.current.get(uid);
        userInfoCacheRef.current.set(uid, {
          userName: name || cached?.userName,
          userAvatar: avatar || cached?.userAvatar,
          color: raw?.color || cached?.color,
          role: raw?.role || cached?.role,
        });
      }
      mergePresenceUser(raw);
    });

    socket.on("user-left", (payload: any) => {
      const uid = payload?.userId || payload?.id || payload;
      // user-left only fires when that user's LAST tab leaves — safe to remove
      removePresenceUser(uid);
    });

    socket.on("cursor-move", (payload: any) => {
      mergePresenceUser({
        ...payload,
        userId: payload?.userId || payload?.id,
        sessionId: payload?.sessionId || payload?.socketId,
        cursor: payload?.cursor || (payload?.x !== undefined && payload?.y !== undefined ? { x: payload.x, y: payload.y } : undefined),
      });
    });

    socket.on("typing-start", (payload: any) => {
      mergePresenceUser({ ...payload, userId: payload?.userId || payload?.id, isTyping: true });
    });

    socket.on("typing-stop", (payload: any) => {
      mergePresenceUser({ ...payload, userId: payload?.userId || payload?.id, isTyping: false });
    });

    // Per-session awareness (new event from backend)
    socket.on("awareness-sync", (payload: any) => {
      const states = payload?.states || payload;
      if (typeof states !== "object") return;
      Object.entries(states).forEach(([sessionId, state]: [string, any]) => {
        if (!state) return;
        mergePresenceUser({
          ...state,
          sessionId,
          userId: state.userId,
          cursor: state.cursor,
          isTyping: state.isTyping,
        });
      });
    });

    socket.on("awareness-update", (payload: any) => {
      mergePresenceUser({
        ...payload,
        userId: payload?.userId || payload?.id,
        sessionId: (payload as any).sessionId || (payload as any).socketId,
        cursor: payload?.cursor || payload?.awareness?.cursor,
        isTyping: payload?.isTyping ?? payload?.awareness?.isTyping,
      });
    });

    socket.on("collaboration-error", (payload: any) => {
      console.error("[Collaboration] collaboration-error:", payload);
      const message = String(payload?.message || payload?.error || "Collaboration sync failed");

      // "Busy syncing" means the backend Redis lock was held by the flush
      // worker. This is transient and self-resolving — the flush will release
      // the lock within seconds. Silently resend our state without showing
      // an error banner, since the user can't do anything about it and the
      // error would just cause confusion.
      if (/busy syncing/i.test(message)) {
        console.warn("[Collaboration] Room lock busy; resending state silently");
        scheduleFullStateResend();
        return;
      }

      setCollaborationError(message);

      // The server is the authority on roles. If it refuses an edit because we
      // are a viewer, reflect that in the UI immediately rather than letting the
      // user keep drawing into a document that will never be saved.
      if (/viewer/i.test(message)) {
        setCanEdit(false);
        setProjectRole("viewer");
        return;
      }

      // A rejected update is worse than it looks: we have already applied it to
      // our local document, so the room is now permanently missing that edit and
      // no later delta will reintroduce it. Resend the whole document state —
      // Yjs updates are idempotent, so replaying everything is safe and is the
      // only thing that actually repairs the divergence.
      if (/reload the room|reload to resync|changed in storage|snapshot is stale/i.test(message)) {
        console.warn("[Collaboration] Server requested room reload; rebuilding collaboration session");
        setCollaborationError("Canvas changed on the server. Resyncing...");
        hasJoinedRef.current = false;
        joinRequestedRef.current = false;
        hasAppliedInitialSync.current = false;
        setHasJoined(false);
        clearCollabAuthority(effectiveEventId || null);
        socket.disconnect();
        setReloadNonce((value) => value + 1);
        setRoomId(null);
        roomIdRef.current = null;
        return;
      }

      if (payload?.code === "UPDATE_FAILED" || /update failed/i.test(message)) {
        scheduleFullStateResend();
      }
    });

    // ─── Cleanup ───
    return () => {
      if (cursorTimerRef.current) {
        clearTimeout(cursorTimerRef.current);
        cursorTimerRef.current = null;
      }
      joinRetryTimers.forEach(clearTimeout);
      joinRetryTimers.length = 0;
      if (resendTimer) {
        clearTimeout(resendTimer);
        resendTimer = null;
      }
      // Flush any remaining outbound updates before disconnecting
      if (outboundDebounceTimer) {
        clearTimeout(outboundDebounceTimer);
        outboundDebounceTimer = null;
      }
      if (localSyncRaf !== 0) {
        cancelAnimationFrame(localSyncRaf);
        localSyncRaf = 0;
      }
      if (remoteApplyRaf !== 0) {
        cancelAnimationFrame(remoteApplyRaf);
        remoteApplyRaf = 0;
      }
      if (dragThrottleTimer) {
        clearTimeout(dragThrottleTimer);
        dragThrottleTimer = null;
      }
      pendingRemoteUpdates.length = 0;
      flushOutbound();
      unsubscribe();
      unsubscribeDragWatcher();
      socket.removeAllListeners();
      socket.disconnect();
      clearCollabAuthority(effectiveEventId || null);
      socketRef.current = null;
      roomIdRef.current = null;
      hasJoinedRef.current = false;
      joinRequestedRef.current = false;
      hasAppliedInitialSync.current = false;
      setHasJoined(false);
      isInitializedRef.current = false;
      ydoc.destroy();
      ydocRef.current = null;
      setIsConnected(false);
      // Clear presence so stale cursors don't linger after disconnecting
      usePresenceStore.getState().clearPresence();
    };
  }, [
    effectiveEventId,
    resolvedProjectId,
    setPresenceUsers,
    mergePresenceUser,
    removePresenceUser,
    // Key off the id, never the user object: userStore hands back a fresh
    // object on every profile read, and depending on it restarted the whole
    // socket handshake mid-flight.
    currentUserId,
    reloadNonce,
  ]);

  // ─── BroadcastChannel: instant sync between same-browser tabs ───
  // Runs independently of socket/ydoc — works even when backend is down
  useEffect(() => {
    if (!effectiveEventId) return;

    const channelName = `collab-${effectiveEventId}`;
    console.log("[BroadcastChannel] Opening channel:", channelName);
    const channel = new BroadcastChannel(channelName);
    broadcastChannelRef.current = channel;

    channel.onmessage = (event) => {
      const raw = event.data;
      if (!raw) return;

      let msg: any;
      if (typeof raw === "string") {
        try { msg = JSON.parse(raw); } catch { return; }
      } else if (typeof raw === "object" && raw !== null) {
        msg = raw;
      } else {
        return;
      }

      if (!msg.type) return;

      if (msg.type === "request-state") {
        const store = useProjectStore.getState();
        try {
          const payload = JSON.stringify({
            type: "state-sync",
            shapes: store.shapes,
            assets: store.assets,
            walls: store.walls,
            wallSegments: store.wallSegments,
            textAnnotations: store.textAnnotations,
            labelArrows: store.labelArrows,
            dimensions: store.dimensions,
            groups: store.groups,
            comments: store.comments,
            canvas: store.canvas,
          });
          channel.postMessage(payload);
        } catch (err) {
          console.error("[BroadcastChannel] Failed to send state-sync:", err);
        }
        return;
      }

      if (msg.type === "state-sync" || msg.type === "state-update") {
        isRemoteUpdatingRef.current = true;
        useProjectStore.setState({
          ...(msg.shapes != null ? { shapes: msg.shapes } : {}),
          ...(msg.assets != null ? { assets: msg.assets } : {}),
          ...(msg.walls != null ? { walls: msg.walls } : {}),
          ...(msg.wallSegments != null ? { wallSegments: msg.wallSegments } : {}),
          ...(msg.textAnnotations != null ? { textAnnotations: msg.textAnnotations } : {}),
          ...(msg.labelArrows != null ? { labelArrows: msg.labelArrows } : {}),
          ...(msg.dimensions != null ? { dimensions: msg.dimensions } : {}),
          ...(msg.groups != null ? { groups: msg.groups } : {}),
          ...(msg.comments != null ? { comments: msg.comments } : {}),
          ...(msg.canvas != null ? { canvas: msg.canvas } : {}),
        });
        isRemoteUpdatingRef.current = false;
        const after = useProjectStore.getState();
        console.log("[BroadcastChannel] Applied state from other tab. Shapes:", after.shapes.length);
      }
    };

    channel.postMessage(JSON.stringify({ type: "request-state" }));

    return () => {
      console.log("[BroadcastChannel] Closing channel:", channelName);
      channel.close();
      broadcastChannelRef.current = null;
    };
  }, [effectiveEventId]);

  const updateCursor = useCallback((x: number, y: number) => {
    const lastSent = lastEmittedCursorRef.current;
    if (lastSent && Math.hypot(lastSent.x - x, lastSent.y - y) < 5 && performance.now() - lastCursorSentAtRef.current < 120) {
      return;
    }
    const emitCursor = (nextCursor: { x: number; y: number }) => {
      if (!socketRef.current || !roomIdRef.current || !hasJoinedRef.current) return;
      lastEmittedCursorRef.current = nextCursor;
      socketRef.current.emit("cursor-move", {
        roomId: roomIdRef.current,
        cursor: nextCursor,
        userId: currentUserIdRef.current,
      });
    };

    const cursor = { x, y };
    const now = performance.now();
    const elapsed = now - lastCursorSentAtRef.current;
    const minInterval = 120;

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
    if (!socketRef.current || !roomIdRef.current || !hasJoinedRef.current) return;
    socketRef.current.emit(isTyping ? "typing-start" : "typing-stop", {
      roomId: roomIdRef.current,
      userId: currentUserIdRef.current,
    });
    socketRef.current.emit("awareness-update", {
      roomId: roomIdRef.current,
      awareness: { isTyping },
      userId: currentUserIdRef.current,
    });
  }, []);

  return {
    activeUsers,
    isConnected,
    updateCursor,
    updateTyping,
    collaborationStatus,
    collaborationError,
    resolvedProjectId,
    roomId,
    ydoc: ydocRef.current,
    hasJoined,
    canEdit,
    projectRole,
  };
};
