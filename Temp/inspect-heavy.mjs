import { readFile } from "fs/promises";

const files = [
  "public/assets/modal/Furniture/40 seater Figure 8 Donut Table.svg",
  "public/assets/modal/Furniture/20 seater Intertwined Crescent Table.svg",
  "public/assets/modal/Furniture/20 seater Oval Table.svg",
  "public/assets/modal/Furniture/8 seater Crescent Table.svg",
  "public/assets/modal/Furniture/10 seater Crescent Table.svg",
];

for (const p of files) {
  try {
    const t = await readFile(p, "utf8");
    const pathCount = (t.match(/<path\b/g) || []).length;
    const dLen = [...t.matchAll(/\sd="([^"]*)"/g)].reduce((s, m) => s + m[1].length, 0);
    const svgTag = t.match(/<svg\b[^>]*>/i)?.[0]?.slice(0, 200);
    console.log(JSON.stringify({ p: p.split("/").pop(), bytes: t.length, pathCount, dLen, svgTag }, null, 0));
  } catch (e) {
    console.log(p, e.message);
  }
}
