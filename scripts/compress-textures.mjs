#!/usr/bin/env node

/**
 * Compresses texture PNGs/JPGs in public/assets/textures/ to WebP format.
 * Requires sharp (already in devDependencies).
 *
 * Usage: node scripts/compress-textures.mjs
 */

import { readdir, stat, writeFile } from "fs/promises";
import { join, extname } from "path";
import sharp from "sharp";

const TEXTURES_DIR = join(process.cwd(), "public", "assets", "textures");
const MAX_SIZE_KB = 500;
const QUALITY = 80;

async function compressTextures() {
  let files;
  try {
    files = await readdir(TEXTURES_DIR);
  } catch {
    console.log("No textures directory found, skipping.");
    return;
  }

  const imageFiles = files.filter((f) =>
    [".png", ".jpg", ".jpeg"].includes(extname(f).toLowerCase())
  );

  if (imageFiles.length === 0) {
    console.log("No image files found to compress.");
    return;
  }

  console.log(`Found ${imageFiles.length} texture files to compress.`);

  let totalSaved = 0;

  for (const file of imageFiles) {
    const filePath = join(TEXTURES_DIR, file);
    const fileStat = await stat(filePath);
    const originalSizeKB = Math.round(fileStat.size / 1024);

    if (originalSizeKB < 50) {
      console.log(`  Skipping ${file} (${originalSizeKB}KB) - already small`);
      continue;
    }

    try {
      const webpPath = filePath.replace(/\.(png|jpg|jpeg)$/i, ".webp");
      const buffer = await sharp(filePath)
        .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: QUALITY })
        .toBuffer();

      const newSizeKB = Math.round(buffer.length / 1024);
      const saved = originalSizeKB - newSizeKB;

      if (saved > 10) {
        await writeFile(webpPath, buffer);
        totalSaved += saved;
        console.log(
          `  Compressed ${file}: ${originalSizeKB}KB -> ${newSizeKB}KB (saved ${saved}KB)`
        );
      } else {
        console.log(
          `  Skipping ${file} - WebP would only save ${saved}KB`
        );
      }
    } catch (err) {
      console.error(`  Failed to compress ${file}:`, err.message);
    }
  }

  console.log(
    `\nDone! Total saved: ~${Math.round(totalSaved / 1024)}MB`
  );
}

compressTextures();
