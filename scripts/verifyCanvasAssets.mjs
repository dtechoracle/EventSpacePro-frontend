/**
 * Verification for lib/canvasAssets.ts.
 *
 * `Event.canvasAssets` comes back in two shapes: the keyed collection object
 * the backend collaboration flush writes, and the flat asset array the older
 * REST save wrote. Every consumer here was written against the array — the
 * editor's fallback is guarded by `Array.isArray`, the dashboard card props are
 * typed `AssetInstance[]` — so a collaboratively-edited event opened blank and
 * rendered garbage thumbnails. lib/canvasAssets.ts is the single place that
 * understands both, which makes it worth checking against a real payload.
 *
 * The object under "the real production payload" was returned verbatim by the
 * deployed backend for an event edited through two live collaboration sessions.
 *
 *   node scripts/verifyCanvasAssets.mjs
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const outDir = mkdtempSync(join(tmpdir(), "canvas-assets-"));
execFileSync(
  "npx",
  ["tsc", "lib/canvasAssets.ts", "--outDir", outDir, "--module", "commonjs",
   "--target", "es2020", "--skipLibCheck"],
  { stdio: "inherit" },
);
const { createRequire } = await import("node:module");
const require = createRequire(pathToFileURL(join(outDir, "x.cjs")));
const h = require(join(outDir, "canvasAssets.js"));

const real = { yShapes: {
  "shape-2": { id: "shape-2", type: "rect", x: 555, y: 100, width: 50, height: 50, fill: "#f00", rotation: 0 },
  "shape-1": { id: "shape-1", type: "rect", x: 10, y: 100, width: 50, height: 50, fill: "#abc", rotation: 0 },
} };
const legacyArray = [{ id: "a1", type: "table", x: 1, y: 2 }];
const full = {
  yShapes: { s1: { id: "s1" } }, yAssets: { a1: { id: "a1" } }, yWalls: { w1: { id: "w1" } },
  yWallSegments: { ws1: { id: "ws1" } }, yAnnotations: { t1: { id: "t1" } },
  yDimensions: { d1: { id: "d1" } }, yArrows: { ar1: { id: "ar1" } }, yGroups: { g1: { id: "g1" } },
  yComments: { c1: { id: "c1" } }, yCanvas: { config: { width: 500, height: 400, unit: "mm" } },
};

let fails = 0, n = 0;
const check = (label, cond, detail) => {
  n++;
  if (cond) console.log("  PASS  " + label);
  else { fails++; console.log("  FAIL  " + label); if (detail !== undefined) console.log("        got: " + JSON.stringify(detail)); }
};

console.log("\n== against a real production payload ==");
check("detected as the collaboration shape", h.isCollaborationCanvasShape(real));
const d = h.canvasDataFromCollaborationAssets(real);
check("both shapes recovered", d.shapes.length === 2, d.shapes.length);
check("values are intact",
  d.shapes.find((s) => s.id === "shape-2")?.x === 555 && d.shapes.find((s) => s.id === "shape-1")?.fill === "#abc", d.shapes);
check("collections mongo omitted read as empty arrays, not undefined",
  [d.assets, d.walls, d.wallSegments, d.textAnnotations, d.dimensions, d.labelArrows, d.groups, d.comments].every(Array.isArray));
check("hasCanvasContent is true", h.hasCanvasContent(d));
check("flattens to an array for the preview cards", h.flattenCanvasAssets(real).length === 2);

console.log("\n== every collection maps to the right store field ==");
const f = h.canvasDataFromCollaborationAssets(full);
check("yShapes -> shapes", f.shapes[0].id === "s1");
check("yAssets -> assets", f.assets[0].id === "a1");
check("yWalls -> walls", f.walls[0].id === "w1");
check("yWallSegments -> wallSegments", f.wallSegments[0].id === "ws1");
check("yAnnotations -> textAnnotations", f.textAnnotations[0].id === "t1");
check("yDimensions -> dimensions", f.dimensions[0].id === "d1");
check("yArrows -> labelArrows", f.labelArrows[0].id === "ar1");
check("yGroups -> groups", f.groups[0].id === "g1");
check("yComments -> comments", f.comments[0].id === "c1");
check("yCanvas.config -> canvas", !!f.canvas && f.canvas.width === 500, f.canvas);
check("flatten covers every drawable collection", h.flattenCanvasAssets(full).length === 7, h.flattenCanvasAssets(full).length);

console.log("\n== the legacy array shape still works ==");
check("a flat array is not mistaken for the collaboration shape", !h.isCollaborationCanvasShape(legacyArray));
check("a flat array passes through flatten unchanged", h.flattenCanvasAssets(legacyArray).length === 1);
check("withPreviewableCanvasAssets leaves an array event alone",
  h.withPreviewableCanvasAssets({ canvasAssets: legacyArray }).canvasAssets === legacyArray);
check("withPreviewableCanvasAssets flattens a collaboration event",
  Array.isArray(h.withPreviewableCanvasAssets({ canvasAssets: real }).canvasAssets));

console.log("\n== junk in, no crash out ==");
check("null", h.flattenCanvasAssets(null).length === 0 && !h.isCollaborationCanvasShape(null));
check("undefined", h.flattenCanvasAssets(undefined).length === 0);
check("empty object", h.flattenCanvasAssets({}).length === 0 && !h.isCollaborationCanvasShape({}));
check("string", h.flattenCanvasAssets("nope").length === 0);
check("nulls inside a collection are dropped",
  h.canvasDataFromCollaborationAssets({ yShapes: { a: null, b: { id: "b" } } }).shapes.length === 1);

rmSync(outDir, { recursive: true, force: true });
console.log("\n" + (n - fails) + "/" + n + " checks passed");
process.exit(fails === 0 ? 0 : 1);
