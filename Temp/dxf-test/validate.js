// Strict DXF structural validator for buildDxf output.
// Run: node validate.js   (requires dxfExport.js compiled next to it)
const fs = require("fs");
const path = require("path");
const { buildDxf } = require("./dxfExport.js");

const STRING_CODES = new Set([0, 1, 2, 6, 8, 9]);
const NUMERIC_CODES = new Set([10, 11, 20, 21, 30, 31, 40, 50, 62, 70, 90]);
const NUMERIC_RE = /^[+-]?(\d+(\.\d+)?|\.\d+)$/;

function validate(name, dxf) {
  const errors = [];
  const lines = dxf.replace(/\n+$/, "").split("\n");
  if (lines.length % 2 !== 0) errors.push(`odd line count ${lines.length} (unpaired code)`);
  const pairs = [];
  for (let i = 0; i + 1 < lines.length; i += 2) pairs.push([lines[i], lines[i + 1]]);

  pairs.forEach(([codeStr, value], idx) => {
    if (!/^\d+$/.test(codeStr)) {
      errors.push(`pair #${idx}: non-integer group code ${JSON.stringify(codeStr)}`);
      return;
    }
    const code = Number(codeStr);
    if (STRING_CODES.has(code)) {
      if (/[\r]/.test(value)) errors.push(`pair #${idx} (code ${code}): control char in ${JSON.stringify(value)}`);
      if (/NaN|Infinity|undefined/.test(value)) errors.push(`pair #${idx} (code ${code}): bad token ${JSON.stringify(value)}`);
      return;
    }
    if (NUMERIC_CODES.has(code)) {
      if (!NUMERIC_RE.test(value)) {
        errors.push(`pair #${idx} (code ${code}): invalid numeric ${JSON.stringify(value)} (exponent/NaN/Infinity?)`);
        return;
      }
      if (!Number.isFinite(Number(value))) errors.push(`pair #${idx} (code ${code}): non-finite ${value}`);
      return;
    }
    errors.push(`pair #${idx}: unknown group code ${code} with value ${JSON.stringify(value)}`);
  });

  // Section / table nesting + EOF
  let depth = 0, inTable = 0, section = null, sawTable = false;
  const sections = [];
  const tableLayers = new Set();
  const usedLayers = new Set();
  let entityLayerRefs = new Set();
  let sawEof = false, sawEntities = false;
  const entityCounts = {};

  for (let i = 0; i < pairs.length; i++) {
    const [codeStr, value] = pairs[i];
    const code = Number(codeStr);
    if (sawEof) { errors.push(`content after EOF at pair #${i}`); break; }
    if (code === 0 && value === "EOF") {
      if (i !== pairs.length - 1) errors.push("EOF is not the last pair");
      if (depth !== 0) errors.push("EOF inside open section");
      sawEof = true; continue;
    }
    if (code === 0 && value === "SECTION") {
      const next = pairs[i + 1];
      if (!next || Number(next[0]) !== 2) { errors.push(`SECTION without name at #${i}`); continue; }
      if (depth !== 0) errors.push(`nested SECTION at #${i}`);
      depth++; section = next[1]; sections.push(section);
      if (!["HEADER", "TABLES", "ENTITIES"].includes(section)) errors.push(`unexpected SECTION ${section}`);
      if (section === "ENTITIES") sawEntities = true;
      i++; continue;
    }
    if (code === 0 && value === "ENDSEC") {
      if (depth === 0) { errors.push(`ENDSEC without SECTION at #${i}`); continue; }
      depth--; section = null; continue;
    }
    if (code === 0 && value === "TABLE") {
      if (!section || section !== "TABLES") errors.push(`TABLE outside TABLES at #${i}`);
      const next = pairs[i + 1];
      if (!next || Number(next[0]) !== 2 || next[1] !== "LAYER") errors.push(`TABLE without LAYER name at #${i}`);
      inTable++; sawTable = true; i++; continue;
    }
    if (code === 0 && value === "ENDTAB") {
      if (inTable === 0) errors.push(`ENDTAB without TABLE at #${i}`);
      inTable--; continue;
    }
    if (code === 0 && value === "LAYER" && inTable > 0) {
      const next = pairs[i + 1];
      if (next && Number(next[0]) === 2) tableLayers.add(next[1]);
      continue;
    }
    if (code === 8) usedLayers.add(value);
    if (code === 0) {
      entityCounts[value] = (entityCounts[value] || 0) + 1;
      if (section === "ENTITIES") entityLayerRefs = new Set();
      if (section === "ENTITIES" && !["LINE", "LWPOLYLINE", "TEXT"].includes(value)) {
        errors.push(`unexpected entity type ${value} in ENTITIES`);
      }
    }
    // LWPOLYLINE vertex count check
    if (code === 0 && value === "LWPOLYLINE") {
      let declared = null, vertices = 0, closedFlag = null;
      let j = i + 1;
      for (; j < pairs.length; j++) {
        const [c2, v2] = pairs[j];
        if (Number(c2) === 0) break;
        if (Number(c2) === 90) declared = Number(v2);
        if (Number(c2) === 70) closedFlag = Number(v2);
        if (Number(c2) === 10) vertices++;
      }
      if (declared === null) errors.push(`LWPOLYLINE #${i} missing group 90`);
      else if (declared !== vertices) errors.push(`LWPOLYLINE #${i}: group90=${declared} but ${vertices} vertices`);
      if (closedFlag === null) errors.push(`LWPOLYLINE #${i} missing group 70`);
    }
  }
  if (!sawEof) errors.push("missing EOF");
  if (depth !== 0) errors.push(`${depth} unclosed section(s)`);
  if (inTable !== 0) errors.push(`${inTable} unclosed TABLE(s)`);
  if (!sawTable) errors.push("missing TABLES section");
  if (!sawEntities) errors.push("missing ENTITIES section");
  if (!sections.includes("HEADER")) errors.push("missing HEADER section");
  usedLayers.forEach((l) => {
    if (!tableLayers.has(l)) errors.push(`entity references undefined layer ${l}`);
  });

  return { errors, size: Buffer.byteLength(dxf, "utf8"), entityCounts };
}

