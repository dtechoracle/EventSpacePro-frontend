const fs = require("fs");
const files = [
  "8 seater Crescent Table.svg",
  "10 seater Crescent Table.svg",
  "20 seater Oval Table.svg",
  "20 seater Intertwined Crescent Table.svg",
  "40 seater Figure 8 Donut Table.svg",
];
for (const f of files) {
  const s = fs.readFileSync("public/assets/modal/Furniture/" + f, "utf8");
  const cmds = new Set();
  for (const m of s.matchAll(/ d="([^"]+)"/g)) {
    for (const c of m[1].match(/[A-Za-z]/g) || []) cmds.add(c);
  }
  console.log(f + ": cmds=" + [...cmds].join(","));
}
