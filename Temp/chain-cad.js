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

const TOL = 0.05;
const PREC = 2;

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

function near(a, b) {
  return Math.hypot(a[0]-b[0], a[1]-b[1]) < TOL;
}

function fmt(n) {
  const s = n.toFixed(PREC);
  return s.replace(/\.?0+$/, "") || "0";
}

function toPathD(pts, closed) {
  if (pts.length < 2) return "";
  let d = `M${fmt(pts[0][0])} ${fmt(pts[0][1])}`;
  for (let i = 1; i < pts.length; i++) {
    d += `L${fmt(pts[i][0])} ${fmt(pts[i][1])}`;
  }
  if (closed) d += "Z";
  return d;
}

function dedupe(pts) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    if (!near(out[out.length-1], pts[i])) out.push(pts[i]);
  }
  if (out.length > 2 && near(out[0], out[out.length-1])) out.pop();
  return out;
}

function chain(segments) {
  const used = new Array(segments.length).fill(false);
  const chains = [];
  for (let i = 0; i < segments.length; i++) {
    if (used[i] || segments[i].length < 1) continue;
    used[i] = true;
    let pts = [...segments[i]];
    let extended = true;
    while (extended) {
      extended = false;
      if (pts.length > 2 && near(pts[0], pts[pts.length-1])) break;
      const end = pts[pts.length-1];
      const start = pts[0];
      for (let j = 0; j < segments.length; j++) {
        if (used[j]) continue;
        const s = segments[j];
        if (!s.length) continue;
        if (near(end, s[0])) { pts.push(...s.slice(1)); used[j]=true; extended=true; break; }
        if (near(end, s[s.length-1])) { pts.push(...[...s].reverse().slice(1)); used[j]=true; extended=true; break; }
        if (near(start, s[s.length-1])) { pts.unshift(...s.slice(0,-1)); used[j]=true; extended=true; break; }
        if (near(start, s[0])) { pts.unshift(...[...s].reverse().slice(0,-1)); used[j]=true; extended=true; break; }
      }
    }
    chains.push(dedupe(pts));
  }
  return chains;
}

for (const name of files) {
  const p = path.join(dir, name);
  const svg = fs.readFileSync(p, "utf8");
  const rootMatch = svg.match(/<svg\b[^>]*>/i);
  if (!rootMatch) { console.log("no root", name); continue; }
  const root = rootMatch[0];

  // extract path d + shared attrs (assume uniform stroke on these CAD files)
  const pathRe = /<path\b([^>]*?)\s+d="([^"]+)"([^>]*?)\/?>(?:<\/path>)?/gi;
  const segments = [];
  let m;
  let sampleTag = null;
  while ((m = pathRe.exec(svg))) {
    const attrs = (m[1] + " " + m[3]).trim();
    if (!sampleTag) sampleTag = attrs;
    const pts = pathPoints(m[2]);
    if (pts.length >= 1) segments.push(pts);
  }

  if (!segments.length) { console.log("no paths", name); continue; }

  const before = svg.length;
  const chains = chain(segments);
  // drop degenerate
  const good = chains.filter(c => c.length >= 2);
  const ds = good.map((c, idx) => {
    // detect closed: first≈last already stripped by dedupe; check original proximity
    return toPathD(c, false);
  }).filter(Boolean);

  // Rebuild path tags with uniform attrs from sample (strip fill/stroke that
  // generator re-applies); keep only structural leftovers if any.
  // These CAD files use fill="none" stroke="black" stroke-width="..."
  const strokeW = sampleTag.match(/stroke-width="([^"]+)"/)?.[1] || "0.5";
  const pathsHtml = ds.map(d => `<path d="${d}" fill="none" stroke="black" stroke-width="${strokeW}"/>`).join("\n");

  const out = svg.replace(rootMatch[0], rootMatch[0]).replace(pathRe, "");
  // easier: reconstruct from root + paths
  const newSvg = root + "\n" + pathsHtml + "\n</svg>\n";

  // verify root still has xmlns closing - rootMatch is open tag only
  // ensure closing tag
  let finalSvg = newSvg;
  if (!finalSvg.includes("</svg>")) finalSvg += "</svg>";

  fs.writeFileSync(p, finalSvg, "utf8");
  const after = finalSvg.length;
  console.log(`${name}`);
  console.log(`  segments ${segments.length} → chains ${good.length}  ${before} → ${after} B (${((1-after/before)*100).toFixed(1)}% smaller)`);
}