const cases = {
  "empty": [],
  "rect": [{ id: "r1", type: "rectangle", x: 5000, y: 3000, width: 2000, height: 1000, rotation: 0 }],
  "rect-rot90": [{ id: "r2", type: "rectangle", x: 5000, y: 3000, width: 2000, height: 1000, rotation: 90 }],
  "rect-rot45": [{ id: "r3", type: "rectangle", x: 1234.5, y: 999.25, width: 2000, height: 1000, rotation: 45 }],
  "rect-nan-rotation": [{ id: "r4", type: "rectangle", x: 100, y: 100, width: 500, height: 500, rotation: NaN }],
  "ellipse": [{ id: "e1", type: "ellipse", x: 0, y: 0, width: 4000, height: 2500, rotation: 0 }],
  "circle": [{ id: "c1", type: "circle", x: 0, y: 0, width: 1000, height: 1000, rotation: 0 }],
  "polygon": [{ id: "p1", type: "polygon", x: 0, y: 0, width: 1500, height: 1500, rotation: 0, polygonSides: 5 }],
  "line": [{ id: "l1", type: "line", x: 0, y: 0, width: 3000, height: 0, rotation: 0 }],
  "wall": [{
    id: "w1", type: "wall-segments", wallThickness: 150,
    wallNodes: [{ x: 0, y: 0 }, { x: 6000, y: 0 }, { x: 6000, y: 4000 }],
    wallEdges: [{ a: 0, b: 1 }, { a: 1, b: 2 }],
  }],
  "dimension-horizontal": [{
    id: "d1", type: "dimension", startPoint: { x: 0, y: 0 }, endPoint: { x: 6000, y: 0.0001 }, offset: 400,
  }],
  "text-newline": [{ id: "t1", type: "text-annotation", x: 10, y: 10, text: "Line one\r\nLine two\x07!", fontSize: 16, rotation: 0 }],
  "label-arrow": [{ id: "la1", type: "label-arrow", startPoint: { x: 0, y: 0 }, endPoint: { x: 2000, y: 1500 }, label: "Head table", fontSize: 16 }],
  "asset": [{ id: "a1", type: "round-table", x: 1000, y: 1000, width: 1500, height: 1500, rotation: 30, showTableName: true, tableName: "T1" }],
  "kitchen-sink": [
    { id: "k1", type: "rectangle", x: 0, y: 0, width: 9000, height: 6000, rotation: 0 },
    { id: "k2", type: "ellipse", x: 4500, y: 3000, width: 2000, height: 1200, rotation: 90 },
    { id: "k3", type: "wall-segments", wallThickness: 200, wallNodes: [{ x: 0, y: 0 }, { x: 9000, y: 6000 }], wallEdges: [{ a: 0, b: 1 }] },
    { id: "k4", type: "dimension", startPoint: { x: 0, y: 6000 }, endPoint: { x: 9000, y: 6000 }, offset: 500 },
    { id: "k5", type: "text-annotation", x: 4500, y: 100, text: "Stage", fontSize: 20, rotation: 12.5 },
    { id: "k6", type: "circle", x: 7000, y: 5000, width: 800, height: 800, rotation: 0 },
    { id: "k7", type: "label-arrow", startPoint: { x: 100, y: 100 }, endPoint: { x: 3000, y: 2000 }, label: "Bar" },
  ],
};

let failed = 0;
const report = [];
for (const [name, items] of Object.entries(cases)) {
  const dxf = buildDxf(items, "metric-mm");
  const { errors, size } = validate(name, dxf);
  const status = errors.length === 0 ? "PASS" : "FAIL";
  if (errors.length) failed++;
  report.push(`${status}  ${name.padEnd(22)} ${String(size).padStart(6)} B${errors.length ? "\n      - " + errors.slice(0, 6).join("\n      - ") : ""}`);
}
console.log(report.join("\n"));
console.log(failed === 0 ? "\nALL PASS" : `\n${failed} CASE(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
