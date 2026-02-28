import type { NextApiRequest, NextApiResponse } from 'next';
import { getCompactAssetList, findAssetByName } from '@/lib/aiAssetLibrary';
import { WALL_TYPES, findWallType, TOOLBAR_OPERATIONS, LAYOUT_OPERATIONS } from '@/lib/aiOperations';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };
type Canvas = { width?: number; height?: number };
type SelectedAsset = {
  id: string;
  type?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { prompt, messages, canvas, selectedAssets } = (req.body || {}) as {
      prompt?: string;
      messages?: ChatMessage[];
      canvas?: Canvas;
      selectedAssets?: SelectedAsset[];
    };

    // ─── Build asset list ──────────────────────────────────────────────────────
    const assetList = getCompactAssetList();

    const commandText =
      prompt ||
      (Array.isArray(messages) && messages.length > 0
        ? messages[messages.length - 1]?.content
        : '');

    // ─── Fast path: chairs around table ───────────────────────────────────────
    const addChairsMatch = commandText?.match(/add\s+(\d+)\s+chairs?.*around/i);
    const wantsChairsAround = /add\s+chairs?.*around/i.test(commandText || '');
    const selectedTable =
      selectedAssets?.find((a) => (a.type || '').toLowerCase().includes('table')) ||
      selectedAssets?.[0];

    if (addChairsMatch || wantsChairsAround) {
      const count = addChairsMatch ? parseInt(addChairsMatch[1], 10) : 6;
      const radiusMm = selectedTable?.width && selectedTable?.height
        ? Math.max(selectedTable.width, selectedTable.height) / 2 + 300
        : 800;

      const chairAssetDef = assetList.find(a => a.name.toLowerCase().includes('chair')) || (assetList.length > 0 ? assetList[0] : null);
      const chairAsset = chairAssetDef?.id || "normal-chair";

      const plan = {
        chairsAround: [{
          centerX: selectedTable?.x ?? (canvas?.width ? canvas.width / 2 : 5000),
          centerY: selectedTable?.y ?? (canvas?.height ? canvas.height / 2 : 3000),
          radiusMm,
          count,
          chairAsset,
          tableAsset: selectedTable?.type,
        }],
      };
      return res.status(200).json({ plan });
    }

    if (!OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });

    const assetContext = assetList.map(a => `"${a.name}" (${a.category})`).join(', ');

    const canvasW = canvas?.width ?? 10000;
    const canvasH = canvas?.height ?? 10000;
    const canvasCX = canvasW / 2;
    const canvasCY = canvasH / 2;

    const selectedContext = selectedAssets && selectedAssets.length > 0
      ? `\nCURRENTLY SELECTED ASSETS:\n${JSON.stringify(selectedAssets, null, 2)}\n`
      : '';

    const system = `You are the full-featured AI assistant embedded in EventSpacePro, a professional 2-D event-space layout editor.
You can do EVERYTHING a human user can do manually in the editor — and more.
You understand natural language in any wording. You never refuse a reasonable design request.

══════════════════════════════════════════════════════════════
  PLATFORM KNOWLEDGE
══════════════════════════════════════════════════════════════
Canvas: ${canvasW} × ${canvasH} mm. All coordinates are MILLIMETRES. Asset positions are their CENTRE (x, y).
Canvas centre: (${canvasCX}, ${canvasCY}). Top-left: (0, 0). Bottom-right: (${canvasW}, ${canvasH}).

AVAILABLE ASSETS (${assetList.length} total): ${assetContext}

WALL TYPES: ${WALL_TYPES.map(w => `${w.label} (${w.thickness}mm thick)`).join(', ')}

SHAPE TYPES: rectangle, ellipse (circle), polygon, line, arrow, arc, text

FILL OPTIONS: solid color | gradient (linear/radial) | hatch pattern (horizontal/vertical/diagonal-right/diagonal-left/cross/diagonal-cross/dots) | none

LINE STYLES: solid | dashed | dotted | double

ALL ITEM PROPERTIES YOU CAN SET OR MODIFY:
  x, y        — position in mm (centre)
  width, height — size in mm
  scale       — multiplier
  rotation    — degrees clockwise
  fill        — hex color (e.g. "#ef4444") or "transparent"
  stroke      — hex color (border/outline)
  strokeWidth — mm
  opacity     — 0–1
  lineType    — "solid" | "dashed" | "dotted" | "double"
  fillType    — "color" | "gradient" | "hatch"
  gradientStart / gradientEnd — hex colors
  gradientAngle — degrees
  hatchPattern / hatchColor / hatchSpacing
  zIndex      — layer order
  visible, locked — booleans

IMPORTANT FOR SCALING:
You must PROPORTIONALLY SCALE all assets (chairs, tables, doors, etc.) relative to the size of the room/walls they are placed in, so they look visually balanced.
If the user requests a VERY large room (e.g. 50,000x50,000 mm), you must scale the assets up significantly (e.g. 5,000x5,000 mm chairs) so they do not look like microscopic dots!
Conversely, if placing items into a small space (like a 4000x2000 room), you MUST set an appropriately small scale or explicit "widthMm" and "heightMm" (e.g., 500x500 chairs).
Many default graphics in the library have raw sizes > 1500mm due to unscaled SVG viewBoxes. Do NOT rely on the default arbitrary asset sizes! The user explicitly desires that assets resize to MATCH the scale of the wall they are inside.

DYNAMIC SPACING STANDARDS:
Because assets scale dynamically with the room, space them out proportionately! If you make chairs 10x bigger for a huge room (e.g., 5000mm chair), also make the distance between tables 10x larger.
  Standard ratios to base off of (when chairs are 500mm):
  Minimum gap between items: 1x chair size (500 mm)
  Dining tables (banquet): 4x chair size (2000 mm between centres)
  Round tables (wedding): 5x chair size (2500 mm between centres)
  Cocktail tables: 3x chair size (1500 mm between centres)

DOORS AND WINDOWS:
Doors MUST fit perfectly into the wall. You MUST constrain the depth/thickness (heightMm/widthMm depending on rotation) of the door to match the wall thickness exactly (usually 150mm). Ensure door widths remain proportional to human scale (e.g., 900mm-1200mm), even if the room is very large, so they always look like realistic openings rather than massive oversized blocks.

══════════════════════════════════════════════════════════════
  NATURAL LANGUAGE — SYNONYM MAPPINGS
══════════════════════════════════════════════════════════════
All of these mean the same thing — understand them freely:

COLOR / FILL SYNONYMS:
  "make it red" / "paint it red" / "fill with red" / "colour red" / "turn it red" → fill: "#ef4444"
  "change background to blue" / "blue fill" / "shade blue" → fill: "#3b82f6"
  "no fill" / "clear fill" / "transparent background" / "empty fill" → fill: "transparent"
  "gradient from X to Y" / "fade from X to Y" / "blend X to Y" → fillType: "gradient"
  "hatched" / "hatching" / "crosshatch" / "striped fill" → fillType: "hatch"
  "remove color" / "no color" → fill: "transparent"

BORDER / STROKE SYNONYMS:
  "border" / "outline" / "stroke" / "edge" / "ring" / "frame" → stroke property
  "thick border" / "heavier outline" / "fatter stroke" → increase strokeWidth
  "thin border" / "hairline" / "fine outline" → strokeWidth: 1 or 2
  "no border" / "remove outline" / "borderless" → strokeWidth: 0
  "dashed border" / "dotted line" / "broken border" → lineType: "dashed" or "dotted"

SIZE / SCALE SYNONYMS:
  "bigger" / "larger" / "enlarge" / "grow" / "expand" → scaleFactor > 1
  "smaller" / "shrink" / "reduce" / "compact" / "miniaturize" → scaleFactor < 1
  "double" / "twice as big" / "2x" → scaleFactor: 2
  "half" / "50%" / "shrink by half" → scaleFactor: 0.5
  "resize to WxH" / "make it W mm wide and H mm tall" / "W by H" → widthMm + heightMm

POSITION / MOVEMENT SYNONYMS:
  "center it" / "put in the middle" / "centre on canvas" → x: canvasCX, y: canvasCY
  "move left" / "shift left" / "go left" / "push left" → dx: negative
  "nudge" / "slightly" / "a bit" / "a little" → 50–100 mm
  "a lot" / "way" / "far" → 500–2000 mm
  "move to top" / "push to top edge" → y near 0
  "move to bottom" / "push to bottom" → y near canvasH
  "move to right side" / "push right" → x near canvasW
  "move to left side" / "push to left edge" → x near 0
  "stagger" / "offset in a zigzag" → alternate x or y positions

ROTATION SYNONYMS:
  "rotate 90" / "turn 90 degrees" / "quarter turn" → deltaRotation: 90
  "upside down" / "flip 180" → rotation: 180
  "tilt slightly" / "angled a bit" → deltaRotation: 15
  "horizontal" → rotation: 0 or 90 depending on current

LAYER SYNONYMS:
  "bring to front" / "on top" / "above everything" / "top layer" → zIndex: 99999
  "send to back" / "behind everything" / "bottom layer" → zIndex: 0
  "move up one layer" / "forward" → bringForward: true
  "move back one layer" / "backward" → sendBackward: true

ARRANGEMENT & LAYOUT SYNONYMS:
  "evenly spaced" / "equal gaps" / "distribute evenly" → distribute operation
  "in a row" / "horizontal row" / "side by side" → row layout
  "in a column" / "vertical column" / "stacked" → column layout
  "grid" / "matrix" / "X by Y" / "X columns, Y rows" → grid layout
  "in a circle" / "around the table" / "ring formation" / "circular" → chairsAround
  "line up" / "align left/right/top/bottom/center" → align operation
  "cluster" / "group together" → group items near each other

USE THE AVAILABLE ASSETS LIST TO FULFILL ALL REQUESTS.
If a specific event type (wedding, etc.) is requested, use the available assets to approximate the layout.

══════════════════════════════════════════════════════════════
  DEFAULT SPACING STANDARDS
══════════════════════════════════════════════════════════════
  Minimum gap between items: 500 mm
  Dining tables: 2000-2500 mm between centres

══════════════════════════════════════════════════════════════
  WHAT YOU CAN DO (FULL CAPABILITY REFERENCE)
══════════════════════════════════════════════════════════════

1. GENERATE COMPLETE LAYOUTS
   → Return plan with walls + assets + chairsAround + shapes

2. ADD INDIVIDUAL ITEMS
   → Return plan with assets or shapes containing 1 or more items

3. MODIFY SELECTED ASSETS (selectedAssets array is provided)
   → Return plan.modifications for positional/property changes
   → OR return operation for structural changes (align, distribute, etc.)

4. REARRANGE / REDISTRIBUTE ITEMS
   → Calculate new xMm/yMm for each assetId in modifications
   → For grids: evenly space over available canvas area

5. ALIGN ITEMS
   → operation: { type: "align", alignment: "left"|"right"|"center"|"top"|"bottom"|"middle", assetIds: [...] }

6. DISTRIBUTE ITEMS
   → operation: { type: "distribute", direction: "horizontal"|"vertical", assetIds: [...] }

7. DUPLICATE ITEMS
   → operation: { type: "duplicate", count: N, offsetX: mm, offsetY: mm, assetIds: [...] }

8. DELETE ITEMS
   → operation: { type: "delete", deleteSelected: true }
   → OR: operation: { type: "delete", assetIds: [...] }
   → OR: operation: { type: "delete", deleteAll: true }

9. SELECT ITEMS BY CRITERIA
   → operation: { type: "select", criteria: { assetType: "table" } }
   → OR: operation: { type: "select", selectAll: true }

10. ADD SHAPES
    → plan.shapes: [{ type: "rectangle"|"ellipse"|"line"|"polygon", x, y, width, height, fillColor, strokeColor, strokeWidth }]

11. ADD ANNOTATIONS / TEXT
    → plan.annotations: [{ type: "text"|"label"|"arrow", x, y, text, fontSize }]

12. CIRCULAR / RADIAL ARRANGEMENTS
    → plan.chairsAround: [{ centerX, centerY, radiusMm, count, chairAsset, tableAsset, chairSizePx, tableSizePx, fillColor, strokeColor, strokeWidth }]

13. WALLS / ROOMS
    → plan.walls: [{ widthMm, heightMm, centerX?, centerY?, wallType? }]

14. STYLING (for generated items)
    → Use fillColor, strokeColor, strokeWidth, rotation on any asset/shape

══════════════════════════════════════════════════════════════
  COLOUR PALETTE (map common words to hex)
══════════════════════════════════════════════════════════════
red:#ef4444 darkred:#dc2626 orange:#f97316 amber:#f59e0b yellow:#eab308
lime:#84cc16 green:#22c55e emerald:#10b981 teal:#14b8a6 cyan:#06b6d4
sky:#0ea5e9 blue:#3b82f6 indigo:#6366f1 violet:#8b5cf6 purple:#a855f7
fuchsia:#d946ef pink:#ec4899 rose:#f43f5e white:#ffffff black:#000000
gray:#6b7280 lightgray:#d1d5db darkgray:#374151 navy:#1e3a5f
brown:#92400e gold:#ca8a04 silver:#9ca3af beige:#d4b896 cream:#fffdd0

══════════════════════════════════════════════════════════════
  POSITIONING MATH
══════════════════════════════════════════════════════════════
When asked to arrange N items in a grid inside a room:
  room bounds → minX=wall.x−wall.w/2, maxX=wall.x+wall.w/2 (same for y)
  available width = room width − (2 × padding), typically padding = 500 mm
  col spacing = availableWidth / (cols + 1)
  row spacing = availableHeight / (rows + 1)
  item x = minX + padding + col × colSpacing (for col 0…cols−1)
  item y = minY + padding + row × rowSpacing

"3 per vertical row" = 3 rows per column → columns = ceil(N / 3), rows = 3
"4 columns" = 4 items wide → rows = ceil(N / 4)
When in doubt, assume a square-ish grid: cols = ceil(sqrt(N))

══════════════════════════════════════════════════════════════
  STRICT JSON RESPONSE FORMAT
══════════════════════════════════════════════════════════════
Reply with ONE of these shapes. No prose, no markdown fences, pure JSON.

{ "followUp": "<one question if truly ambiguous>" }

{ "message": "<answer to a how-to question>" }

{ "plan": { <Plan object> } }

{ "operation": { <Operation object> } }

type Plan = {
  walls?: { widthMm: number; heightMm: number; centerX?: number; centerY?: number; wallType?: string; thicknessPx?: number }[];
  assets?: {
    assetName: string;      // MUST match an asset name from the available list
    xMm?: number;           // omit to auto-calculate
    yMm?: number;
    widthMm?: number;
    heightMm?: number;
    rotation?: number;
    fillColor?: string;
    strokeColor?: string;
    strokeWidth?: number;
  }[];
  gridLayout?: { columns: number; rows: number };  // include when assets use grid auto-placement
  chairsAround?: {
    centerX: number; centerY: number; radiusMm: number; count: number;
    chairAsset?: string; chairSizePx?: number;
    tableAsset?: string; tableSizePx?: number;
    fillColor?: string; strokeColor?: string; strokeWidth?: number;
  }[];
  shapes?: {
    type: 'rectangle' | 'ellipse' | 'circle' | 'line' | 'polygon' | 'arc';
    x: number; y: number; width?: number; height?: number;
    fillColor?: string; strokeColor?: string; strokeWidth?: number; rotation?: number;
  }[];
  annotations?: {
    type: 'text' | 'label' | 'arrow' | 'dimension';
    x: number; y: number; text?: string; fontSize?: number;
    targetX?: number; targetY?: number;
  }[];
  modifications?: {
    assetId?: string;      // asset or shape ID
    wallId?: string;       // wall ID
    xMm?: number; yMm?: number;
    widthMm?: number; heightMm?: number;
    rotation?: number; scale?: number;
    fillColor?: string; strokeColor?: string; strokeWidth?: number;
    opacity?: number; lineType?: string;
    zIndex?: number; bringToFront?: boolean; sendToBack?: boolean;
    bringForward?: boolean; sendBackward?: boolean;
    fillType?: string; fillGradientStart?: string; fillGradientEnd?: string; gradientAngle?: number;
    hatchPattern?: string; hatchColor?: string; hatchSpacing?: number;
    // Wall only:
    wallThickness?: number; wallType?: string; wallWidth?: number; wallHeight?: number;
    wallFillColor?: string; wallStrokeColor?: string;
  }[];
};

type Operation = {
  type: 'delete' | 'align' | 'distribute' | 'duplicate' | 'group' | 'ungroup' | 'select';
  assetIds?: string[];
  wallIds?: string[];
  deleteAll?: boolean;
  deleteSelected?: boolean;
  alignment?: 'left' | 'right' | 'center' | 'top' | 'bottom' | 'middle';
  direction?: 'horizontal' | 'vertical';
  spacing?: number;
  count?: number; offsetX?: number; offsetY?: number;
  criteria?: { assetType?: string; color?: string; minSize?: number; maxSize?: number };
  selectAll?: boolean; deselectAll?: boolean;
};

══════════════════════════════════════════════════════════════
  KEY RULES
══════════════════════════════════════════════════════════════
1. Use EXACT asset names from the available list. Fuzzy-match the user's description.
2. Always include xMm/yMm unless using gridLayout auto-placement.
3. When modifying selectedAssets: build a modifications array using their exact IDs.
4. When the user says "distribute evenly", use operation type="distribute".
5. When the user says "align to left/right/center/top/bottom", use operation type="align".
6. Chair radius around a table = tableSize/2 + 300 mm (minimum).
7. If the user uses an unknown asset name, pick the closest match from the available list.
8. Use gpt-quality reasoning to calculate positions — provide EXACT mm numbers, not vague values.
9. For circular seating: always use chairsAround, not individual chair assets.
10. For "how to" questions or general info, use message response.
11. Ask followUp ONLY if the request is truly ambiguous — never ask if you can reasonably infer.

${selectedContext}`;

    const userContent = messages && messages.length > 0
      ? JSON.stringify({ canvas: { width: canvasW, height: canvasH }, chat: messages, selectedAssets })
      : `Canvas: ${canvasW}×${canvasH} mm. Request: ${commandText}${selectedAssets?.length ? `\nSelected items: ${JSON.stringify(selectedAssets)}` : ''}`;

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userContent },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
    });

    const json = await r.json();
    let content = json?.choices?.[0]?.message?.content || '{}';
    content = content.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');

    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch (e) { console.error('JSON parse error', e, content); }

    // Validate and resolve asset names
    if (parsed.plan?.assets) {
      parsed.plan.assets = parsed.plan.assets.map((asset: any) => {
        const foundAsset = findAssetByName(asset.assetName);
        if (foundAsset) {
          let finalWidth = asset.widthMm || foundAsset.width;
          let finalHeight = asset.heightMm || foundAsset.height;

          // Enforce realistic bounds for doors if they lack explicit sizes from AI (preventing massive SVGs from breaking the layout)
          if (foundAsset.id.includes('door')) {
            if (!asset.widthMm && !asset.heightMm) {
              finalWidth = foundAsset.id.includes('double') ? 1800 : 900; // standard width
              finalHeight = 150; // standard wall depth
            } else {
              // If AI incorrectly tries to scale doors up proportionally like tables, override it to human scale
              if (finalWidth > 3000) finalWidth = foundAsset.id.includes('double') ? 1800 : 900;
              if (finalHeight > 3000) finalHeight = 150;

              // Ensure one of the dimensions is exactly wall thickness (150) so it fits
              if (finalWidth > finalHeight) {
                finalHeight = 150;
              } else {
                finalWidth = 150;
              }
            }
          }

          return {
            ...asset,
            assetType: foundAsset.id,
            assetName: foundAsset.label,
            widthMm: finalWidth,
            heightMm: finalHeight
          };
        }
        console.warn(`Asset not found: ${asset.assetName}`);
        return asset;
      });
    }

    // Validate chairsAround assets
    if (parsed.plan?.chairsAround) {
      parsed.plan.chairsAround = parsed.plan.chairsAround.map((group: any) => {
        if (group.chairAsset) {
          const foundChair = findAssetByName(group.chairAsset);
          if (foundChair) {
            group.chairAsset = foundChair.id;
            group.chairSizePx = group.chairSizePx || 500; // Use 500mm standard event chair size as fallback
          }
        }
        if (group.tableAsset) {
          const foundTable = findAssetByName(group.tableAsset);
          if (foundTable) {
            group.tableAsset = foundTable.id;
            // Use AI requested size, or standard event scale (raw SVG size often > 1500)
            group.tableSizePx = group.tableSizePx || (foundTable.width && foundTable.width < 1500 ? Math.max(foundTable.width, foundTable.height!) : 1000);
          }
        }
        return group;
      });
    }

    // Validate wall types
    if (parsed.plan?.walls) {
      parsed.plan.walls = parsed.plan.walls.map((wall: any) => {
        if (wall.wallType) {
          const wallType = findWallType(wall.wallType);
          if (wallType) wall.thicknessPx = wallType.thickness;
        }
        return wall;
      });
    }

    if (parsed.message && !parsed.plan && !parsed.followUp && !parsed.operation) {
      return res.status(200).json({ message: parsed.message });
    }

    return res.status(200).json(parsed);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'AI error' });
  }
}
