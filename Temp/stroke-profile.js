const fs = require('fs');
const sharp = require('sharp');

async function strokeProfile(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  // Measure horizontal run lengths of opaque pixels along several scanlines
  const runs = [];
  for (let y = Math.floor(height * 0.3); y < Math.floor(height * 0.7); y += Math.max(1, Math.floor(height / 20))) {
    let run = 0;
    for (let x = 0; x < width; x++) {
      const a = data[(y * width + x) * channels + 3];
      if (a > 128) run++;
      else {
        if (run > 0) runs.push(run);
        run = 0;
      }
    }
    if (run > 0) runs.push(run);
  }
  runs.sort((a, b) => a - b);
  const mid = runs[Math.floor(runs.length / 2)] || 0;
  const p10 = runs[Math.floor(runs.length * 0.1)] || 0;
  const p90 = runs[Math.floor(runs.length * 0.9)] || 0;
  console.log(file, { w: width, h: height, runs: runs.length, p10, median: mid, p90, max: runs[runs.length - 1] || 0 });
}

(async () => {
  for (const f of process.argv.slice(2)) await strokeProfile(f);
})();
