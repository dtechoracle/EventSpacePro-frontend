/**
 * EventSpacePro AI Operator — Client-Side Tool Executor
 *
 * Receives tool_calls from the server, executes them against the application state,
 * and returns results. The AI decides WHAT; the application executes HOW.
 */

import { useProjectStore } from '@/store/projectStore';
import { ASSET_LIBRARY } from '@/lib/assets';

export interface ToolCall {
  id: string;
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolResult {
  tool_call_id: string;
  content: string;
}

// ─── Asset lookup helper ─────────────────────────────────────────────────────

function findAssetDef(assetId: string) {
  const normalized = assetId.toLowerCase().replace(/[^a-z0-9]/g, '');
  return ASSET_LIBRARY.find(a => {
    const id = a.id.toLowerCase().replace(/[^a-z0-9]/g, '');
    const label = (a.label || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return id === normalized || label === normalized || id.includes(normalized) || normalized.includes(id);
  });
}

function getAssetDimensions(assetId: string): { width: number; height: number; id: string } {
  const def = findAssetDef(assetId);
  if (def) return { width: def.width || 800, height: def.height || 800, id: def.id };
  // Fallback defaults
  return { width: 800, height: 800, id: assetId };
}

// ─── Tool executors ──────────────────────────────────────────────────────────

function executeGetCurrentLayout(): string {
  const store = useProjectStore.getState();

  const assets = store.assets.map(a => ({
    id: a.id,
    type: a.type,
    name: a.name || a.type,
    x: a.x,
    y: a.y,
    width: a.width * (a.scale || 1),
    height: a.height * (a.scale || 1),
    rotation: a.rotation,
    tableName: a.tableName,
  }));

  const walls = store.walls.map(w => ({
    id: w.id,
    nodes: w.nodes,
    edges: w.edges?.map(e => ({
      id: e.id,
      nodeA: e.nodeA,
      nodeB: e.nodeB,
      thickness: e.thickness,
    })),
    isClosed: w.isClosed,
  }));

  const shapes = store.shapes.map(s => ({
    id: s.id,
    type: s.type,
    name: s.name,
    x: s.x,
    y: s.y,
    width: s.width,
    height: s.height,
    rotation: s.rotation,
    fill: s.fill,
    stroke: s.stroke,
    svgPath: s.svgPath ? '(path data)' : undefined,
  }));

  const textAnnotations = store.textAnnotations.map(t => ({
    id: t.id,
    text: t.text,
    x: t.x,
    y: t.y,
  }));

  // Calculate room dimensions from walls if present
  let room = null;
  if (walls.length > 0) {
    const closedWall = walls.find((w: any) => w.isClosed);
    if (closedWall && closedWall.nodes && closedWall.nodes.length >= 4) {
      const xs = closedWall.nodes.map((n: any) => n.x);
      const ys = closedWall.nodes.map((n: any) => n.y);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      room = { width: maxX - minX, height: maxY - minY, x: minX, y: minY };
    }
  }

  // Check for marquee
  const marquee = assets.find(a => {
    const def = ASSET_LIBRARY.find(d => d.id === a.type);
    return def?.category === 'Marquee' || a.type.toLowerCase().includes('marquee');
  });

  return JSON.stringify({
    canvas: { width: store.canvas?.width || 10000, height: store.canvas?.height || 10000 },
    room,
    marquee: marquee ? { id: marquee.id, type: marquee.type, x: marquee.x, y: marquee.y, width: marquee.width, height: marquee.height } : null,
    assets,
    walls: walls.length,
    shapes,
    textAnnotations,
    asset_count: assets.length,
  });
}

function executeAddTable(args: any): string {
  const store = useProjectStore.getState();
  const { asset_id, x, y, rotation = 0, table_name } = args;

  if (!asset_id || x == null || y == null) {
    return JSON.stringify({ success: false, error: 'Missing required parameters: asset_id, x, y' });
  }

  const dims = getAssetDimensions(asset_id);
  const id = `ai-table-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const asset: any = {
    id,
    type: dims.id,
    name: dims.id,
    x,
    y,
    width: dims.width,
    height: dims.height,
    rotation,
    scale: 1,
    zIndex: store.getNextZIndex(),
    strokeWidth: 0.6,
  };

  if (table_name) {
    asset.tableName = table_name;
    asset.showTableName = true;
  }

  store.addAsset(asset, true);

  return JSON.stringify({
    success: true,
    element: { id, type: dims.id, x, y, width: dims.width, height: dims.height },
  });
}

function executeAddAsset(args: any): string {
  const store = useProjectStore.getState();
  const { asset_id, x, y, rotation = 0, scale = 1 } = args;

  if (!asset_id || x == null || y == null) {
    return JSON.stringify({ success: false, error: 'Missing required parameters: asset_id, x, y' });
  }

  const dims = getAssetDimensions(asset_id);
  const id = `ai-asset-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  store.addAsset({
    id,
    type: dims.id,
    name: dims.id,
    x,
    y,
    width: dims.width,
    height: dims.height,
    rotation,
    scale,
    zIndex: store.getNextZIndex(),
    strokeWidth: 0.6,
  }, true);

  return JSON.stringify({
    success: true,
    element: { id, type: dims.id, x, y, width: dims.width, height: dims.height },
  });
}

function executeAddStage(args: any): string {
  const store = useProjectStore.getState();
  const { x, y, width, height, fill = '#e2e8f0' } = args;

  if (x == null || y == null || !width || !height) {
    return JSON.stringify({ success: false, error: 'Missing required parameters: x, y, width, height' });
  }

  // Validate multiples of 500
  const w = Math.round(width / 500) * 500;
  const h = Math.round(height / 500) * 500;
  if (w < 500 || h < 500) {
    return JSON.stringify({ success: false, error: 'Stage must be at least 500mm x 500mm.' });
  }

  const id = `ai-stage-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  store.addShape({
    id,
    name: 'Stage',
    type: 'rectangle',
    x,
    y,
    width: w,
    height: h,
    rotation: 0,
    fill,
    stroke: '#475569',
    strokeWidth: 2,
    zIndex: store.getNextZIndex(),
  }, true);

  // Add module grid lines as separate shapes
  const gridLines: any[] = [];
  const halfW = w / 2, halfH = h / 2;
  // Vertical lines
  for (let gx = 500; gx < w; gx += 500) {
    gridLines.push({
      id: `${id}-vgrid-${gx}`,
      type: 'line',
      x: x - halfW + gx,
      y: y - halfH,
      width: 0,
      height: h,
      rotation: 0,
      stroke: '#94a3b8',
      strokeWidth: 0.5,
      strokeDasharray: '5,5',
      zIndex: store.getNextZIndex(),
    });
  }
  // Horizontal lines
  for (let gy = 500; gy < h; gy += 500) {
    gridLines.push({
      id: `${id}-hgrid-${gy}`,
      type: 'line',
      x: x - halfW,
      y: y - halfH + gy,
      width: w,
      height: 0,
      rotation: 0,
      stroke: '#94a3b8',
      strokeWidth: 0.5,
      strokeDasharray: '5,5',
      zIndex: store.getNextZIndex(),
    });
  }
  if (gridLines.length > 0) store.addShapeBatch(gridLines, true);

  return JSON.stringify({
    success: true,
    element: { id, type: 'stage', x, y, width: w, height: h, modules: `${w / 500}x${h / 500}` },
  });
}

function executeAddMarquee(args: any): string {
  const store = useProjectStore.getState();
  const { asset_id, x, y } = args;

  if (!asset_id || x == null || y == null) {
    return JSON.stringify({ success: false, error: 'Missing required parameters: asset_id, x, y' });
  }

  const dims = getAssetDimensions(asset_id);
  const id = `ai-marquee-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  store.addAsset({
    id,
    type: dims.id,
    name: dims.id,
    x,
    y,
    width: dims.width,
    height: dims.height,
    rotation: 0,
    scale: 1,
    zIndex: 0,
    strokeWidth: 0.6,
  }, true);

  return JSON.stringify({
    success: true,
    element: { id, type: dims.id, x, y, width: dims.width, height: dims.height },
  });
}

function executeCreateRoom(args: any): string {
  const store = useProjectStore.getState();
  const { width, height, wall_thickness = 150 } = args;

  if (!width || !height) {
    return JSON.stringify({ success: false, error: 'Missing required parameters: width, height' });
  }

  const cx = (store.canvas?.width || 10000) / 2;
  const cy = (store.canvas?.height || 10000) / 2;
  const halfW = width / 2, halfH = height / 2;

  const wallId = `ai-room-${Date.now()}`;
  const nIds = [`${wallId}-n0`, `${wallId}-n1`, `${wallId}-n2`, `${wallId}-n3`];

  store.addWall({
    id: wallId,
    nodes: [
      { id: nIds[0], x: cx - halfW, y: cy - halfH },
      { id: nIds[1], x: cx + halfW, y: cy - halfH },
      { id: nIds[2], x: cx + halfW, y: cy + halfH },
      { id: nIds[3], x: cx - halfW, y: cy + halfH },
    ],
    edges: [
      { id: `${wallId}-e0`, nodeA: nIds[0], nodeB: nIds[1], thickness: wall_thickness },
      { id: `${wallId}-e1`, nodeA: nIds[1], nodeB: nIds[2], thickness: wall_thickness },
      { id: `${wallId}-e2`, nodeA: nIds[2], nodeB: nIds[3], thickness: wall_thickness },
      { id: `${wallId}-e3`, nodeA: nIds[3], nodeB: nIds[0], thickness: wall_thickness },
    ],
    zIndex: 0,
    isClosed: true,
  }, true);

  return JSON.stringify({
    success: true,
    room: { id: wallId, width, height, cx, cy, interior: { x: cx - halfW, y: cy - halfH } },
  });
}

function executeArrangeTables(args: any): string {
  const store = useProjectStore.getState();
  const { asset_id, count, arrangement, area_x, area_y, area_width, area_height, start_number = 1 } = args;

  if (!asset_id || !count || !arrangement || area_x == null || area_y == null || !area_width || !area_height) {
    return JSON.stringify({ success: false, error: 'Missing required parameters' });
  }

  const dims = getAssetDimensions(asset_id);
  const tableW = dims.width;
  const tableH = dims.height;
  const padding = Math.max(tableW, tableH) * 0.3;

  const positions: { x: number; y: number; tableNum: number }[] = [];

  if (arrangement === 'grid') {
    const cols = Math.ceil(Math.sqrt(count * (area_width / area_height)));
    const rows = Math.ceil(count / cols);
    const spacingX = Math.min((area_width - padding * 2) / Math.max(cols - 1, 1), tableW * 2);
    const spacingY = Math.min((area_height - padding * 2) / Math.max(rows - 1, 1), tableH * 2);
    const startX = area_x - (Math.min(cols, count) - 1) * spacingX / 2;
    const startY = area_y - (Math.min(rows, Math.ceil(count / cols)) - 1) * spacingY / 2;

    let placed = 0;
    for (let row = 0; row < rows && placed < count; row++) {
      const colsInRow = Math.min(cols, count - placed);
      for (let col = 0; col < colsInRow && placed < count; col++) {
        positions.push({
          x: startX + col * spacingX,
          y: startY + row * spacingY,
          tableNum: start_number + placed,
        });
        placed++;
      }
    }
  } else if (arrangement === 'circular') {
    const radius = Math.min(area_width, area_height) / 2 - Math.max(tableW, tableH) / 2;
    for (let i = 0; i < count; i++) {
      const angle = (2 * Math.PI * i) / count - Math.PI / 2;
      positions.push({
        x: area_x + radius * Math.cos(angle),
        y: area_y + radius * Math.sin(angle),
        tableNum: start_number + i,
      });
    }
  } else if (arrangement === 'linear') {
    const spacingX = Math.min((area_width - padding) / count, tableW * 2);
    const startX = area_x - (count - 1) * spacingX / 2;
    for (let i = 0; i < count; i++) {
      positions.push({
        x: startX + i * spacingX,
        y: area_y,
        tableNum: start_number + i,
      });
    }
  } else if (arrangement === 'perimeter') {
    const perimeter = 2 * (area_width + area_height);
    for (let i = 0; i < count; i++) {
      const t = (i / count) * perimeter;
      let px: number, py: number;
      if (t < area_width) {
        px = area_x - area_width / 2 + t;
        py = area_y - area_height / 2;
      } else if (t < area_width + area_height) {
        px = area_x + area_width / 2;
        py = area_y - area_height / 2 + (t - area_width);
      } else if (t < 2 * area_width + area_height) {
        px = area_x + area_width / 2 - (t - area_width - area_height);
        py = area_y + area_height / 2;
      } else {
        px = area_x - area_width / 2;
        py = area_y + area_height / 2 - (t - 2 * area_width - area_height);
      }
      positions.push({ x: px, y: py, tableNum: start_number + i });
    }
  }

  const assets: any[] = positions.map(p => {
    const id = `ai-table-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    return {
      id,
      type: dims.id,
      name: dims.id,
      x: p.x,
      y: p.y,
      width: dims.width,
      height: dims.height,
      rotation: 0,
      scale: 1,
      zIndex: store.getNextZIndex(),
      strokeWidth: 0.6,
      tableName: String(p.tableNum),
      showTableName: true,
    };
  });

  store.addAssetBatch(assets, true);

  return JSON.stringify({
    success: true,
    tables_placed: assets.length,
    arrangement,
    positions: assets.map(a => ({ id: a.id, x: a.x, y: a.y, table: a.tableName })),
  });
}

function executeUpdateElement(args: any): string {
  const store = useProjectStore.getState();
  const { element_id, ...updates } = args;

  if (!element_id) {
    return JSON.stringify({ success: false, error: 'Missing required parameter: element_id' });
  }

  // Find the element across all types
  const shape = store.shapes.find(s => s.id === element_id);
  if (shape) {
    store.updateShape(element_id, updates, true);
    return JSON.stringify({ success: true, element: { id: element_id, type: 'shape', ...updates } });
  }

  const asset = store.assets.find(a => a.id === element_id);
  if (asset) {
    store.updateAsset(element_id, updates, true);
    return JSON.stringify({ success: true, element: { id: element_id, type: 'asset', ...updates } });
  }

  const wall = store.walls.find(w => w.id === element_id);
  if (wall) {
    store.updateWall(element_id, updates, true);
    return JSON.stringify({ success: true, element: { id: element_id, type: 'wall', ...updates } });
  }

  return JSON.stringify({ success: false, error: `Element with id "${element_id}" not found.` });
}

function executeRemoveElement(args: any): string {
  const store = useProjectStore.getState();
  const { element_id } = args;

  if (!element_id) {
    return JSON.stringify({ success: false, error: 'Missing required parameter: element_id' });
  }

  const shape = store.shapes.find(s => s.id === element_id);
  if (shape) { store.removeShape(element_id, true); return JSON.stringify({ success: true, removed: element_id }); }

  const asset = store.assets.find(a => a.id === element_id);
  if (asset) { store.removeAsset(element_id, true); return JSON.stringify({ success: true, removed: element_id }); }

  const wall = store.walls.find(w => w.id === element_id);
  if (wall) { store.removeWall(element_id, true); return JSON.stringify({ success: true, removed: element_id }); }

  return JSON.stringify({ success: false, error: `Element with id "${element_id}" not found.` });
}

function executeClearLayout(): string {
  const store = useProjectStore.getState();
  store.clearWorkspace();
  return JSON.stringify({ success: true, message: 'All elements removed from canvas.' });
}

function executeAddShape(args: any): string {
  const store = useProjectStore.getState();
  const { shape_type, x, y, width, height, fill, stroke, stroke_width, rotation = 0, fill_texture } = args;

  if (!shape_type || x == null || y == null || !width || !height) {
    return JSON.stringify({ success: false, error: 'Missing required parameters' });
  }

  const id = `ai-shape-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const shape: any = {
    id,
    name: shape_type,
    type: shape_type,
    x, y, width, height,
    rotation,
    fill: fill || 'transparent',
    stroke: stroke || '#000000',
    strokeWidth: stroke_width || 2,
    zIndex: store.getNextZIndex(),
  };

  if (fill_texture) {
    shape.fillType = 'texture';
    shape.fillTexture = fill_texture;
  }

  store.addShape(shape, true);
  return JSON.stringify({ success: true, element: { id, type: shape_type, x, y, width, height } });
}

function executeAddTextAnnotation(args: any): string {
  const store = useProjectStore.getState();
  const { text, x, y, font_size = 250, color = '#000000' } = args;

  if (!text || x == null || y == null) {
    return JSON.stringify({ success: false, error: 'Missing required parameters' });
  }

  const id = `ai-text-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  store.addTextAnnotation({
    id,
    text,
    x, y,
    fontSize: font_size,
    fontFamily: 'Arial',
    color,
    rotation: 0,
    zIndex: store.getNextZIndex(),
  }, true);

  return JSON.stringify({ success: true, element: { id, text, x, y } });
}

// ─── Main executor ───────────────────────────────────────────────────────────

export function executeToolCalls(toolCalls: ToolCall[]): ToolResult[] {
  const results: ToolResult[] = [];

  for (const tc of toolCalls) {
    let args: any;
    try {
      args = JSON.parse(tc.function.arguments);
    } catch {
      results.push({
        tool_call_id: tc.id,
        content: JSON.stringify({ success: false, error: `Invalid JSON in arguments: ${tc.function.arguments}` }),
      });
      continue;
    }

    let result: string;
    try {
      switch (tc.function.name) {
        case 'get_current_layout':
          result = executeGetCurrentLayout();
          break;
        case 'add_table':
          result = executeAddTable(args);
          break;
        case 'add_asset':
          result = executeAddAsset(args);
          break;
        case 'add_stage':
          result = executeAddStage(args);
          break;
        case 'add_marquee':
          result = executeAddMarquee(args);
          break;
        case 'create_room':
          result = executeCreateRoom(args);
          break;
        case 'arrange_tables':
          result = executeArrangeTables(args);
          break;
        case 'update_element':
          result = executeUpdateElement(args);
          break;
        case 'remove_element':
          result = executeRemoveElement(args);
          break;
        case 'clear_layout':
          result = executeClearLayout();
          break;
        case 'add_shape':
          result = executeAddShape(args);
          break;
        case 'add_text_annotation':
          result = executeAddTextAnnotation(args);
          break;
        default:
          result = JSON.stringify({ success: false, error: `Unknown tool: ${tc.function.name}` });
      }
    } catch (e: any) {
      result = JSON.stringify({ success: false, error: e?.message || 'Tool execution failed' });
    }

    results.push({ tool_call_id: tc.id, content: result });
  }

  return results;
}
