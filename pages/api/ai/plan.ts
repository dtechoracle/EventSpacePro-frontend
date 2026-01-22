import type { NextApiRequest, NextApiResponse } from 'next';

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
      const count = addChairsMatch ? parseInt(addChairsMatch[1], 10) : 6; // default to 6 if not specified
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
            chairAsset: 'one-chair.svg',
            tableAsset: selectedTable?.type,
          },
        ],
      };
      return res.status(200).json({ plan });
    }

    if (!OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });

    const system = `You are a friendly, helpful AI assistant for EventSpacePro, an event layout design tool. You understand the entire product and workflow.

**Product Knowledge:**
- **Dashboard:** The central hub for managing Projects. You can view all projects, access "Favorites" (starred events), and use "Templates" to start quickly.
- **Projects & Events:** A Project contains multiple Events (layouts). You must select a project to create an event. Events can be created from scratch, templates, or AI.
- **Editor:** The core design tool. Features include:
    - **Tools:** Select, Pan, Zoom, Wall drawing, Decor placement (drag & drop).
    - **Canvas:** Infinite 2D workspace. Supports metric (mm) units.
    - **Properties Panel:** Edit size, rotation, color, texture (wood, marble, fabric).
    - **Assets:** Library of furniture (tables, chairs, lounge), equipment, and decor.
    - **Layers:** Manage z-ordering of items.
    - **Export:** Export layouts as PDF or images.
- **Workflow:**
    1. **Create:** Go to Dashboard -> New Project or open existing -> New Event (or use AI Assistant).
    2. **Design:** Draw walls to define the room. Drag furniture from the library. Use AI to generating seating layouts.
    3. **Refine:** Select items to change colors/fabrics. consistent styling.
    4. **Output:** Export the plan for clients or vendors.

**Your Capabilities:**
1. **Generating Layouts:** Create detailed floor plans with walls, tables, and chairs.
2. **Product Support:** Answer "How do I...?" questions about the tool (e.g., "How to export?", "Where are favorites?").
3. **Event Planning:** Offer advice on capacity, spacing, and flow.

**Response Format (STRICT JSON):**
type Assistant = {
  followUp?: string; // ask ONE concise question only when necessary for layout creation
  plan?: Plan;       // when enough info is gathered for layout creation
  message?: string;  // for general questions, answers, or helpful responses (not layout-related)
};
type Plan = {
  walls: { widthMm: number; heightMm: number; centerX?: number; centerY?: number; thicknessPx?: number }[];
  tables: { assetType?: string; xMm: number; yMm: number; widthMm?: number; heightMm?: number; rotation?: number }[];
  chairs: { assetType?: string; xMm: number; yMm: number; rotation?: number; widthMm?: number; heightMm?: number }[];
  chairsAround?: { centerX: number; centerY: number; radiusMm: number; count: number; chairAsset?: string; chairSizePx?: number; tableAsset?: string; tableSizePx?: number }[];
};

**Rules:**
- **Layouts:** If the user wants a layout (e.g., "add 6 chairs", "wedding setup"), generate a 'plan'. Use 'chairsAround' for circular seating. Default to 'round-table' and 'normal-chair'. Keep items within canvas bounds (~10000x10000mm).
- **Questions:** If the user asks about the app (e.g., "How do I save?", "What is EventSpacePro?"), use 'message' to explain clearly based on Product Knowledge.
- **General:** Be professional, concise, and helpful. Use mm for units.`;

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
    // Strip markdown code blocks if present
    content = content.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');

    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch (e) { console.error("JSON parse error", e, content); }

    // If it's a general message (not a plan or followUp), return it
    if (parsed.message && !parsed.plan && !parsed.followUp) {
      return res.status(200).json({ message: parsed.message });
    }

    return res.status(200).json(parsed);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'AI error' });
  }
}

