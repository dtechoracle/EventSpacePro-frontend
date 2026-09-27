const fs = require('fs');
const path = require('path');

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.toLowerCase().endsWith('.svg')) out.push(p);
  }
  return out;
}

const mismatches = [];
for (const dir of ['public/assets/modal', 'public/Marquees']) {
  for (const file of walk(dir)) {
    const t = fs.readFileSync(file, 'utf8');
    const tag = t.match(/<svg\b[^>]*>/i)?.[0] || '';
    const w = tag.match(/\bwidth=["']([\d.]+)/i)?.[1];
    const h = tag.match(/\bheight=["']([\d.]+)/i)?.[1];
    const vb = tag.match(/\bviewBox=["']([^"']+)["']/i)?.[1];
    if (!w || !h || !vb) continue;
    const parts = vb.trim().split(/[\s,]+/).map(Number);
    if (parts.length !== 4 || parts.some(x => !Number.isFinite(x))) continue;
    const vw = Math.abs(parts[2]);
    const vh = Math.abs(parts[3]);
    const wr = Number(w) / vw;
    const hr = Number(h) / vh;
    // flag when width/height and viewBox disagree by >20%
    if (Math.abs(wr - 1) > 0.2 || Math.abs(hr - 1) > 0.2) {
      mismatches.push({
        file: path.relative('public', file),
        width: Number(w),
        height: Number(h),
        vbW: vw,
        vbH: vh,
        ratio: +wr.toFixed(2),
      });
    }
  }
}
mismatches.sort((a, b) => b.ratio - a.ratio);
console.log('mismatches:', mismatches.length);
for (const m of mismatches) console.log(m);
