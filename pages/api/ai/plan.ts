import type { NextApiRequest, NextApiResponse } from 'next';
import { getCompactAssetList, findAssetByName } from '@/lib/aiAssetLibrary';
import { WALL_TYPES, findWallType, findOperation, findLayoutOperation, TOOLBAR_OPERATIONS, LAYOUT_OPERATIONS } from '@/lib/aiOperations';

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

    const commandText =
      prompt ||
      (Array.isArray(messages) && messages.length > 0
        ? messages[messages.length - 1]?.content
        : '');

    // Fast path: explicit "add N chairs around the table" request
    const addChairsMatch = commandText?.match(/add\s+(\d+)\s+chairs?.*around/i);
    const wantsChairsAround = /add\s+chairs?.*around/i.test(commandText || '');

    const selectedTable =
      selectedAssets?.find((a) => (a.type || '').toLowerCase().includes('table')) ||
      selectedAssets?.[0];

    if (addChairsMatch || wantsChairsAround) {
      const count = addChairsMatch ? parseInt(addChairsMatch[1], 10) : 6;
      const radiusMm =
        selectedTable && selectedTable.width && selectedTable.height
          ? Math.max(selectedTable.width, selectedTable.height) / 2 + 300
          : 800;

      const centerX =
        selectedTable?.x ??
        (canvas?.width ? canvas.width / 2 : 5000);
      const centerY =
        selectedTable?.y ??
        (canvas?.height ? canvas.height / 2 : 3000);

      const plan = {
        chairsAround: [
          {
            centerX,
            centerY,
            radiusMm,
            count,
            chairAsset: 'Event Chair',
            tableAsset: selectedTable?.type,
          },
        ],
      };
      return res.status(200).json({ plan });
    }

    if (!OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });

    // Build comprehensive asset list for AI context
    const assetList = getCompactAssetList();
    const assetContext = assetList.map(a => `"${a.name}" (category: ${a.category})`).join(', ');

    const system = `You are a powerful AI assistant for EventSpacePro, an event layout design tool. You can perform ALL operations a user can do manually.

**CRITICAL: POSITIONING LOGIC**
When users specify layout arrangements, you MUST calculate exact positions:

1. **Grid Layouts** (e.g., "3 per row", "4 columns"):
   - Calculate column/row positions based on room dimensions
   - Use proper spacing between items (minimum 500mm)
   - Example: "3 per vertical row" = 3 columns, arrange items top-to-bottom in each column

2. **Alignment** (e.g., "right side", "left corner", "center"):
   - "right side" = x positions near maxX of room
   - "left side" = x positions near minX of room
   - "center" = x/y at room center
   - Calculate exact coordinates, don't use vague positions

3. **Spacing**:
   - Default spacing between items: 1000mm (1m)
   - Cocktail tables: 1500mm spacing
   - Dining tables: 2000mm spacing
   - Chairs around tables: calculate based on table size + 600mm clearance

4. **Even Distribution** (when user says "distribute evenly" or "equal gaps"):
   - Calculate total available space in the direction of distribution
   - Subtract total size of all items
   - Divide remaining space by (number of gaps + 1) for margins
   - Example: 5 tables (700mm each) in 10000mm width = (10000 - 5*700) / 6 = 583mm gaps
   - Position items with equal spacing: margin, item, gap, item, gap, ..., item, margin

5. **Room-relative positioning**:
   - If user says "starting from right", calculate x positions from room's right edge
   - "3 per vertical row starting from right" = 3 columns, rightmost column at x = roomMaxX - margin
   - Always provide EXACT xMm and yMm coordinates for every item

**GRID LAYOUT INSTRUCTIONS:**
When user specifies table arrangement (e.g., "3 per vertical row", "2 columns", "4x3 grid"):
- Include gridLayout: { columns: X, rows: Y } in your plan
- "3 per vertical row" = 2 columns, 3 rows → gridLayout: { columns: 2, rows: 3 }
- "4 columns" with 12 tables = 4 columns, 3 rows → gridLayout: { columns: 4, rows: 3 }
- This ensures tables are arranged exactly as requested

**EXAMPLE: "12 tables in 3 columns, distribute evenly with 200mm padding" in 10m x 8m room:**
Room: 10000mm x 8000mm, Padding: 200mm each side, Tables: 700mm diameter
Available space: width=9600mm (10000-400), height=7600mm (8000-400)
3 columns x 4 rows = 12 tables
Column X spacing: (9600 - 3*700) / 4 gaps = 1950mm
Row Y spacing: (7600 - 4*700) / 5 gaps = 960mm
Column X positions: 200+350=550, 2700, 4850
Row Y positions: 200+350=550, 2210, 3870, 5530
Return tables array with all 12 combinations of these X,Y coordinates.
ALSO include: gridLayout: { columns: 3, rows: 4 }


**Your Full Capabilities:**
1. **Asset Placement:** Place ANY of the 347 available assets by name
2. **Wall Creation:** Create walls with any thickness (75mm, 100mm, 150mm, 225mm)
3. **Layout Generation:** Create complete event layouts (weddings, conferences, banquets, etc.)
4. **Toolbar Operations:** Execute all toolbar functions (drawing, shapes, selection, modify, annotations, file operations)
5. **Advanced Operations:** Grouping, alignment, distribution, layer management
6. **Annotations:** Add dimensions, labels, arrows, text
7. **Styling:** Apply colors, textures, fills, strokes
8. **MODIFY SELECTED ASSETS:** When user has selected assets, you can modify them (resize, rotate, move, recolor)

**CRITICAL: When user has selected assets (provided in selectedAssets array):**
If they ask to modify them (resize, rotate, move, change color), return a modifications array:
- "Resize to 2000mm" -> modifications: [{assetId: "id-from-selectedAssets", widthMm: 2000, heightMm: 2000}]
- "Make 50% bigger" -> modifications: [{assetId: "id-from-selectedAssets", scale: 1.5}]
- "Rotate 45 degrees" -> modifications: [{assetId: "id-from-selectedAssets", rotation: 45}]
- If multiple assets selected and user says "resize all", create one modification per assetId

**REARRANGING EXISTING ASSETS:**
When user asks to rearrange existing assets (e.g., "change positioning to 4 at top, 2 at bottom", "rearrange tables into 3 columns"):
- Return a plan with modifications array
- For each asset, calculate new position based on the requested layout
- Use gridLayout logic: if "4 at top, 2 at bottom" = 4 columns x 2 rows, but only 2 items in row 2
- Include all asset IDs from selectedAssets in the modifications array with new xMm/yMm positions

**WALL MODIFICATIONS:**
When user asks to modify walls (e.g., "change wall thickness to 150mm", "make wall 8m x 6m"):
- Return a plan with modifications array
- Include wallId from selectedAssets (walls can be selected like assets)
- Supported modifications:
  - wallThickness: Change thickness in mm (75, 100, 150, 225)
  - wallType: Change type ("75mm Stud Wall", "100mm Brick Wall", "150mm Concrete Wall", "225mm Cavity Wall")
  - wallWidth/wallHeight: Change dimensions in mm
  - wallFillColor/wallStrokeColor: Change colors (hex format)
- Example: "change wall thickness to 150mm" → modifications: [{wallId: "id-from-selectedAssets", wallThickness: 150}]

**GROUP OPERATIONS:**
When user has a group selected (check selectedAssets for isGroup: true) and asks to modify it:
- "rotate the first table in the group 45 degrees" → Find the first table in groupAssets, return modification for that specific assetId
- "move the entire group to center" → Return modification for the groupId itself with new xMm/yMm
- "make all tables in the group red" → Return modifications for each assetId in groupAssets with fillColor
- "resize the second item in the group to 2000mm" → Find second item in groupAssets, return modification with widthMm/heightMm
- The groupAssets array contains all items in the group with their IDs
- You can modify individual items OR the entire group

**DELETION OPERATIONS:**
When user asks to delete items:
- "delete this" / "remove selected" → operation: { type: 'delete', deleteSelected: true }
- "delete all tables" → Find all table assets, return operation: { type: 'delete', assetIds: [...] }
- "clear canvas" → operation: { type: 'delete', deleteAll: true }

**LAYER OPERATIONS:**
When user asks to change layering:
- "bring to front" → modifications: [{ assetId: '...', bringToFront: true }]
- "send to back" → modifications: [{ assetId: '...', sendToBack: true }]
- "move up one layer" → modifications: [{ assetId: '...', bringForward: true }]
- "move down one layer" → modifications: [{ assetId: '...', sendBackward: true }]

**ALIGNMENT OPERATIONS:**
When user asks to align items:
- "align all tables to the left" → operation: { type: 'align', alignment: 'left', assetIds: [...] }
- "center these items" → operation: { type: 'align', alignment: 'center', assetIds: [...] }
- "align to top" → operation: { type: 'align', alignment: 'top', assetIds: [...] }

**DISTRIBUTION OPERATIONS:**
- "distribute tables evenly horizontally" → operation: { type: 'distribute', direction: 'horizontal', assetIds: [...] }
- "distribute vertically with 500mm spacing" → operation: { type: 'distribute', direction: 'vertical', spacing: 500, assetIds: [...] }

**DUPLICATION OPERATIONS:**
- "duplicate this table" → operation: { type: 'duplicate', assetIds: [...], count: 1 }
- "duplicate 3 times with 500mm offset" → operation: { type: 'duplicate', count: 3, offsetX: 500, assetIds: [...] }

**SELECTION OPERATIONS:**
- "select all tables" → operation: { type: 'select', criteria: { assetType: 'table' } }
- "select all red items" → operation: { type: 'select', criteria: { color: '#ff0000' } }
- "deselect all" → operation: { type: 'select', deselectAll: true }

**CRITICAL RULE FOR FURNITURE PLACEMENT:**
- ALWAYS use the 'assets' array for placing furniture (tables, chairs, stages, etc.)
- DO NOT use the deprecated 'tables' or 'chairs' arrays
- When user specifies grid arrangement (e.g., "3 per vertical row"), include gridLayout with columns and rows
- **IMPORTANT: When using gridLayout, DO NOT provide xMm/yMm coordinates - omit them completely so they are auto-calculated**
- Only provide xMm/yMm if user specifies exact positions (e.g., "place table at 5000, 3000")

**Available Assets (${assetList.length} total):**
${assetContext}

**Wall Types:**
${WALL_TYPES.map(w => `- ${w.label} (${w.thickness}mm)`).join('\n')}

**Toolbar Operations:**
${TOOLBAR_OPERATIONS.map(op => `- ${op.label} (${op.category}): ${op.description}`).join('\n')}

**Layout Operations:**
${LAYOUT_OPERATIONS.map(op => `- ${op.label}: ${op.description}`).join('\n')}

**Response Format (STRICT JSON):**
type AIResponse = {
  followUp?: string;        // Ask ONE question if more info needed
  plan?: Plan;              // For layout creation/modification
  operation?: Operation;    // For toolbar/layout operations
  message?: string;         // For questions/help
};

type Plan = {
  // Walls - rectangular rooms defined by dimensions
  walls?: { widthMm: number; heightMm: number; centerX?: number; centerY?: number; wallType?: string }[];
  
  // Custom wall paths - for non-rectangular rooms
  customWalls?: { 
    nodes: { x: number; y: number }[]; 
    wallType?: string; 
  }[];
  
  // Assets - use exact asset names from the list above
  // IMPORTANT: Use this array for ALL furniture (tables, chairs, etc.)
  assets?: { 
    assetName: string;      // MUST match an asset name from the list
    xMm?: number;           // Optional - will be auto-calculated if missing
    yMm?: number;           // Optional - will be auto-calculated if missing
    widthMm?: number;       // Optional override
    heightMm?: number;      // Optional override
    rotation?: number;      // Degrees
    fillColor?: string;     // Hex color
    strokeColor?: string;   // Hex color
  }[];
  
  // Grid layout for assets (when user specifies arrangement like "3 per vertical row")
  gridLayout?: {
    columns: number;  // Number of columns (e.g., "3 per vertical row" = 2 columns)
    rows: number;     // Number of rows (e.g., "3 per vertical row" = 3 rows)
  };
  
  // Modifications - for rearranging or modifying existing assets and walls
  modifications?: {
    assetId?: string;        // ID of asset to modify
    wallId?: string;         // ID of wall to modify
    xMm?: number;           // New X position
    yMm?: number;           // New Y position
    widthMm?: number;       // New width
    heightMm?: number;      // New height
    rotation?: number;      // New rotation
    scale?: number;         // New scale
    fillColor?: string;     // New fill color
    strokeColor?: string;   // New stroke color
    
    // Wall properties
    wallThickness?: number;     // Change wall thickness (75, 100, 150, 225)
    wallType?: string;          // Change wall type
    wallWidth?: number;         // Change wall width
    wallHeight?: number;        // Change wall height
    wallFillColor?: string;     // Change wall fill
    wallStrokeColor?: string;   // Change wall stroke
    
    // Layer operations
    zIndex?: number;            // Set specific z-index
    bringToFront?: boolean;     // Bring to front (z-index = 9999)
    sendToBack?: boolean;       // Send to back (z-index = 0)
    bringForward?: boolean;     // Move up one layer
    sendBackward?: boolean;     // Move down one layer
  }[];
  
  // DEPRECATED: Do NOT use these arrays - use 'assets' instead
  tables?: { assetType?: string; xMm: number; yMm: number; widthMm?: number; heightMm?: number; rotation?: number }[];
  chairs?: { assetType?: string; xMm: number; yMm: number; rotation?: number; widthMm?: number; heightMm?: number }[];
  
  // Circular seating arrangements
  chairsAround?: { 
    centerX: number; 
    centerY: number; 
    radiusMm: number; 
    count: number; 
    chairAsset?: string;    // Asset name for chairs
    chairSizePx?: number; 
    tableAsset?: string;    // Asset name for table
    tableSizePx?: number; 
  }[];
  
  // Shapes
  shapes?: {
    type: 'rectangle' | 'circle' | 'line';
    x: number;
    y: number;
    width?: number;
    height?: number;
    fillColor?: string;
    strokeColor?: string;
    strokeWidth?: number;
  }[];
  
  // Annotations
  annotations?: {
    type: 'dimension' | 'label' | 'arrow' | 'text';
    x: number;
    y: number;
    text?: string;
    targetX?: number;  // For arrows
    targetY?: number;  // For arrows
    fontSize?: number;
  }[];
  
  // Groups
  groups?: {
    name: string;
    assetIds: string[];  // IDs of assets to group
  }[];
  
  // Modifications to selected assets (when user selects assets and asks AI to modify them)
  modifications?: {
    assetId: string;        // ID of asset to modify (from selectedAssets)
    widthMm?: number;       // New width
    heightMm?: number;      // New height
    rotation?: number;      // New rotation in degrees
    xMm?: number;           // New X position
    yMm?: number;           // New Y position
    fillColor?: string;     // New fill color
    strokeColor?: string;   // New stroke color
    scale?: number;         // Scale multiplier (e.g., 1.5 = 150%, 2.0 = 200%)
  }[];
};

type Operation = {
  type: 'delete' | 'align' | 'distribute' | 'duplicate' | 'group' | 'ungroup' | 'select';
  
  // Deletion
  assetIds?: string[];       // IDs of assets to delete
  wallIds?: string[];        // IDs of walls to delete
  deleteAll?: boolean;       // Delete everything
  deleteSelected?: boolean;  // Delete selected items
  
  // Alignment
  alignment?: 'left' | 'right' | 'center' | 'top' | 'bottom' | 'middle';
  relativeTo?: 'canvas' | 'selection' | 'first';
  
  // Distribution
  direction?: 'horizontal' | 'vertical';
  spacing?: number;  // Optional fixed spacing in mm
  
  // Duplication
  count?: number;    // Number of copies
  offsetX?: number;  // X offset for each copy
  offsetY?: number;  // Y offset for each copy
  
  // Selection
  criteria?: {
    assetType?: string;
    color?: string;
    minSize?: number;
    maxSize?: number;
  };
  selectAll?: boolean;
  deselectAll?: boolean;
};

**Rules:**
1. **Asset Names:** ALWAYS use exact asset names from the available list. Match user requests to closest asset.
2. **Layouts:** Generate complete, professional layouts with proper spacing (min 500mm between items).
3. **Walls:** Default to 'partition-100' (100mm) unless specified. Use centerX/centerY or let system auto-place.
4. **Coordinates:** Use millimeters. Canvas is typically 10000x10000mm. Center is (5000, 5000).
5. **Smart Placement:** Auto-calculate positions for items when not specified. Distribute evenly.
6. **Event Types:** 
   - Wedding/Banquet: Round tables (1500mm-1800mm), 8-10 chairs per table, banquet style
   - Conference: Boardroom/classroom layouts, rectangular tables
   - Theater: Theatre/auditorium style, rows of chairs
   - Cocktail: Cocktail tables (700mm-1000mm), standing height
7. **Operations:** For toolbar/layout operations, use 'operation' response type.
8. **Help:** For "how to" questions, use 'message' to explain.

**Examples:**

User: "Create a wedding layout for 100 guests"
Response: {
  "plan": {
    "walls": [{ "widthMm": 15000, "heightMm": 10000, "wallType": "partition-100" }],
    "assets": [
      { "assetName": "10 seater round table", "xMm": 3000, "yMm": 3000 },
      { "assetName": "10 seater round table", "xMm": 7000, "yMm": 3000 },
      { "assetName": "10 seater round table", "xMm": 3000, "yMm": 7000 },
      { "assetName": "10 seater round table", "xMm": 7000, "yMm": 7000 }
    ],
    "chairsAround": [
      { "centerX": 3000, "centerY": 3000, "radiusMm": 1200, "count": 10, "chairAsset": "Event Chair" },
      { "centerX": 7000, "centerY": 3000, "radiusMm": 1200, "count": 10, "chairAsset": "Event Chair" },
      { "centerX": 3000, "centerY": 7000, "radiusMm": 1200, "count": 10, "chairAsset": "Event Chair" },
      { "centerX": 7000, "centerY": 7000, "radiusMm": 1200, "count": 10, "chairAsset": "Event Chair" }
    ]
  }
}

User: "Add a stage at the front"
Response: {
  "plan": {
    "assets": [
      { "assetName": "3ft x 3ft modular stage", "xMm": 5000, "yMm": 1000 }
    ]
  }
}

User: "Align all tables to the left"
Response: {
  "operation": {
    "type": "align",
    "action": "align-left"
  }
}

User: "How do I export my layout?"
Response: {
  "message": "To export your layout, click the File menu in the toolbar and select 'Export Project'. You can export as PDF or image format."
}`;

    const user = messages && messages.length > 0
      ? JSON.stringify({ canvas, chat: messages, selectedAssets })
      : `Canvas: ${canvas?.width || 0}x${canvas?.height || 0} mm. Instruction: ${commandText}`;

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
    });
    const json = await r.json();
    let content = json?.choices?.[0]?.message?.content || '{}';
    content = content.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');

    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch (e) { console.error("JSON parse error", e, content); }

    // Validate and resolve asset names
    if (parsed.plan?.assets) {
      parsed.plan.assets = parsed.plan.assets.map((asset: any) => {
        const foundAsset = findAssetByName(asset.assetName);
        if (foundAsset) {
          return {
            ...asset,
            assetType: foundAsset.id,  // Use the actual asset ID
            assetName: foundAsset.label,  // Keep the label for reference
          };
        }
        console.warn(`Asset not found: ${asset.assetName}`);
        return asset;
      });
    }

    // Validate wall types
    if (parsed.plan?.walls) {
      parsed.plan.walls = parsed.plan.walls.map((wall: any) => {
        if (wall.wallType) {
          const wallType = findWallType(wall.wallType);
          if (wallType) {
            wall.thicknessPx = wallType.thickness;
          }
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
