const sharp = require('sharp');

// Render at exact UI thumbnail sizes: sidebar h-16 (64px), modal w-16 h-16 (64px)
async function atSize(file, size = 64) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  let opaque = 0;
  let maxRun = 0;
  for (let y = 0; y < height; y++) {
    let run = 0;
    for (let x = 0; x < width; x++) {
      const a = data[(y * width + x) * channels + 3];
      if (a > 200) {
        opaque++;
        run++;
        if (run > maxRun) maxRun = run;
      } else run = 0;
    }
  }
  const pct = (100 * opaque / (width * height)).toFixed(1);
  const chars = ' .:-=+*#%@';
  console.log('\n===', file.split('/').pop(), `${size}x${size}`, `opaque%=${pct}`, `maxHRun=${maxRun}`);
  // downsample ascii for readability
  const cols = 64, rows = 28;
  const small = await sharp(file).ensureAlpha()
    .resize(cols, rows, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .raw().toBuffer({ resolveWithObject: true });
  for (let y = 0; y < small.info.height; y++) {
    let line = '';
    for (let x = 0; x < small.info.width; x++) {
      const i = (y * small.info.width + x) * small.info.channels;
      line += chars[Math.min(9, Math.floor((small.data[i + 3] / 256) * 10))];
    }
    console.log(line);
  }
}

(async () => {
  for (const f of process.argv.slice(2)) await atSize(f, 64);
})().catch(e => { console.error(e); process.exit(1); });
