/**
 * Verification for hooks/useRouteParams.ts.
 *
 * Every page here is auto-statically-optimized, and on this deployment the
 * client router never reconciles a dynamic route on a cold load:
 * `router.isReady` stays false and `router.query` stays empty forever, so the
 * editor's event fetch never fired and a refresh or a shared link rendered
 * "No event data found". `paramsFromPathname` is the fallback that reads the
 * params straight off `window.location.pathname`, so it needs to agree with
 * Next's own matching for the routes this app actually has.
 *
 *   node scripts/verifyRouteParams.mjs
 */

import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// Built inside the project, not /tmp: the compiled module still requires
// `next/router` and `react`, which only resolve from within the repo.
const outDir = join(process.cwd(), ".verify-route-params");
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
execFileSync(
  "npx",
  ["tsc", "hooks/useRouteParams.ts", "--outDir", outDir, "--module", "commonjs",
   "--target", "es2020", "--skipLibCheck", "--jsx", "react-jsx"],
  { stdio: "inherit" },
);
const require = createRequire(pathToFileURL(join(outDir, "x.cjs")));
const { paramsFromPathname } = require(join(outDir, "useRouteParams.js"));

let fails = 0, n = 0;
const eq = (label, actual, expected) => {
  n++;
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) console.log("  PASS  " + label);
  else { fails++; console.log("  FAIL  " + label); console.log("        expected: " + JSON.stringify(expected)); console.log("        got:      " + JSON.stringify(actual)); }
};

console.log("\n== the routes this app has ==");
eq("editor: slug + id",
  paramsFromPathname("/dashboard/editor/[slug]/[id]", "/dashboard/editor/personal-drafts-6/6a97d50e3e29ec81340925ba"),
  { slug: "personal-drafts-6", id: "6a97d50e3e29ec81340925ba" });
eq("project events: slug only, trailing static segment ignored",
  paramsFromPathname("/dashboard/projects/[slug]/events", "/dashboard/projects/collab-repro-mtjtr8sz/events"),
  { slug: "collab-repro-mtjtr8sz" });

console.log("\n== shapes it must not get wrong ==");
eq("a static route yields nothing", paramsFromPathname("/dashboard", "/dashboard"), {});
eq("percent-encoding is decoded",
  paramsFromPathname("/dashboard/projects/[slug]/events", "/dashboard/projects/my%20project/events"),
  { slug: "my project" });
eq("a truncated path yields only what is present",
  paramsFromPathname("/dashboard/editor/[slug]/[id]", "/dashboard/editor/only-slug"),
  { slug: "only-slug" });
eq("a trailing slash does not create an empty param",
  paramsFromPathname("/dashboard/projects/[slug]/events", "/dashboard/projects/abc/events/"),
  { slug: "abc" });
eq("catch-all collects the rest",
  paramsFromPathname("/docs/[...parts]", "/docs/a/b/c"),
  { parts: ["a", "b", "c"] });
eq("optional catch-all with nothing to collect stays empty",
  paramsFromPathname("/docs/[[...parts]]", "/docs"),
  {});

rmSync(outDir, { recursive: true, force: true });
console.log("\n" + (n - fails) + "/" + n + " checks passed");
process.exit(fails === 0 ? 0 : 1);
