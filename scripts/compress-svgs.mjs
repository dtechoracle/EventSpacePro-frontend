#!/usr/bin/env node

/**
 * Compresses asset SVGs in-place with svgo for faster serving/loading.
 * Incremental: skips files already compressed (tracked by content hash in
 * scripts/svg-compress-manifest.json). Only new or modified files run.
 *
 * Conservative config: preserves viewBox, fill-rule, stroke attrs, and path
 * precision needed by generate-asset-webp.js and InlineSvg.
 *
 * Usage:
 *   node scripts/compress-svgs.mjs              # incremental (new/changed only)
 *   node scripts/compress-svgs.mjs --mark-existing  # seed manifest, no optimize
 *   node scripts/compress-svgs.mjs --all        # force recompress everything
 *   node scripts/compress-svgs.mjs [dir...]     # limit to specific dirs
 */

import { readdir, readFile, writeFile } from "fs/promises";
import { join, relative, extname } from "path";
import { createHash } from "crypto";
import { optimize } from "svgo";

const ROOT = process.cwd();
const MANIFEST_PATH = join(ROOT, "scripts", "svg-compress-manifest.json");
const DEFAULT_DIRS = [
  join(ROOT, "public", "assets", "modal"),
  join(ROOT, "public", "Marquees"),
];

const SVGO_CONFIG = {
  // multipass is slow on CAD exports with tens of thousands of paths
  multipass: false,
  js2svg: {
    pretty: false,
  },
  plugins: [
    {
      name: "preset-default",
      params: {
        overrides: {
          cleanupIds: false,
          // Merge same-attr stroke segments (CAD line soup → one path).
          // Safe here: assets share fill/stroke; fill-rule holes stay valid
          // as subpaths within a single path element.
          mergePaths: true,
          convertPathData: {
            floatPrecision: 3,
            transformPrecision: 3,
          },
          removeUnknownsAndDefaults: false,
          removeUselessStrokeAndFill: false,
          inlineStyles: false,
        },
      },
    },
    // Belt-and-suspenders: never drop viewBox or physical width/height.
    // (removeDimensions is not in preset-default, but keep explicit offs.)
    { name: "removeViewBox", active: false },
    { name: "removeDimensions", active: false },
    { name: "removeTitle", active: false },
    { name: "removeDesc", active: false },
  ],
};

function sha1(buf) {
  return createHash("sha1").update(buf).digest("hex");
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) files.push(...(await walk(full)));
    else if (e.isFile() && extname(e.name).toLowerCase() === ".svg") files.push(full);
  }
  return files;
}

async function loadManifest() {
  try {
    return JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  } catch {
    return {};
  }
}

async function saveManifest(manifest) {
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n", "utf8");
}

async function compressFile(filePath) {
  const before = await readFile(filePath, "utf8");
  // Capture physical size attrs — svgo removeDimensions (or equivalents)
  // can strip width/height whenever viewBox is present. readSvgSize in
  // generate-asset-webp.js needs them (falls back to viewBox user-units,
  // which for CAD content-boxes yields tiny rasters).
  const beforeRoot = before.match(/<svg\b[^>]*>/i)?.[0] || "";
  const keepW = beforeRoot.match(/\bwidth=(["'])([^"']+)\1/i)?.[0];
  const keepH = beforeRoot.match(/\bheight=(["'])([^"']+)\1/i)?.[0];

  const result = optimize(before, { path: filePath, ...SVGO_CONFIG });
  if (result.error) throw new Error(result.error);
  let after = result.data;

  // Restore width/height on root if svgo dropped them.
  if ((keepW || keepH) && /<svg\b[^>]*>/i.test(after)) {
    after = after.replace(/<svg\b([^>]*?)>/i, (match, attrs) => {
      let next = attrs;
      if (keepW && !/\bwidth=/i.test(next)) next = ` ${keepW}${next}`;
      if (keepH && !/\bheight=/i.test(next)) next = ` ${keepH}${next}`;
      return `<svg${next}>`;
    });
  }

  if (after.length < before.length) {
    await writeFile(filePath, after, "utf8");
    return {
      saved: before.length - after.length,
      before: before.length,
      after: after.length,
      finalContent: after,
    };
  }
  return {
    saved: 0,
    before: before.length,
    after: before.length,
    finalContent: before,
    skippedSmaller: true,
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const forceAll = argv.includes("--all");
  const markExisting = argv.includes("--mark-existing");
  const dirArgs = argv.filter((a) => !a.startsWith("--"));
  const dirs = dirArgs.length ? dirArgs.map((d) => join(ROOT, d)) : DEFAULT_DIRS;

  const manifest = await loadManifest();
  const files = [];
  for (const dir of dirs) {
    try {
      files.push(...(await walk(dir)));
    } catch {
      console.log(`Skipping missing dir: ${relative(ROOT, dir)}`);
    }
  }

  // Seed manifest with current hashes without optimizing (for files already
  // known-good from a prior full pass). Run this once, then normal runs only
  // touch new/changed files.
  if (markExisting) {
    let added = 0;
    for (const file of files) {
      const rel = relative(ROOT, file).replace(/\\/g, "/");
      const hash = sha1(await readFile(file));
      if (manifest[rel] !== hash) {
        manifest[rel] = hash;
        added++;
      }
    }
    await saveManifest(manifest);
    console.log(`Marked ${added} existing SVGs in manifest (no optimization).`);
    return;
  }

  let compressed = 0;
  let unchanged = 0;
  let failed = 0;
  let totalBefore = 0;
  let totalAfter = 0;
  let processedSinceFlush = 0;

  for (const file of files) {
    const rel = relative(ROOT, file).replace(/\\/g, "/");
    try {
      const current = await readFile(file, "utf8");
      const hash = sha1(current);

      if (!forceAll && manifest[rel] === hash) {
        unchanged++;
        continue;
      }

      const r = await compressFile(file);
      totalBefore += r.before;
      totalAfter += r.after;

      const finalHash = sha1(r.finalContent);
      manifest[rel] = finalHash;
      processedSinceFlush++;
      // Flush periodically so a long run keeps progress if interrupted.
      if (processedSinceFlush >= 10) {
        await saveManifest(manifest);
        processedSinceFlush = 0;
      }

      if (r.skippedSmaller) {
        unchanged++;
      } else {
        compressed++;
        const pct = ((1 - r.after / r.before) * 100).toFixed(1);
        console.log(`  ${rel}: ${r.before} → ${r.after} B (-${pct}%)`);
      }
    } catch (err) {
      failed++;
      console.error(`  FAILED ${rel}: ${err.message}`);
    }
  }

  if (processedSinceFlush > 0) await saveManifest(manifest);

  const scannedPrefixes = dirs.map((d) => relative(ROOT, d).replace(/\\/g, "/"));
  for (const key of Object.keys(manifest)) {
    const stillExists = files.some((f) => relative(ROOT, f).replace(/\\/g, "/") === key);
    if (!stillExists && scannedPrefixes.some((p) => key.startsWith(p))) {
      delete manifest[key];
    }
  }

  await saveManifest(manifest);

  const saved = totalBefore - totalAfter;
  const pct = totalBefore ? ((saved / totalBefore) * 100).toFixed(1) : "0";
  console.log(
    `\nDone: ${compressed} compressed, ${unchanged} skipped (already done), ${failed} failed.` +
      (totalBefore
        ? ` Processed total ${totalBefore} → ${totalAfter} B (saved ${saved} B, ${pct}%).`
        : " Nothing new to process.")
  );
  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
