import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

/**
 * Dynamic route params that are also correct on a cold load.
 *
 * Every page under `pages/` here is auto-statically-optimized, so on a direct
 * hit — a refresh, a bookmark, a link someone shared — Next serves the static
 * shell and the client router starts with the raw pattern
 * (`asPath === "/dashboard/editor/[slug]/[id]"`, `query === {}`) until it
 * reconciles the real URL and flips `isReady`. On this deployment that
 * reconciliation never happens: `router.isReady` stays false forever and
 * `router.query` stays empty, so anything gated on it never runs. The editor
 * gates its event fetch on exactly that and rendered "No event data found" on
 * every refresh and every shared link, while the same page reached by clicking
 * through the dashboard worked fine.
 *
 * `window.location.pathname` is right from the first paint, so parse the params
 * out of it against the route pattern and use those until the router catches
 * up. When the router does become ready it wins — this only fills the gap.
 */
export const paramsFromPathname = (
  pattern: string,
  pathname: string,
): Record<string, string | string[]> => {
  const patternParts = pattern.split("/").filter(Boolean);
  const pathParts = pathname.split("/").filter(Boolean);
  const params: Record<string, string | string[]> = {};

  for (let i = 0; i < patternParts.length; i += 1) {
    const part = patternParts[i];
    if (!part.startsWith("[")) continue;

    const name = part.replace(/^\[+|\]+$/g, "").replace(/^\.\.\./, "");
    const isCatchAll = part.startsWith("[...") || part.startsWith("[[...");

    if (isCatchAll) {
      const rest = pathParts.slice(i).map(decodeURIComponent);
      if (rest.length > 0) params[name] = rest;
      break;
    }

    const value = pathParts[i];
    if (value !== undefined) params[name] = decodeURIComponent(value);
  }

  return params;
};

export const useRouteParams = (): {
  params: Record<string, any>;
  isReady: boolean;
} => {
  const router = useRouter();
  // Read the location only after mount: it does not exist while rendering on
  // the server, and reading it during the first client render would make that
  // render disagree with the server's markup.
  const [pathname, setPathname] = useState<string | null>(null);
  useEffect(() => {
    setPathname(window.location.pathname);
  }, []);

  return useMemo(() => {
    if (router.isReady) {
      return { params: router.query, isReady: true };
    }
    if (!pathname) {
      return { params: {}, isReady: false };
    }
    const parsed = paramsFromPathname(router.pathname, pathname);
    // Query-string params are still available even before the router is ready.
    const search =
      typeof window === "undefined"
        ? null
        : new URLSearchParams(window.location.search);
    search?.forEach((value, key) => {
      if (!(key in parsed)) parsed[key] = value;
    });
    return { params: parsed, isReady: Object.keys(parsed).length > 0 };
  }, [router.isReady, router.query, router.pathname, pathname]);
};

export default useRouteParams;
