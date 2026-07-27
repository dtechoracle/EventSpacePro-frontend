const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../public/assets/preloaded-venues/Eko hotel Convention Centre (Main Hall).svg');
console.log('Reading file: ', filePath);
let content = fs.readFileSync(filePath, 'utf8');

// Use JavaScript's standard multiline match with 's' flag: /pattern/s
content = content.replace(/<g id="patch_1">.*?style="fill: #ffffff"\/>/s, '<g id="patch_1"><path d="" style="fill: none"/></g>');
content = content.replace(/<g id="patch_2">.*?style="fill: #212830"\/>/s, '<g id="patch_2"><path d="" style="fill: none"/></g>');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done cleaning Eko Main Hall SVG!');
