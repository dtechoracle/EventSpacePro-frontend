const sharp = require('sharp');

async function ascii(file, rows = 24, cols = 64) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .resize(cols, rows, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  console.log('\n===', file, `${info.width}x${info.height}`);
  const chars = ' .:-=+*#%@';
  for (let y = 0; y < height; y++) {
    let line = '';
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const a = data[i + 3];
      line += chars[Math.min(9, Math.floor((a / 256) * 10))];
    }
    console.log(line);
  }
}

(async () => {
  for (const f of process.argv.slice(2)) await ascii(f);
})();
