const sharp = require('sharp');

async function thumb(file, w = 80) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .resize({ width: w, fit: 'inside' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  let opaque = 0;
  for (let i = 3; i < data.length; i += channels) if (data[i] > 200) opaque++;
  const pct = (100 * opaque / (width * height)).toFixed(1);
  // also render ascii at thumbnail
  const cols = Math.min(64, width);
  const rows = Math.max(12, Math.round(cols * height / width / 2));
  const small = await sharp(file).ensureAlpha().resize(cols, rows, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  const chars = ' .:-=+*#%@';
  console.log('\n===', file, `${width}x${height}`, 'opaque%', pct);
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
  for (const f of process.argv.slice(2)) await thumb(f);
})().catch(e => { console.error(e); process.exit(1); });
