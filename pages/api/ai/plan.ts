import type { NextApiRequest, NextApiResponse } from 'next';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { prompt, canvas, messages } = req.body as { prompt?: string; canvas?: { width: number; height: number }; messages?: { role: 'user'|'assistant'; content: string }[] };
    if (!OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
    const system = `You are a friendly, non-technical CAD/space-planning assistant. You help users create event layouts by asking simple questions about their needs, then automatically generating a complete plan. Always reply with STRICT JSON (no prose):
type Assistant = {
  followUp?: string; // if more info is needed, ask ONE simple question (never ask for coordinates/positions)
  plan?: Plan;       // when enough info is gathered
};
type Plan = {
  walls: { widthMm: number; heightMm: number; centerX?: number; centerY?: number; thicknessPx?: number }[];
  tables: { assetType?: string; xMm: number; yMm: number; widthMm?: number; heightMm?: number; rotation?: number }[];
  chairs: { assetType?: string; xMm: number; yMm: number; rotation?: number; widthMm?: number; heightMm?: number }[];
  chairsAround?: { centerX: number; centerY: number; radiusMm: number; count: number; chairAsset?: string; chairSizePx?: number; tableAsset?: string; tableSizePx?: number }[];
};
CRITICAL RULES - ASK QUESTIONS IN THIS ORDER:
1. First: "How many guests are you expecting?" (wait for answer)
2. Second: "How many tables would you like?" (wait for answer)
3. Third: Calculate chairs per table = guests / tables (round up if needed). Then ask: "What radius (in mm) should the chairs be around each table? (e.g., 65mm, 80mm)" (wait for answer)
4. Fourth: "What are the room dimensions? (width x height in mm, e.g., 10000mm x 6000mm)" (wait for answer)
5. After all info is gathered, generate the plan immediately.

POSITIONING RULES:
- NEVER ask for coordinates, positions, or technical details.
- Automatically calculate ALL positions (xMm, yMm, centerX, centerY) based on reasonable spacing and layout.
- Place items evenly distributed within walls, but keep them away from canvas edges (at least 1000mm margin from edges).
- For chairsAround: use the provided radius, calculate chairs per table from guests/tables, automatically space multiple table+chair groups evenly across the room.
- Defaults: table assetType='rectangular-table' or 'round-table' based on context, chair assetType='normal-chair', thicknessPx=2.
- Units: mm for positions and radii; px sizes map directly to widthMm/heightMm.
- When user says "proceed" or "yes" after you have enough info, generate the plan immediately.
- Keep everything within canvas bounds with safe margins from edges.`;
    const user = messages && messages.length > 0
      ? JSON.stringify({ canvas, chat: messages })
      : `Canvas: ${canvas?.width || 0}x${canvas?.height || 0} mm. Instruction: ${prompt}`;
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
    try { parsed = JSON.parse(content); } catch {}
    return res.status(200).json(parsed);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'AI error' });
  }
}


