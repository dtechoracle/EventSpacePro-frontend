const { execSync } = require('child_process');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(process.cwd());
const ORIG = 'public/assets/raster/assets/modal/Furniture/10 seater round table 01.webp';
const origPath = path.join(process.cwd(), 'public/assets/raster/assets/modal/Furniture/10 seater round table 01.webp');

async function analyze(label, file) {
  const meta = await sharp(file).metadata();
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  let dark = 0, opaque = 0, total = 0;
  for (let i = 0; i < data.length; i += ch) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const a = ch === 4 ? data[i + 3] : 255;
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (a > 10) { opaque++; if (lum < 128) dark++; }
    total++;
  }
  console.log(`${label}: ${meta.width}x${meta.height} opaque=${((opaque/total)*100).toFixed(2)}% darkOfOpaque=${((dark/Math.max(1,opaque))*100).toFixed(2)}%`);
}

(async () => {
  await analyze('CURRENT(regenerated)', origPath);

  // extract original blob from git to a temp file
  const env = { ...process.env, GIT_DIR: path.join(ROOT, '.git'), GIT_WORK_TREE: ROOT };
  const outPath = path.join(ROOT, 'scripts', 'orig_10seater.webp');
  const script = `const { execSync } = require('child_process'); execSync('git cat-file blob "${ORIG}" > "${outPath.replace(/\\\\/g,'/')}"', { shell: 'cmd' });`;
  execSync(`node -e "${script.replace(/"/g,'\\"')}"`, { env, cwd: ROOT });

  if (fs.existsSync(outPath) && fs.statSync(outPath).size > 1000) {
    await analyze('ORIGINAL(committed)', outPath);
    fs.unlinkSync(outPath);
  } else {
    console.log('orig extraction failed, size =', fs.existsSync(outPath) ? fs.statSync(outPath).size : 'n/a');
  }
})();
