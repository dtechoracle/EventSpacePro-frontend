import { LibreDwg, Dwg_File_Type } from '@mlightcad/libredwg-web';
import type { DwgDatabase, DwgEntity, DwgBlockRecordTableEntry, DwgLayerTableEntry } from '@mlightcad/libredwg-web';

let libredwgInstance: any = null;
let initPromise: Promise<any> | null = null;

async function getLibredwg() {
  if (libredwgInstance) return libredwgInstance;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const instance = await LibreDwg.create('/wasm/');
    libredwgInstance = instance;
    return instance;
  })();
  return initPromise;
}

const svgCache: Record<string, string> = {};

const ACI_COLORS: Record<number, string> = {
  1: '#FF0000', 2: '#FFFF00', 3: '#00FF00', 4: '#00FFFF',
  5: '#0000FF', 6: '#FF00FF', 7: '#000000', 8: '#808080',
  9: '#C0C0C0', 10: '#FF0000', 11: '#FF7F7F', 12: '#CC0000',
  13: '#CC7F7F', 14: '#990000', 15: '#997F7F', 16: '#FF3F00',
  17: '#FFBF7F', 18: '#CC3F00', 19: '#CCBF7F', 20: '#993F00',
  21: '#99BF7F', 22: '#FF7F00', 23: '#FFBF7F', 24: '#CC7F00',
  25: '#FFBF00', 26: '#FF7F00', 27: '#CCBF00', 28: '#99BF00',
  29: '#99FF00', 30: '#3F3F00', 31: '#FFFF3F', 32: '#3FFF00',
  33: '#00FF3F', 34: '#00FF7F', 35: '#00FFBF', 36: '#00FFFF',
  37: '#00BFFF', 38: '#0099FF', 39: '#003FFF', 40: '#0000FF',
  41: '#3F3FFF', 42: '#0000CC', 43: '#000099', 44: '#00003F',
  45: '#7F00FF', 46: '#3F00FF', 47: '#7F00CC', 48: '#3F00CC',
  49: '#FF00FF', 50: '#FF00BF', 51: '#FF0099', 52: '#FF007F',
  53: '#FF003F', 54: '#FF3F3F', 55: '#FF7F3F', 56: '#FFBF3F',
  57: '#FFFF3F', 58: '#BFFF3F', 59: '#7FFF3F', 60: '#3FFF3F',
  61: '#3FFF7F', 62: '#3FFFBF', 63: '#3FFFFF', 64: '#3FBFFF',
  65: '#3F7FFF', 66: '#3F3FFF', 67: '#7F3FFF', 68: '#BF3FFF',
  69: '#FF3FFF', 70: '#FF7F7F', 71: '#FFBF7F', 72: '#FFFF7F',
  73: '#BFFF7F', 74: '#7FFF7F', 75: '#7FFFBF', 76: '#7FFFFF',
  77: '#7FBFFF', 78: '#7F7FFF', 79: '#BF7FFF', 80: '#FF7FFF',
  81: '#FFBFBF', 82: '#FFFFBF', 83: '#BFBFBF', 84: '#7FBFBF',
  85: '#BFBF7F', 86: '#BFFF7F', 87: '#7FFFFF', 88: '#BFFFFF',
  89: '#BFBFFF', 90: '#7F7F7F', 91: '#FF7FBF', 92: '#FFBFBF',
  93: '#BFBFBF', 94: '#FFFFBF', 95: '#BFFF7F', 96: '#FF7FBF',
  97: '#FFBFBF', 98: '#BFBFBF', 99: '#FFFFBF', 100: '#BFFF7F',
  101: '#FFBFBF', 102: '#FFFFBF', 103: '#BFBFBF', 104: '#FFFFBF',
  105: '#BFFF7F', 106: '#FF7F7F', 107: '#FF7F3F', 108: '#FFBF3F',
  109: '#FFFF3F', 110: '#7FFF3F', 111: '#3FFF3F', 112: '#3FFF7F',
  113: '#3FFFBF', 114: '#3FFFFF', 115: '#3FBFFF', 116: '#3F7FFF',
  117: '#7F3FFF', 118: '#BF3FFF', 119: '#FF3FFF', 120: '#FF3FBF',
  121: '#FF3F7F', 122: '#FF3F3F', 123: '#FF3F00', 124: '#FFBF00',
  125: '#FFFF00', 126: '#7FFF00', 127: '#00FF00',   128: '#00FFBF',
  129: '#00FFFF',
  130: '#00BFFF', 131: '#007FFF',
  140: '#FF00BF', 150: '#FF007F', 160: '#FF003F', 170: '#FF0000',
  180: '#FF3F00', 190: '#FF7F00', 200: '#FFBF00', 210: '#FFFF00',
  220: '#BFFF00', 230: '#7FFF00', 240: '#3FFF00', 250: '#00FF00',
  251: '#00FF3F', 252: '#00FF7F', 253: '#00FFBF', 254: '#00FFFF', 255: '#00BFFF',
};

