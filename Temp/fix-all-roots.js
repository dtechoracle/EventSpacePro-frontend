const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..", "public", "assets", "modal", "Furniture");

// Known physical sizes that must exist on root (library dims / prior fixes)
const restore = {
  "2150mm X 2150mm Crescent Table.svg": { w: 2150, h: 2150, vb: "110.82 248.83 81.41 81.78" },
  "4300mm X 2150mm Crescent Table.svg": { w: 4300, h: 2150, vb: "245.6 238.8 196.4 98.2" },
  "4000mm X 1470mm Oval Table.svg": { w: 4000, h: 1470, vb: "0 0 4000 1470" },
  "8 seater Crescent Table.svg": { w: 3600, h: 1823, vb: "261.75 264.68 221.63 112.26" },
  "10 seater Crescent Table.svg": { w: 4000, h: 2135, vb: "318.81 277.09 129.16 68.94" },
  "20 seater Oval Table.svg": { w: 5000, h: 2670, vb: "281.86 240.21 195.04 104.15" },
  "20 seater Intertwined Crescent Table.svg": { w: 4200, h: 3294, vb: "267.67 250.38 116.05 91.01" },
  "40 seater Figure 8 Donut Table.svg": { w: 7500, h: 4003, vb: "165.12 260.28 227.38 121.37" },
};

// Also: scan every SVG, if root has viewBox but no width/height, derive from
// library entry when known, else from viewBox w/h (unitless numbers).
const lib = fs.readFileSync(path.join(__dirname, "..", "lib", "assets.tsx"), "utf8");
const libByPath = new Map();
for (const m of lib.matchAll(/"path":\s*"([^"]+)"[\s\S]*?"width":\s*(\d+)[\s\S]*?"height":\s*(\d+)/g)) {
  libByPath.set(m[1], { w: Number(m[2]), h: Number(m[3]) });
}

function ensureRoot(svg, w, h, vb) {
  return svg.replace(/<svg\b[^>]*>/i, () => {
    let attrs = ' xmlns="http://www.w3.org/2000/svg"';
    if (w != null) attrs += ` width="${w}mm"`;
    if (h != null) attrs += ` height="${h}mm"`;
    if (vb != null) attrs += ` viewBox="${vb}"`;
    attrs += ' version="1.1"';
    return `<svg${attrs}>`;
  });
}

let fixedCount = 0;
const all = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".svg"));

for (const name of all) {
  const p = path.join(dir, name);
  let svg = fs.readFileSync(p, "utf8");
  const root = svg.match(/<svg\b[^>]*>/i)?.[0] || "";
  const hasW = /\bwidth=/i.test(root);
  const hasH = /\bheight=/i.test(root);
  const hasVB = /\bviewBox=/i.test(root);

  if (hasW && hasH) continue;

  let w, h, vb;
  if (restore[name]) {
    ({ w, h, vb } = restore[name]);
  } else {
    // keep existing viewBox if present
    vb = root.match(/\bviewBox=["']([^"']+)["']/i)?.[1] || null;
    const libEntry = libByPath.get(`/assets/modal/Furniture/${name}`);
    if (libEntry) {
      w = libEntry.w;
      h = libEntry.h;
    } else if (vb) {
      const parts = vb.trim().split(/[\s,]+/).map(Number);
      if (parts.length === 4 && parts.every(Number.isFinite)) {
        // use viewBox size as unitless fallback (at least keeps aspect)
        w = Math.round(parts[2]);
        h = Math.round(parts[3]);
      }
    }
    if (w == null || h == null) continue;
  }

  // preserve xmlns/other attrs, inject width/height/viewBox
  const vbFinal = vb || root.match(/\bviewBox=["']([^"']+)["']/i)?.[1];
  svg = svg.replace(/<svg\b[^>]*>/i, () => {
    let attrs = ' xmlns="http://www.w3.org/2000/svg"';
    attrs += ` width="${w}mm" height="${h}mm"`;
    if (vbFinal) attrs += ` viewBox="${vbFinal}"`;
    attrs += ' version="1.1"';
    return `<svg${attrs}>`;
  });
  fs.writeFileSync(p, svg, "utf8");
  fixedCount++;
  console.log(`fixed ${name} → ${w}x${h} vb=${vbFinal}`);
}
console.log(`\n${fixedCount} files updated`);

// Verify criticals
console.log("\n=== verify critical ===");
const criticals = [
  "2150mm X 2150mm Crescent Table.svg",
  "4300mm X 2150mm Crescent Table.svg",
  "4000mm X 1470mm Oval Table.svg",
  "8 seater Crescent Table.svg",
  "10 seater Crescent Table.svg",
  "20 seater Oval Table.svg",
  "20 seater Intertwined Crescent Table.svg",
  "40 seater Figure 8 Donut Table.svg",
  "L Shaped Sofa 01.svg",
  "L Shaped Sofa 02.svg",
];
for (const name of criticals) {
  const p = path.join(dir, name);
  if (!fs.existsSync(p)) continue;
  const root = fs.readFileSync(p, "utf8").match(/<svg\b[^>]*>/i)[0];
  const ok = /\bwidth=/i.test(root) && /\bheight=/i.test(root) && /\bviewBox=/i.test(root);
  console.log((ok ? "OK  " : "BAD ") + name);
  console.log("     " + root.slice(0, 180));
}
