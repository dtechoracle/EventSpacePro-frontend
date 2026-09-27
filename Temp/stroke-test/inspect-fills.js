const fs = require('fs');
const dir = 'public/assets/preloaded-venues';
for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.svg'))) {
  const s = fs.readFileSync(dir + '/' + f, 'utf8');
  const rects = (s.match(/<rect/g) || []).length;
  const zPaths = (s.match(/z/gi) || []).length;
  const fillNone = (s.match(/fill="none"/g) || []).length;
  const fillOther = (s.match(/fill="(?!none)[^"]+"/g) || []).length;
  console.log(f, '| rect:', rects, '| z:', zPaths, '| fill=none:', fillNone, '| fill=other:', fillOther);
}
