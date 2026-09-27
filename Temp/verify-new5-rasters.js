const path = require("path");
const fs = require("fs");
const sharp = require("sharp");

const targets = [
  "8 seater Crescent Table.webp",
  "10 seater Crescent Table.webp",
  "20 seater Oval Table.webp",
  "20 seater Intertwined Crescent Table.webp",
  "40 seater Figure 8 Donut Table.webp",
  "4000mm X 1470mm Oval Table.webp",
  "2150mm X 2150mm Crescent Table.webp",
  "L Shaped Sofa 01.webp",
];

(async () => {
  for (const name of targets) {
    const p = path.join("public/assets/raster/assets/modal/Furniture", name);
    if (!fs.existsSync(p)) {
      console.log("MISSING", name);
      continue;
    }
    const { data, info } = await sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let op = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) op++;
    const pct = ((op / (info.width * info.height)) * 100).toFixed(1);
    console.log(`${name}: ${info.width}x${info.height} opaque=${pct}% bytes=${fs.statSync(p).size}`);
  }

  // 64px preview of one new asset
  const sample = path.join("public/assets/raster/assets/modal/Furniture", "10 seater Crescent Table.webp");
  const small = await sharp(sample)
    .resize(64, 64, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const chars = " .:-=+*#%@";
  console.log("\n10 seater Crescent 64px:");
  for (let y = 0; y < 64; y++) {
    let row = "";
    for (let x = 0; x < 64; x++) {
      const a = small.data[(y * 64 + x) * 4 + 3];
      row += a < 32 ? " " : chars[Math.min(9, Math.floor(a / 26))];
    }
    console.log(row);
  }
})();
