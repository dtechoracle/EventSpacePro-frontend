const { buildDxf } = require('./dxfExport.js');

const analyze = (label, items) => {
  const t0 = Date.now();
  const out = buildDxf(items, 'metric-mm');
  const hasNaN = out.includes('NaN') || out.includes('undefined') || out.includes('Infinity');
  console.log(`${label}: ${out.length} bytes | NaN/undefined/Infinity: ${hasNaN} | ${Date.now() - t0}ms`);
  return out;
};

// 1. Empty
analyze('empty', []);

// 2. Circle shape (as ExportPanel maps ellipse->circle)
const circle = { id: 'c1', type: 'circle', x: 5000, y: 3000, width: 2000, height: 2000, rotation: 0, scale: 1, points: [] };
analyze('circle only', [circle]);

// 3. Rectangle
const rect = { id: 'r1', type: 'rectangle', x: 0, y: 0, width: 4000, height: 2500, rotation: 15, scale: 1 };
analyze('rect only', [rect]);

// 4. Wall (1 edge) — ExportPanel shape
const wall = {
  id: 'w1', type: 'wall-segments', x: 0, y: 0, width: 0, height: 0, scale: 1, rotation: 0,
  wallNodes: [{ id: 'n1', x: 0, y: 0 }, { id: 'n2', x: 10000, y: 0 }],
  wallEdges: [{ id: 'e1', a: 0, b: 1 }],
  wallThickness: 150, zIndex: 1,
};
analyze('wall 1 edge', [wall]);

// 5. Asset footprint
const asset = { id: 'a1', type: 'chair', x: 1000, y: 1000, width: 500, height: 500, rotation: 0, scale: 1, showTableName: true, tableName: 'T1' };
analyze('asset', [asset]);

// 6. Dimension (typical store shape)
const dim = { id: 'd1', type: 'dimension', startPoint: { x: 0, y: 0 }, endPoint: { x: 5000, y: 0 }, offset: 400, fontSize: 11, zIndex: 5 };
analyze('dimension', [dim]);

// 7. Text annotation empty vs filled
analyze('text empty', [{ id: 't1', type: 'text-annotation', x: 0, y: 0, text: '', fontSize: 16, rotation: 0 }]);
analyze('text filled', [{ id: 't1', type: 'text-annotation', x: 0, y: 0, text: 'HEAD TABLE', fontSize: 16, rotation: 0 }]);

// 8. Line shape with points
const line = { id: 'l1', type: 'line', x: 0, y: 0, width: 3000, height: 0, rotation: 0, scale: 1, points: [{ x: 0, y: 0 }, { x: 3000, y: 0 }] };
analyze('line', [line]);

// 9. Line WITHOUT points (fallback midpoint calc)
analyze('line no points', [{ id: 'l2', type: 'line', x: 0, y: 0, width: 3000, height: 0, rotation: 0, scale: 1 }]);

// 10. Repeated calls — state check (first vs later)
const items = [circle, rect, wall, asset, dim, line];
const a = analyze('mixed #1', items);
const b = analyze('mixed #2 (repeat, same input)', items);
const c = analyze('mixed #3 (repeat, same input)', items);
console.log('repeat deterministic:', a === b && b === c);

// 11. path shape — needs DOM (getTotalLength): document undefined -> returns []
analyze('path shape (no DOM -> expect 0 entities)', [{ id: 'p1', type: 'path', x: 0, y: 0, width: 100, height: 100, rotation: 0, scale: 1, svgPath: 'M 0 0 L 100 0 L 100 100 Z' }]);

// 12. freehand
analyze('freehand', [{ id: 'f1', type: 'freehand', x: 0, y: 0, width: 100, height: 100, rotation: 0, scale: 1, points: [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 5 }] }]);

// Show structure head/tail of the circle export
const s = buildDxf([circle], 'metric-mm');
console.log('\n--- circle export head ---');
console.log(JSON.stringify(s.slice(0, 200)));
console.log('--- tail ---');
console.log(JSON.stringify(s.slice(-80)));

