const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const p = path.join(__dirname, "..", "public", "assets", "raster", "assets", "modal", "Furniture", "4000mm X 1470mm Oval Table.webp");
sharp(p).metadata().then(async (m) => {
  console.log("metadata:", m.width, "x", m.height, "channels", m.channels);
  const { data, info } = await sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const total = info.width * info.height;
  let opaque = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] > 0) opaque++;
  console.log(`opaque: ${(opaque / total * 100).toFixed(1)}%  size: ${fs.statSync(p).size} bytes`);

  // 64px preview
  const small = await sharp(p).resize(64, 64, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const chars = " .:-=+*#%@";
  let sOp = 0;
  for (let y = 0; y < 64; y++) {
    let row = "";
    for (let x = 0; x < 64; x++) {
      const a = small.data[(y * 64 + x) * 4 + 3];
      if (a > 128) sOp++;
      row += a < 32 ? " " : chars[Math.min(9, Math.floor(a / 26))];
    }
    console.log(row);
  }
  console.log(`64px opaque: ${(sOp / (64 * 64) * 100).toFixed(1)}%`);
});
