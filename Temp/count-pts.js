const fs = require("fs");
const files = [
  "8 seater Crescent Table.svg",
  "10 seater Crescent Table.svg",
  "20 seater Oval Table.svg",
  "20 seater Intertwined Crescent Table.svg",
  "40 seater Figure 8 Donut Table.svg",
  "2150mm X 2150mm Crescent Table.svg",
  "4300mm X 2150mm Crescent Table.svg",
];
for (const f of files) {
  const s = fs.readFileSync("public/assets/modal/Furniture/" + f, "utf8");
  const paths = [...s.matchAll(/ d="([^"]+)"/g)];
  let totalPts = 0, maxPts = 0;
  for (const m of paths) {
    const nums = (m[1].match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || []).length;
    const pts = Math.floor(nums / 2);
    totalPts += pts;
    if (pts > maxPts) maxPts = pts;
  }
  console.log(
    f + ": paths=" + paths.length + " totalPts=" + totalPts + " maxPathPts=" + maxPts + " bytes=" + s.length
  );
}
