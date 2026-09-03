/**
 * Presence store — holds remote collaborator cursor / awareness state.
 *
 * Keeping this in a Zustand store (rather than React local useState inside
 * useCollaboration) is critical for performance. Every `cursor-move` event from
 * a collaborator used to call `setActiveUsers` on the hook, which caused
 * `Workspace2D` (the huge canvas component that consumes `useCollaboration`) to
 * re-render on every mouse-move from every collaborator. Moving the state here
 * means cursor updates only re-render the tiny `CursorOverlay` component that
 * subscribes to this store — the 4 000-line canvas is completely unaffected.
 */
import { create } from "zustand";
import { UserPresence } from "@/hooks/useCollaboration";

interface PresenceState {
  activeUsers: UserPresence[];
  setActiveUsers: (users: UserPresence[]) => void;
  mergePresenceUser: (user: UserPresence) => void;
  removePresenceUser: (userId: string) => void;
  clearPresence: () => void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
  activeUsers: [],

  setActiveUsers: (users) => set({ activeUsers: users }),

  mergePresenceUser: (mapped) =>
    set((state) => {
      const next = [...state.activeUsers];
      const identity = mapped.sessionId || mapped.userId;
      const index = next.findIndex(
        (entry) => (entry.sessionId || entry.userId) === identity
      );
      if (index >= 0) next[index] = { ...next[index], ...mapped };
      else next.push(mapped);
      next.sort((a, b) => a.userId.localeCompare(b.userId));
      return { activeUsers: next };
    }),

  removePresenceUser: (userId) =>
    set((state) => ({
      activeUsers: state.activeUsers.filter(
        (entry) => entry.userId !== userId
      ),
    })),

  clearPresence: () => set({ activeUsers: [] }),
}));
