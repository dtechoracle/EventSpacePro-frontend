// Count path commands and sample first path length for visual QA
const fs = require("fs");
const path = require("path");
const dir = path.join(__dirname, "..", "public", "assets", "modal", "Furniture");
const files = [
  "8 seater Crescent Table.svg",
  "10 seater Crescent Table.svg",
  "20 seater Oval Table.svg",
  "20 seater Intertwined Crescent Table.svg",
  "40 seater Figure 8 Donut Table.svg",
];
for (const f of files) {
  const p = path.join(dir, f);
  if (!fs.existsSync(p)) { console.log(f, "MISSING"); continue; }
  const svg = fs.readFileSync(p, "utf8");
  const paths = svg.match(/ d="[^"]+"/g) || [];
  let pts = 0;
  for (const m of svg.matchAll(/ d="([^"]+)"/g)) {
    pts += (m[1].match(/[ML]/gi) || []).length;
  }
  console.log(`${f}: paths=${paths.length} ml=${pts} bytes=${svg.length} root=${(svg.match(/<svg[^>]+>/)||[""])[0].slice(0,120)}`);
}
