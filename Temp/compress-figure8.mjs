import { readFile, writeFile } from "fs/promises";
import { optimize } from "svgo";

const p = "public/assets/modal/Furniture/40 seater Figure 8 Donut Table.svg";
const before = await readFile(p, "utf8");
const root = before.match(/<svg\b[^>]*>/i)?.[0] || "";
const keepW = root.match(/\bwidth=(["'])([^"']+)\1/i)?.[0];
const keepH = root.match(/\bheight=(["'])([^"']+)\1/i)?.[0];

const result = optimize(before, {
  path: p,
  plugins: [
    {
      name: "preset-default",
      params: {
        overrides: {
          cleanupIds: false,
          mergePaths: true,
          convertPathData: { floatPrecision: 3, transformPrecision: 3 },
          removeUnknownsAndDefaults: false,
          removeUselessStrokeAndFill: false,
          inlineStyles: false,
        },
      },
    },
    { name: "removeViewBox", active: false },
    { name: "removeDimensions", active: false },
  ],
});

if (result.error) throw new Error(result.error);
let after = result.data;
if ((keepW || keepH) && /<svg\b[^>]*>/i.test(after)) {
  after = after.replace(/<svg\b([^>]*?)>/i, (_m, attrs) => {
    let next = attrs;
    if (keepW && !/\bwidth=/i.test(next)) next = ` ${keepW}${next}`;
    if (keepH && !/\bheight=/i.test(next)) next = ` ${keepH}${next}`;
    return `<svg${next}>`;
  });
}

if (after.length < before.length) {
  await writeFile(p, after, "utf8");
  console.log(`${before.length} -> ${after.length}`);
} else {
  console.log(`no gain ${before.length}`);
}
