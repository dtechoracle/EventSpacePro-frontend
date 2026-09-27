const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..", "public", "assets", "modal", "Furniture");
const files = [
  "10 seater Crescent Table.svg",
  "8 seater Crescent Table.svg",
  "20 seater Oval Table.svg",
  "20 seater Intertwined Crescent Table.svg",
  "40 seater Figure 8 Donut Table.svg",
];

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

for (const name of files) {
  const p = path.join(dir, name);
  if (!fs.existsSync(p)) { console.log("MISSING", name); continue; }
  const svg = fs.readFileSync(p, "utf8");
  const root = svg.match(/<svg[^>]*>/i)?.[0] || "NO ROOT";
  const wM = root.match(/\bwidth=["']([^"']+)["']/i)?.[1];
  const hM = root.match(/\bheight=["']([^"']+)["']/i)?.[1];
  const vb = root.match(/\bviewBox=["']([^"']+)["']/i)?.[1];
  const dMatches = [...svg.matchAll(/\sd="([^"]+)"/g)];
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for (const m of dMatches) {
    for (const [x,y] of pathPoints(m[1])) {
      if(x<minX)minX=x; if(y<minY)minY=y; if(x>maxX)maxX=x; if(y>maxY)maxY=y;
    }
  }
  const cw = maxX-minX, ch = maxY-minY;
  console.log("====", name, "====");
  console.log("  root w/h:", wM, "x", hM, " viewBox:", vb);
  console.log("  bytes:", svg.length, " paths:", dMatches.length);
  if (isFinite(cw) && cw > 0) {
    console.log(`  content bbox: ${minX.toFixed(2)},${minY.toFixed(2)} → ${maxX.toFixed(2)},${maxY.toFixed(2)}`);
    console.log(`  content size: ${cw.toFixed(2)} x ${ch.toFixed(2)}  aspect ${(cw/ch).toFixed(4)}`);
  } else {
    console.log("  content: empty or no path coords");
  }
  const fr = (svg.match(/fill-rule=/gi)||[]).length;
  console.log("  fill-rule count:", fr);
}