function getEntityColor(entity: DwgEntity, layers: DwgLayerTableEntry[]): string {
  let colorIdx = entity.colorIndex;
  if (colorIdx === 256 || colorIdx === undefined) {
    const layer = layers.find(l => l.name === entity.layer);
    if (layer) colorIdx = layer.colorIndex;
  }
  if (colorIdx === 7 || colorIdx === 0 || colorIdx === undefined) return '#000000';
  if (entity.color != null && entity.color > 0 && entity.color <= 0xffffff) {
    return '#' + entity.color.toString(16).padStart(6, '0');
  }
  if (colorIdx != null && ACI_COLORS[colorIdx]) return ACI_COLORS[colorIdx];
  return '#000000';
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function entityToSvg(entity: DwgEntity, blockMap: Map<string, DwgBlockRecordTableEntry>, layers: DwgLayerTableEntry[], visited: Set<string>, strokeWidth: number): string | null {
  const color = '#000000';
  const attrs = `stroke="${color}" fill="none" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"`;

  const layer = layers.find(l => l.name === entity.layer);
  if (layer && (layer.frozen || layer.off)) return null;

  switch (entity.type) {
    case 'LINE': {
      const e = entity as any;
      return `<line x1="${e.startPoint.x}" y1="${e.startPoint.y}" x2="${e.endPoint.x}" y2="${e.endPoint.y}" ${attrs}/>`;
    }
    case 'LWPOLYLINE': {
      const e = entity as any;
      if (!e.vertices || e.vertices.length < 2) return null;
      const closed = !!(e.flag & 0x200);
      let d = `M${e.vertices[0].x},${e.vertices[0].y}`;
      for (let i = 1; i < e.vertices.length; i++) {
        const v = e.vertices[i];
        const prev = e.vertices[i - 1];
        if (v.bulge && v.bulge !== 0) {
          const dx = v.x - prev.x;
          const dy = v.y - prev.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const bulge = v.bulge;
          const sagitta = dist * bulge / 2;
          const cx = (prev.x + v.x) / 2 - (dy * sagitta / dist);
          const cy = (prev.y + v.y) / 2 + (dx * sagitta / dist);
          const r = (dist / 2) * (1 + bulge * bulge / 4);
          const startAngle = Math.atan2(prev.y - cy, prev.x - cx);
          const endAngle = Math.atan2(v.y - cy, v.x - cx);
          const largeArc = Math.abs(bulge) > 1 ? 1 : 0;
          const sweep = bulge > 0 ? 1 : 0;
          d += ` A${r},${r} 0 ${largeArc} ${sweep} ${v.x},${v.y}`;
        } else {
          d += ` L${v.x},${v.y}`;
        }
      }
      if (closed) d += ' Z';
      return `<path d="${d}" ${attrs}/>`;
    }
    case 'POLYLINE2D': {
      const e = entity as any;
      if (!e.vertices || e.vertices.length < 2) return null;
      const closed = !!(e.flag & 1);
      let d = `M${e.vertices[0].x},${e.vertices[0].y}`;
      for (let i = 1; i < e.vertices.length; i++) {
        const v = e.vertices[i];
        if (v.bulge && v.bulge !== 0) {
          const prev = e.vertices[i - 1];
          const dx = v.x - prev.x;
          const dy = v.y - prev.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0) {
            const sagitta = dist * v.bulge / 2;
            const cx = (prev.x + v.x) / 2 - (dy * sagitta / dist);
            const cy = (prev.y + v.y) / 2 + (dx * sagitta / dist);
            const r = (dist / 2) * (1 + v.bulge * v.bulge / 4);
            const largeArc = Math.abs(v.bulge) > 1 ? 1 : 0;
            const sweep = v.bulge > 0 ? 1 : 0;
            d += ` A${r},${r} 0 ${largeArc} ${sweep} ${v.x},${v.y}`;
          } else {
            d += ` L${v.x},${v.y}`;
          }
        } else {
          d += ` L${v.x},${v.y}`;
        }
      }
      if (closed) d += ' Z';
      return `<path d="${d}" ${attrs}/>`;
    }
    case 'POLYLINE3D': {
      const e = entity as any;
      if (!e.vertices || e.vertices.length < 2) return null;
      const closed = !!(e.flag & 1);
      let d = `M${e.vertices[0].x},${e.vertices[0].y}`;
      for (let i = 1; i < e.vertices.length; i++) {
        d += ` L${e.vertices[i].x},${e.vertices[i].y}`;
      }
      if (closed) d += ' Z';
      return `<path d="${d}" ${attrs}/>`;
    }
    case 'CIRCLE': {
      const e = entity as any;
      return `<circle cx="${e.center.x}" cy="${e.center.y}" r="${e.radius}" ${attrs}/>`;
    }
    case 'ARC': {
      const e = entity as any;
      const startRad = (e.startAngle * Math.PI) / 180;
      const endRad = (e.endAngle * Math.PI) / 180;
      const x1 = e.center.x + e.radius * Math.cos(startRad);
      const y1 = e.center.y + e.radius * Math.sin(startRad);
      const x2 = e.center.x + e.radius * Math.cos(endRad);
      const y2 = e.center.y + e.radius * Math.sin(endRad);
      let sweep = e.endAngle - e.startAngle;
      if (sweep < 0) sweep += 360;
      const largeArc = sweep > 180 ? 1 : 0;
      return `<path d="M${x1},${y1} A${e.radius},${e.radius} 0 ${largeArc} 1 ${x2},${y2}" ${attrs}/>`;
    }
    case 'ELLIPSE': {
      const e = entity as any;
      const rx = Math.sqrt(e.majorAxisEndPoint.x ** 2 + e.majorAxisEndPoint.y ** 2);
      const ry = rx * e.axisRatio;
      const rotation = Math.atan2(e.majorAxisEndPoint.y, e.majorAxisEndPoint.x) * 180 / Math.PI;
      if (Math.abs(e.startAngle) < 0.001 && Math.abs(e.endAngle - Math.PI * 2) < 0.001) {
        return `<ellipse cx="${e.center.x}" cy="${e.center.y}" rx="${rx}" ry="${ry}" transform="rotate(${rotation} ${e.center.x} ${e.center.y})" ${attrs}/>`;
      }
      const segments = 64;
      const startT = e.startAngle;
      const endT = e.endAngle;
      const points: string[] = [];
      for (let i = 0; i <= segments; i++) {
        const t = startT + (endT - startT) * i / segments;
        const cosT = Math.cos(t);
        const sinT = Math.sin(t);
        const px = e.center.x + rx * cosT * Math.cos(rotation * Math.PI / 180) - ry * sinT * Math.sin(rotation * Math.PI / 180);
        const py = e.center.y + rx * cosT * Math.sin(rotation * Math.PI / 180) + ry * sinT * Math.cos(rotation * Math.PI / 180);
        points.push(`${i === 0 ? 'M' : 'L'}${px},${py}`);
      }
      return `<path d="${points.join(' ')}" ${attrs}/>`;
    }
    case 'SPLINE': {
      const e = entity as any;
      if (!e.controlPoints || e.controlPoints.length < 2) return null;
      const pts = e.controlPoints;
      let d = `M${pts[0].x},${pts[0].y}`;
      if (pts.length === 2) {
        d += ` L${pts[1].x},${pts[1].y}`;
      } else if (pts.length === 3) {
        d += ` Q${pts[1].x},${pts[1].y} ${pts[2].x},${pts[2].y}`;
      } else if (pts.length >= 4) {
        d += ` C${pts[1].x},${pts[1].y} ${pts[2].x},${pts[2].y} ${pts[3].x},${pts[3].y}`;
        for (let i = 4; i < pts.length; i += 3) {
          if (i + 2 < pts.length) {
            d += ` ${pts[i].x},${pts[i].y} ${pts[i + 1].x},${pts[i + 1].y} ${pts[i + 2].x},${pts[i + 2].y}`;
          } else if (i + 1 < pts.length) {
            d += ` Q${pts[i].x},${pts[i].y} ${pts[i + 1].x},${pts[i + 1].y}`;
          } else {
            d += ` L${pts[i].x},${pts[i].y}`;
          }
        }
      }
      return `<path d="${d}" ${attrs}/>`;
    }
    case 'TEXT': {
      const e = entity as any;
      const size = e.textHeight || 200;
      return `<text x="${e.startPoint.x}" y="${e.startPoint.y}" font-size="${size}" fill="#000000" stroke="none" font-family="Arial,sans-serif" transform="rotate(${(e.rotation || 0) * 180 / Math.PI} ${e.startPoint.x} ${e.startPoint.y})">${escapeXml(e.text || '')}</text>`;
    }
    case 'MTEXT': {
      const e = entity as any;
      const size = e.textHeight || 200;
      return `<text x="${e.insertionPoint.x}" y="${e.insertionPoint.y}" font-size="${size}" fill="#000000" stroke="none" font-family="Arial,sans-serif" transform="rotate(${(e.rotation || 0) * 180 / Math.PI} ${e.insertionPoint.x} ${e.insertionPoint.y})">${escapeXml(e.text || '')}</text>`;
    }
    case 'POINT': {
      const e = entity as any;
      return `<circle cx="${e.position.x}" cy="${e.position.y}" r="3" fill="#000000" stroke="none"/>`;
    }
    case '3DFACE': {
      const e = entity as any;
      const pts = [e.corner1, e.corner2, e.corner3];
      if (e.corner4) pts.push(e.corner4);
      return `<polygon points="${pts.map((p: any) => `${p.x},${p.y}`).join(' ')}" ${attrs}/>`;
    }
    case 'SOLID': {
      const e = entity as any;
      const pts = [e.corner1, e.corner2, e.corner3];
      if (e.corner4) pts.push(e.corner4);
      return `<polygon points="${pts.map((p: any) => `${p.x},${p.y}`).join(' ')}" ${attrs}/>`;
    }
    case 'HATCH': {
      const e = entity as any;
      if (!e.boundaryPaths || e.boundaryPaths.length === 0) return null;
      const paths: string[] = [];
      for (const bp of e.boundaryPaths) {
        if ('vertices' in bp && bp.vertices) {
          let d = `M${bp.vertices[0].x},${bp.vertices[0].y}`;
          for (let i = 1; i < bp.vertices.length; i++) {
            const v = bp.vertices[i];
            const prev = bp.vertices[i - 1];
            if (v.bulge && v.bulge !== 0) {
              const dx = v.x - prev.x;
              const dy = v.y - prev.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist > 0) {
                const sagitta = dist * v.bulge / 2;
                const r = (dist / 2) * (1 + v.bulge * v.bulge / 4);
                const largeArc = Math.abs(v.bulge) > 1 ? 1 : 0;
                const sweep = v.bulge > 0 ? 1 : 0;
                d += ` A${r},${r} 0 ${largeArc} ${sweep} ${v.x},${v.y}`;
              } else {
                d += ` L${v.x},${v.y}`;
              }
            } else {
              d += ` L${v.x},${v.y}`;
            }
          }
          if (bp.isClosed) d += ' Z';
          paths.push(`<path d="${d}" fill="none" stroke="#000000" stroke-width="${strokeWidth * 0.5}" stroke-linecap="round" stroke-linejoin="round"/>`);
        } else if ('edges' in bp && bp.edges) {
          let d = '';
          for (const edge of bp.edges) {
            if (edge.type === 1) {
              d += `M${edge.start.x},${edge.start.y} L${edge.end.x},${edge.end.y} `;
            } else if (edge.type === 2) {
              const startRad = edge.startAngle;
              const endRad = edge.endAngle;
              const x1 = edge.center.x + edge.radius * Math.cos(startRad);
              const y1 = edge.center.y + edge.radius * Math.sin(startRad);
              const x2 = edge.center.x + edge.radius * Math.cos(endRad);
              const y2 = edge.center.y + edge.radius * Math.sin(endRad);
              let sweep = endRad - startRad;
              if (sweep < 0) sweep += Math.PI * 2;
              const largeArc = sweep > Math.PI ? 1 : 0;
              d += `M${x1},${y1} A${edge.radius},${edge.radius} 0 ${largeArc} 1 ${x2},${y2} `;
            }
          }
          if (d) paths.push(`<path d="${d}" fill="none" stroke="#000000" stroke-width="${strokeWidth * 0.5}" stroke-linecap="round" stroke-linejoin="round"/>`);
        }
      }
      return paths.join('') || null;
    }
    case 'INSERT': {
      const e = entity as any;
      const block = blockMap.get(e.name);
      if (!block) return null;
      if (visited.has(e.name)) return null;
      visited.add(e.name);
      const innerSvgs: string[] = [];
      for (const ent of block.entities) {
        const svg = entityToSvg(ent, blockMap, layers, visited, strokeWidth);
        if (svg) innerSvgs.push(svg);
      }
      visited.delete(e.name);
      if (innerSvgs.length === 0) return null;
      const rot = (e.rotation || 0) * 180 / Math.PI;
      return `<g transform="translate(${e.insertionPoint.x},${e.insertionPoint.y}) rotate(${rot}) scale(${e.xScale || 1},${e.yScale || 1})">${innerSvgs.join('')}</g>`;
    }
    case 'DIMENSION': {
      const e = entity as any;
      const pts = [e.definitionPoint, e.textPoint];
      return `<text x="${e.textPoint.x}" y="${e.textPoint.y}" font-size="150" fill="#000000" stroke="none" font-family="Arial,sans-serif">${escapeXml(e.text || '')}</text>`;
    }
    case 'RAY': {
      const e = entity as any;
      const scale = 100000;
      const x2 = e.firstPoint.x + e.unitDirection.x * scale;
      const y2 = e.firstPoint.y + e.unitDirection.y * scale;
      return `<line x1="${e.firstPoint.x}" y1="${e.firstPoint.y}" x2="${x2}" y2="${y2}" ${attrs}/>`;
    }
    case 'XLINE': {
      const e = entity as any;
      const scale = 100000;
      const x1 = e.firstPoint.x - e.unitDirection.x * scale;
      const y1 = e.firstPoint.y - e.unitDirection.y * scale;
      const x2 = e.firstPoint.x + e.unitDirection.x * scale;
      const y2 = e.firstPoint.y + e.unitDirection.y * scale;
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${attrs}/>`;
    }
    default:
      return null;
  }
}

function buildSvgFromDb(db: DwgDatabase): string {
  const layers = db.tables.LAYER.entries;
  const blockMap = new Map<string, DwgBlockRecordTableEntry>();
  let modelSpace: DwgBlockRecordTableEntry | null = null;

  for (const block of db.tables.BLOCK_RECORD.entries) {
    const name = block.name.toUpperCase();
    if (name === '*MODEL_SPACE') {
      modelSpace = block;
    } else if (!name.startsWith('*PAPER_SPACE')) {
      blockMap.set(block.name, block);
    }
  }

  if (!modelSpace) return '<svg xmlns="http://www.w3.org/2000/svg"></svg>';

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const updateBounds = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };

  function measureEntity(entity: DwgEntity) {
    switch (entity.type) {
      case 'LINE': {
        const e = entity as any;
        updateBounds(e.startPoint.x, e.startPoint.y);
        updateBounds(e.endPoint.x, e.endPoint.y);
        break;
      }
      case 'LWPOLYLINE': {
        const e = entity as any;
        if (e.vertices) for (const v of e.vertices) updateBounds(v.x, v.y);
        break;
      }
      case 'POLYLINE2D':
      case 'POLYLINE3D': {
        const e = entity as any;
        if (e.vertices) for (const v of e.vertices) updateBounds(v.x, v.y);
        break;
      }
      case 'CIRCLE': {
        const e = entity as any;
        updateBounds(e.center.x - e.radius, e.center.y - e.radius);
        updateBounds(e.center.x + e.radius, e.center.y + e.radius);
        break;
      }
      case 'ARC': {
        const e = entity as any;
        updateBounds(e.center.x - e.radius, e.center.y - e.radius);
        updateBounds(e.center.x + e.radius, e.center.y + e.radius);
        break;
      }
      case 'ELLIPSE': {
        const e = entity as any;
        const rx = Math.sqrt(e.majorAxisEndPoint.x ** 2 + e.majorAxisEndPoint.y ** 2);
        const ry = rx * e.axisRatio;
        updateBounds(e.center.x - rx, e.center.y - ry);
        updateBounds(e.center.x + rx, e.center.y + ry);
        break;
      }
      case 'SPLINE': {
        const e = entity as any;
        if (e.controlPoints) for (const p of e.controlPoints) updateBounds(p.x, p.y);
        break;
      }
      case 'TEXT':
      case 'MTEXT': {
        const e = entity as any;
        const pos = e.startPoint || e.insertionPoint;
        if (pos) updateBounds(pos.x, pos.y);
        break;
      }
      case 'POINT': {
        const e = entity as any;
        updateBounds(e.position.x, e.position.y);
        break;
      }
      case '3DFACE': {
        const e = entity as any;
        updateBounds(e.corner1.x, e.corner1.y);
        updateBounds(e.corner2.x, e.corner2.y);
        updateBounds(e.corner3.x, e.corner3.y);
        if (e.corner4) updateBounds(e.corner4.x, e.corner4.y);
        break;
      }
      case 'SOLID': {
        const e = entity as any;
        updateBounds(e.corner1.x, e.corner1.y);
        updateBounds(e.corner2.x, e.corner2.y);
        updateBounds(e.corner3.x, e.corner3.y);
        if (e.corner4) updateBounds(e.corner4.x, e.corner4.y);
        break;
      }
      case 'HATCH': {
        const e = entity as any;
        if (e.seedPoints) for (const p of e.seedPoints) updateBounds(p.x, p.y);
        if (e.boundaryPaths) {
          for (const bp of e.boundaryPaths) {
            if ('vertices' in bp && bp.vertices) {
              for (const v of bp.vertices) updateBounds(v.x, v.y);
            }
            if ('edges' in bp && bp.edges) {
              for (const edge of bp.edges) {
                if (edge.type === 1) {
                  updateBounds(edge.start.x, edge.start.y);
                  updateBounds(edge.end.x, edge.end.y);
                } else if (edge.type === 2) {
                  updateBounds(edge.center.x - edge.radius, edge.center.y - edge.radius);
                  updateBounds(edge.center.x + edge.radius, edge.center.y + edge.radius);
                }
              }
            }
          }
        }
        break;
      }
      case 'INSERT': {
        const e = entity as any;
        updateBounds(e.insertionPoint.x, e.insertionPoint.y);
        const block = blockMap.get(e.name);
        if (block) {
          for (const ent of block.entities) measureEntity(ent);
        }
        break;
      }
    }
  }

  for (const ent of modelSpace.entities) measureEntity(ent);

  if (minX === Infinity) {
    minX = 0; minY = 0; maxX = 1000; maxY = 1000;
  }

  const padding = Math.max((maxX - minX), (maxY - minY)) * 0.02;
  minX -= padding; minY -= padding; maxX += padding; maxY += padding;

  const vbWidth = maxX - minX;
  const vbHeight = maxY - minY;
  const maxDim = Math.max(vbWidth, vbHeight);

  // Scale stroke width to ~0.5% of the largest dimension for visible lines
  const strokeWidth = Math.max(2, maxDim * 0.005);

  const svgElements: string[] = [];
  const visited = new Set<string>();
  for (const ent of modelSpace.entities) {
    const svg = entityToSvg(ent, blockMap, layers, visited, strokeWidth);
    if (svg) svgElements.push(svg);
  }

  return `<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${vbWidth} ${vbHeight}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
  <g transform="translate(0,${vbHeight}) scale(1,-1)">
    ${svgElements.join('\n    ')}
  </g>
</svg>`;
}

export async function parseDwgToSvg(dwgArrayBuffer: ArrayBuffer): Promise<string> {
  const libredwg = await getLibredwg();

  const dwgData = libredwg.dwg_read_data(dwgArrayBuffer, Dwg_File_Type.DWG);
  if (dwgData === undefined) {
    throw new Error('Failed to parse DWG/DXF file');
  }

  const db: DwgDatabase = libredwg.convert(dwgData);
  libredwg.dwg_free(dwgData);

  return buildSvgFromDb(db);
}

export async function getDwgSvgString(path: string): Promise<string> {
  if (svgCache[path]) return svgCache[path];

  const res = await fetch(path);
  const buffer = await res.arrayBuffer();
  const svgString = await parseDwgToSvg(buffer);
  svgCache[path] = svgString;
  return svgString;
}

export function extractSvgViewBox(svgString: string): { width: number; height: number } | null {
  const viewBoxMatch = svgString.match(/viewBox=["']([^"']+)["']/);
  if (viewBoxMatch) {
    const parts = viewBoxMatch[1].split(/\s+/).map(Number);
    if (parts.length === 4) {
      return { width: parts[2], height: parts[3] };
    }
  }
  const widthMatch = svgString.match(/width=["']([^"']+)["']/);
  const heightMatch = svgString.match(/height=["']([^"']+)["']/);
  if (widthMatch && heightMatch) {
    return { width: parseFloat(widthMatch[1]), height: parseFloat(heightMatch[1]) };
  }
  return null;
}
