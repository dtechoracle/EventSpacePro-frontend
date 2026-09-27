const fs = require('fs');
const files = [
  'C:/Users/Jeremiah/EventSpacePro-frontend/public/assets/modal/Layout/24ft by 12ft Stage.svg',
  'C:/Users/Jeremiah/EventSpacePro-frontend/public/assets/modal/Layout/36ft by 12ft Stage.svg',
  'C:/Users/Jeremiah/EventSpacePro-frontend/public/assets/modal/Layout/40ft by 12ft Stage.svg',
];
for (const f of files) {
  const text = fs.readFileSync(f, 'utf8');
  const root = text.slice(0, 500);
  const vb = root.match(/viewBox="([^"]+)"/);
  const w = root.match(/\bwidth="([^"]+)"/);
  const h = root.match(/\bheight="([^"]+)"/);
  const nums = [...text.matchAll(/-?\d+(?:\.\d+)?/g)].map(m => parseFloat(m[0]));
  const xs = [], ys = [];
  const pathRe = /d="([^"]+)"/g;
  let pm;
  while ((pm = pathRe.exec(text)) && xs.length < 200000) {
    const coords = pm[1].match(/-?\d+(?:\.\d+)?/g);
    if (coords) {
      for (let i = 0; i + 1 < coords.length; i += 2) {
        xs.push(parseFloat(coords[i]));
        ys.push(parseFloat(coords[i + 1]));
      }
    }
  }
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  console.log(JSON.stringify({
    file: f.split('/').pop(),
    size: fs.statSync(f).size,
    rootWidth: w && w[1],
    rootHeight: h && h[1],
    viewBox: vb && vb[1],
    pathBounds: { minX, maxX, minY, maxY, w: maxX - minX, h: maxY - minY },
    nPaths: (text.match(/<path/g) || []).length,
    nNums: nums.length,
  }));
}
