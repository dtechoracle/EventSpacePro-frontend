/**
 * Which writer currently owns `Event.canvasAssets`.
 *
 * Two independent paths write that single field:
 *
 *  1. `projectStore.saveEvent()` — a REST PUT of this client's *entire* local
 *     store, fired by `useAutoSave` every 30s and on explicit saves.
 *  2. The backend collaboration flush — it persists the room's Yjs snapshot to
 *     the same field.
 *
 * Neither merges and neither checks a version, so whichever ran last won the
 * whole field. When a client's local store was stale, its full-document PUT
 * erased collaborators' objects; when the Yjs snapshot was stale, the flush
 * erased whatever the PUT had just written.
 *
 * The rule is now: while this client is joined to a collaboration room and has
 * applied the room's state, the Yjs document is the single owner of the canvas
 * and the REST save must not send `canvasAssets` at all. The backend only
 * assigns fields that are present in the request body, so omitting it leaves
 * the collaboration-owned value untouched. Everything else on the event (name,
 * canvases, comments) still saves normally.
 *
 * When collaboration is unavailable — socket down, room never joined, initial
 * sync never applied — authority falls back to the REST save so a solo user
 * never loses work.
 */

let authoritativeEventId: string | null = null;

/** Called by useCollaboration once the room is joined and its state applied. */
export const setCollabAuthority = (eventId: string | null): void => {
  authoritativeEventId = eventId || null;
};

/** Release authority for `eventId`, or unconditionally when it is omitted. */
export const clearCollabAuthority = (eventId?: string | null): void => {
  if (!eventId || authoritativeEventId === eventId) {
    authoritativeEventId = null;
  }
};

/** True when the Yjs room owns the canvas for this event. */
export const isCollabAuthoritative = (eventId?: string | null): boolean =>
  !!eventId && authoritativeEventId === eventId;
