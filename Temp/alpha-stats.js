const sharp = require('sharp');
const fs = require('fs');

async function coverage(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  let opaque = 0;
  let partial = 0;
  let total = width * height;
  // histogram of alpha
  const buckets = new Array(16).fill(0);
  for (let i = 0; i < data.length; i += channels) {
    const a = data[i + 3];
    buckets[Math.min(15, Math.floor(a / 16))]++;
    if (a > 250) opaque++;
    else if (a > 10) partial++;
  }
  console.log('\n===', file);
  console.log({ width, height, opaquePct: (100 * opaque / total).toFixed(1), partialPct: (100 * partial / total).toFixed(1) });
  console.log('alpha buckets (0=transparent..15=opaque):', buckets.map((n, i) => `${i}:${((100 * n) / total).toFixed(1)}%`).join(' '));
}

(async () => {
  const files = process.argv.slice(2);
  for (const f of files) await coverage(f);
})();
