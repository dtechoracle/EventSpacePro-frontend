// Sentinel used when an event has no project (standalone event).
// The editor route is /dashboard/editor/[slug]/[eventId]; standalone events use
// slug === STANDALONE_SLUG and talk to the standalone /api/events endpoints.
export const STANDALONE_SLUG = "standalone";

export const isStandaloneSlug = (slug?: string | null): boolean =>
  slug === STANDALONE_SLUG;
