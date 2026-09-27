const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..", "public", "assets", "modal", "Furniture");

// Recompute content bbox and set correct root for each of the 5 files
const planW = {
  "8 seater Crescent Table.svg": 3600,
  "10 seater Crescent Table.svg": 4000,
  "20 seater Oval Table.svg": 5000,
  "20 seater Intertwined Crescent Table.svg": 4200,
  "40 seater Figure 8 Donut Table.svg": 7500,
  // restore oval too (svgo stripped dims earlier)
  "4000mm X 1470mm Oval Table.svg": null, // special: already known 4000x1470, viewBox 0 0 4000 1470
};

function pathPoints(d) {
  const tokens = d.match(/[MLHVCQTAZmlhvcqtaz]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || [];
  let i = 0, cmd = null, cx = 0, cy = 0;
  const pts = [];
  while (i < tokens.length) {
    const t = tokens[i];
    if (/[MLHVCQTAZmlhvcqtaz]/.test(t)) { cmd = t; i++; continue; }
    const n = parseFloat(t);
    if (cmd === "M" || cmd === "L" || cmd === "m" || cmd === "l") {
      let x = n, y = parseFloat(tokens[i + 1]); i += 2;
      if (cmd === "m" || cmd === "l") { x += cx; y += cy; }
      cx = x; cy = y; pts.push([x, y]);
    } else if (cmd === "H" || cmd === "h") {
      let x = n; if (cmd === "h") x += cx;
      cx = x; pts.push([x, cy]); i++;
    } else if (cmd === "V" || cmd === "v") {
      let y = n; if (cmd === "v") y += cy;
      cy = y; pts.push([cx, y]); i++;
    } else if (cmd === "C" || cmd === "c") {
      const n2 = tokens.slice(i, i + 6).map(Number);
      if (cmd === "c") { n2[0]+=cx;n2[1]+=cy;n2[2]+=cx;n2[3]+=cy;n2[4]+=cx;n2[5]+=cy; }
      pts.push([n2[0],n2[1]],[n2[2],n2[3]],[n2[4],n2[5]]);
      cx=n2[4]; cy=n2[5]; i+=6;
    } else if (cmd === "S" || cmd === "s" || cmd === "Q" || cmd === "q") {
      const n2 = tokens.slice(i, i + 4).map(Number);
      if (cmd === "s" || cmd === "q") { n2[0]+=cx;n2[1]+=cy;n2[2]+=cx;n2[3]+=cy; }
      pts.push([n2[0],n2[1]],[n2[2],n2[3]]);
      cx=n2[2]; cy=n2[3]; i+=4;
    } else if (cmd === "A" || cmd === "a") {
      const n2 = tokens.slice(i, i + 7).map(Number);
      let ex=n2[5], ey=n2[6];
      if (cmd === "a") { ex+=cx; ey+=cy; }
      pts.push([ex,ey]); cx=ex; cy=ey; i+=7;
    } else i++;
  }
  return pts;
}

function contentBBox(svg) {
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for (const m of svg.matchAll(/\sd="([^"]+)"/g)) {
    for (const [x,y] of pathPoints(m[1])) {
      if(x<minX)minX=x; if(y<minY)minY=y; if(x>maxX)maxX=x; if(y>maxY)maxY=y;
    }
  }
  return { minX, minY, w: maxX-minX, h: maxY-minY };
}

const dims = {};
for (const [name, targetW] of Object.entries(planW)) {
  const p = path.join(dir, name);
  if (!fs.existsSync(p)) { console.log("missing", name); continue; }
  let svg = fs.readFileSync(p, "utf8");

  let W, H, vb;
  if (name === "4000mm X 1470mm Oval Table.svg") {
    W = 4000; H = 1470; vb = "0 0 4000 1470";
  } else {
    const bb = contentBBox(svg);
    const aspect = bb.w / bb.h;
    W = targetW;
    H = Math.round(W / aspect);
    vb = `${bb.minX.toFixed(2)} ${bb.minY.toFixed(2)} ${bb.w.toFixed(2)} ${bb.h.toFixed(2)}`;
  }

  const fixed = svg.replace(
    /<svg\b[^>]*>/i,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="${vb}" version="1.1">`
  );
  fs.writeFileSync(p, fixed, "utf8");
  dims[name] = { width: W, height: H };
  const root = fixed.match(/<svg[^>]*>/i)[0];
  console.log(name, "=>", root);
}

// Also scan ALL furniture svgs and report any missing width/height on root
console.log("\n=== scan for missing dims ===");
const all = fs.readdirSync(dir).filter(f => f.endsWith(".svg"));
const missing = [];
for (const f of all) {
  const s = fs.readFileSync(path.join(dir, f), "utf8");
  const root = s.match(/<svg[^>]*>/i)?.[0] || "";
  if (!/\bwidth=/i.test(root) || !/\bheight=/i.test(root)) missing.push(f);
}
console.log(missing.length ? missing.join("\n") : "none missing");

fs.writeFileSync(path.join(__dirname, "restore-dims.json"), JSON.stringify(dims, null, 2));
