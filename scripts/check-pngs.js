const fs = require('fs');
const dir = 'public/assets/thumbnails/preloaded-venues';
const files = fs.readdirSync(dir);
files.forEach(f => {
  const s = fs.statSync(dir + '/' + f);
  console.log(f + ': ' + (s.size/1024).toFixed(1) + 'KB');
});
