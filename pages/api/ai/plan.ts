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

    const system = `You are a friendly, non-technical CAD/space-planning assistant. You help users create event layouts.
Always reply with STRICT JSON (no prose):
type Assistant = {
  followUp?: string; // ask ONE concise question only when necessary
  plan?: Plan;       // when enough info is gathered
};
type Plan = {
  walls: { widthMm: number; heightMm: number; centerX?: number; centerY?: number; thicknessPx?: number }[];
  tables: { assetType?: string; xMm: number; yMm: number; widthMm?: number; heightMm?: number; rotation?: number }[];
  chairs: { assetType?: string; xMm: number; yMm: number; rotation?: number; widthMm?: number; heightMm?: number }[];
  chairsAround?: { centerX: number; centerY: number; radiusMm: number; count: number; chairAsset?: string; chairSizePx?: number; tableAsset?: string; tableSizePx?: number }[];
};
Rules:
- If the user gives a direct command (e.g., "add 6 chairs around the table", "place 10 chairs around each table"), generate a plan immediately using chairsAround. Do NOT ask follow-ups in this case.
- Only ask a followUp when critical information is missing (guests, tables, room dimensions). Never more than one question.
- Never ask for coordinates; compute positions yourself and keep items within canvas bounds with ~1000mm margins.
- Default assets: table assetType='round-table', chair assetType='normal-chair', thicknessPx=2.
- Use mm for positions and radii.`;

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
    const content = json?.choices?.[0]?.message?.content || '{}';
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch { }
    return res.status(200).json(parsed);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'AI error' });
  }
}


