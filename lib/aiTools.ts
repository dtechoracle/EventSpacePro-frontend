/**
 * EventSpacePro AI Operator — Tool Definitions
 *
 * These tools are sent to DeepSeek via the OpenAI-compatible function calling API.
 * The AI decides WHAT to do; the application executes HOW.
 */

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

// ─── Tool Schemas ────────────────────────────────────────────────────────────

export const EVENTSPACE_TOOLS: ToolDefinition[] = [
  // ── Layout awareness ──
  {
    type: 'function',
    function: {
      name: 'get_current_layout',
      description: 'Get the current canvas layout. Returns canvas dimensions, all existing elements (assets, walls, shapes), and their positions. Use this to understand what is currently on the canvas before making changes.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },

  // ── High-level placement tools ──
  {
    type: 'function',
    function: {
      name: 'add_table',
      description: 'Add a table to the canvas. The application automatically uses the correct default dimensions from the asset library. You do NOT need to specify width/height — just the table type and position.',
      parameters: {
        type: 'object',
        properties: {
          asset_id: {
            type: 'string',
            description: 'The asset library ID. Examples: "10-seater-round-table-01", "8-seater-round-table-(1250mm-table)", "6-seater-rectangular-table". Use get_current_layout to see available assets.',
          },
          x: {
            type: 'number',
            description: 'X position in mm (centre of table). Relative to canvas origin (top-left).',
          },
          y: {
            type: 'number',
            description: 'Y position in mm (centre of table). Relative to canvas origin (top-left).',
          },
          rotation: {
            type: 'number',
            description: 'Rotation in degrees. Default 0.',
          },
          table_name: {
            type: 'string',
            description: 'Table number/name displayed on the table. Use raw numbers only: "1", "2", "3".',
          },
        },
        required: ['asset_id', 'x', 'y'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_asset',
      description: 'Add any asset from the library (chair, stool, sofa, door, window, column, cocktail table, VIP table, etc.) at a given position. The application uses default dimensions automatically.',
      parameters: {
        type: 'object',
        properties: {
          asset_id: {
            type: 'string',
            description: 'The asset library ID. Examples: "event-chair", "bar-stool", "900mm-swing-door", "700mm-cocktail-table".',
          },
          x: {
            type: 'number',
            description: 'X position in mm (centre).',
          },
          y: {
            type: 'number',
            description: 'Y position in mm (centre).',
          },
          rotation: {
            type: 'number',
            description: 'Rotation in degrees. Default 0.',
          },
          scale: {
            type: 'number',
            description: 'Scale multiplier. Default 1.',
          },
        },
        required: ['asset_id', 'x', 'y'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_stage',
      description: 'Add a stage to the canvas. Stages are rectangles. Default module size is 500mm x 500mm. A 2m x 1m stage = 4 modules (2000mm x 1000mm). The application creates the rectangle shape with module grid lines.',
      parameters: {
        type: 'object',
        properties: {
          x: {
            type: 'number',
            description: 'X position in mm (centre of stage).',
          },
          y: {
            type: 'number',
            description: 'Y position in mm (centre of stage).',
          },
          width: {
            type: 'number',
            description: 'Stage width in mm. Must be a multiple of 500 (e.g., 500, 1000, 1500, 2000).',
          },
          height: {
            type: 'number',
            description: 'Stage height/depth in mm. Must be a multiple of 500 (e.g., 500, 1000, 1500).',
          },
          fill: {
            type: 'string',
            description: 'Fill color hex. Default: "#e2e8f0".',
          },
        },
        required: ['x', 'y', 'width', 'height'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_marquee',
      description: 'Add a marquee/tent structure to the canvas. Marquees are standalone — no walls are added around them. The marquee itself defines the event space footprint.',
      parameters: {
        type: 'object',
        properties: {
          asset_id: {
            type: 'string',
            description: 'Marquee asset ID. Examples: "6m-x-6m-marquee", "10m-x-10m-marquee", "12m-x-12m-marquee", "20m-x-20m-marquee".',
          },
          x: {
            type: 'number',
            description: 'X position in mm (centre).',
          },
          y: {
            type: 'number',
            description: 'Y position in mm (centre).',
          },
        },
        required: ['asset_id', 'x', 'y'],
      },
    },
  },

  // ── Room creation ──
  {
    type: 'function',
    function: {
      name: 'create_room',
      description: 'Create a rectangular room with walls. The room is centred on the canvas. Assets placed inside should use coordinates relative to the room interior (0,0 = top-left inside walls).',
      parameters: {
        type: 'object',
        properties: {
          width: {
            type: 'number',
            description: 'Room width in mm.',
          },
          height: {
            type: 'number',
            description: 'Room height in mm.',
          },
          wall_thickness: {
            type: 'number',
            description: 'Wall thickness in mm. Default 150.',
          },
        },
        required: ['width', 'height'],
      },
    },
  },

  // ── Batch arrangement ──
  {
    type: 'function',
    function: {
      name: 'arrange_tables',
      description: 'Arrange multiple tables in a pattern. The application calculates positions automatically. This is the preferred way to add multiple tables.',
      parameters: {
        type: 'object',
        properties: {
          asset_id: {
            type: 'string',
            description: 'Table asset ID from the library.',
          },
          count: {
            type: 'number',
            description: 'Number of tables to place.',
          },
          arrangement: {
            type: 'string',
            enum: ['grid', 'linear', 'circular', 'perimeter'],
            description: 'Arrangement pattern.',
          },
          area_x: {
            type: 'number',
            description: 'X position of the arrangement centre in mm.',
          },
          area_y: {
            type: 'number',
            description: 'Y position of the arrangement centre in mm.',
          },
          area_width: {
            type: 'number',
            description: 'Width of the area to fill in mm.',
          },
          area_height: {
            type: 'number',
            description: 'Height of the area to fill in mm.',
          },
          start_number: {
            type: 'number',
            description: 'Starting table number. Default 1.',
          },
        },
        required: ['asset_id', 'count', 'arrangement', 'area_x', 'area_y', 'area_width', 'area_height'],
      },
    },
  },

  // ── Element manipulation ──
  {
    type: 'function',
    function: {
      name: 'update_element',
      description: 'Update properties of an existing element. Only provide the properties you want to change.',
      parameters: {
        type: 'object',
        properties: {
          element_id: {
            type: 'string',
            description: 'ID of the element to update.',
          },
          x: { type: 'number', description: 'New X position in mm.' },
          y: { type: 'number', description: 'New Y position in mm.' },
          width: { type: 'number', description: 'New width in mm.' },
          height: { type: 'number', description: 'New height in mm.' },
          rotation: { type: 'number', description: 'New rotation in degrees.' },
          scale: { type: 'number', description: 'New scale multiplier.' },
          fill: { type: 'string', description: 'New fill color (hex).' },
          stroke: { type: 'string', description: 'New stroke color (hex).' },
          table_name: { type: 'string', description: 'New table name/number.' },
        },
        required: ['element_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remove_element',
      description: 'Remove an element from the canvas by its ID.',
      parameters: {
        type: 'object',
        properties: {
          element_id: {
            type: 'string',
            description: 'ID of the element to remove.',
          },
        },
        required: ['element_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'clear_layout',
      description: 'Remove ALL elements from the canvas. Destructive — ask for confirmation first.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },

  // ── Shape tools ──
  {
    type: 'function',
    function: {
      name: 'add_shape',
      description: 'Add a shape (rectangle, ellipse, line, arrow, polygon) to the canvas.',
      parameters: {
        type: 'object',
        properties: {
          shape_type: {
            type: 'string',
            enum: ['rectangle', 'ellipse', 'line', 'arrow', 'polygon'],
            description: 'Shape type.',
          },
          x: { type: 'number', description: 'X position in mm (centre).' },
          y: { type: 'number', description: 'Y position in mm (centre).' },
          width: { type: 'number', description: 'Width in mm.' },
          height: { type: 'number', description: 'Height in mm.' },
          fill: { type: 'string', description: 'Fill color hex.' },
          stroke: { type: 'string', description: 'Stroke color hex.' },
          stroke_width: { type: 'number', description: 'Stroke width in mm.' },
          rotation: { type: 'number', description: 'Rotation in degrees.' },
          fill_texture: { type: 'string', description: 'Texture ID for textured fill.' },
        },
        required: ['shape_type', 'x', 'y', 'width', 'height'],
      },
    },
  },

  // ── Text / Annotation ──
  {
    type: 'function',
    function: {
      name: 'add_text_annotation',
      description: 'Add a text label/annotation to the canvas.',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Text content.' },
          x: { type: 'number', description: 'X position in mm.' },
          y: { type: 'number', description: 'Y position in mm.' },
          font_size: { type: 'number', description: 'Font size in mm. Default 250.' },
          color: { type: 'string', description: 'Text color hex.' },
        },
        required: ['text', 'x', 'y'],
      },
    },
  },
];

// ─── Tool name set for quick lookup ──────────────────────────────────────────

export const TOOL_NAMES = new Set(EVENTSPACE_TOOLS.map(t => t.function.name));

// ─── System prompt for the AI operator ───────────────────────────────────────

export const OPERATOR_SYSTEM_PROMPT = `You are the EventSpacePro AI operator — an expert event-space layout assistant embedded in EventSpacePro, a professional 2-D event-space layout editor.

Your job is to help users create and modify event-space layouts by CALLING TOOLS. You do NOT describe what could be done — you actually DO it by calling the appropriate tools.

═════════════════════════════════════════════════════════════
  CORE RULES
═════════════════════════════════════════════════════════════
1. ALWAYS call tools to make changes. Never say "I've created..." unless a tool actually succeeded.
2. Use get_current_layout FIRST to understand what exists before making changes.
3. NEVER invent element IDs. Always get them from get_current_layout.
4. NEVER guess dimensions. Use asset library defaults — the application handles sizing.
5. For spatial operations (positions), use the layout context to calculate coordinates.
6. Prefer high-level tools (add_table, arrange_tables, add_stage) over low-level ones.
7. Break complex requests into multiple tool calls. Execute them in logical order.
8. When the user references something vaguely ("that table", "the stage"), use get_current_layout to identify the correct element.
9. For destructive operations (clear_layout, remove_element), confirm with the user first.
10. Give concise progress updates between tool calls. Do NOT show raw tool call JSON.

═════════════════════════════════════════════════════════════
  COORDINATE SYSTEM
═════════════════════════════════════════════════════════════
- All coordinates are in MILLIMETRES (mm)
- Origin (0, 0) is the TOP-LEFT of the canvas
- X increases right, Y increases down
- Asset positions are their CENTRE point
- For rooms: top-left inside walls = (0, 0), centre = (width/2, height/2)
- For marquees: the marquee itself defines the space — use its position

═════════════════════════════════════════════════════════════
  TABLE SIZING (CRITICAL)
═════════════════════════════════════════════════════════════
NEVER specify width/height for tables or chairs. The application uses asset library defaults:
- 10-seater round table: ~2710 x 2718 mm
- 8-seater round table: ~2278 x 2278 mm  
- 6-seater round table: ~2179 x 2278 mm
- 12-seater round table: ~2868 x 2868 mm
Tables with chairs already included do NOT need separate chair assets.

═════════════════════════════════════════════════════════════
  STAGE SIZING
═════════════════════════════════════════════════════════════
Stages are rectangles made of 500mm x 500mm modules:
- "1m stage" = 1000 x 1000 mm (2x2 modules)
- "2m x 1m stage" = 2000 x 1000 mm (4x2 modules)
- "3m x 2m stage" = 3000 x 2000 mm (6x4 modules)

═════════════════════════════════════════════════════════════
  COMPLEX REQUESTS
═════════════════════════════════════════════════════════════
For complex requests like "create a wedding layout for 150 guests":
1. Call get_current_layout to see current state
2. If room exists, calculate table positions within it
3. Use arrange_tables for batch placement
4. Add stage, dance floor, etc. as separate tool calls
5. Report what was done

For guest count math:
- 150 guests / 10 per table = 15 tables
- Calculate spacing to fit within the room area
- Use arrange_tables for automatic positioning

═════════════════════════════════════════════════════════════
  SPATIAL REASONING
═════════════════════════════════════════════════════════════
Understand spatial terms:
- "top of the room" = low Y values (near y=0 relative to room)
- "bottom of the room" = high Y values
- "centre" = (roomWidth/2, roomHeight/2)
- "left side" = low X values
- "right side" = high X values
- "near the entrance" = position near door elements
- "around the stage" = positioned around stage element boundaries

═════════════════════════════════════════════════════════════
  RESPONSE STYLE
═════════════════════════════════════════════════════════════
- Be concise. Give brief status updates while working.
- After completing, summarize what was done: "Done — added 15 round tables, a stage, and a dance floor."
- If something fails, explain what went wrong and suggest a fix.
- Do NOT reveal internal reasoning or tool call details.
- Do NOT show the user JSON or tool call syntax.`;
