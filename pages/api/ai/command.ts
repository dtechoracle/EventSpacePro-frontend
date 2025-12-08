import type { NextApiRequest, NextApiResponse } from "next";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      prompt,
      selectedAssets,
      canvas,
    } = req.body as {
      prompt: string;
      selectedAssets: {
        id: string;
        type: string;
        x: number;
        y: number;
        width?: number;
        height?: number;
        scale?: number;
        rotation?: number;
      }[];
      canvas?: { width: number; height: number };
    };

    if (!OPENAI_API_KEY) {
      return res
        .status(500)
        .json({ error: "OPENAI_API_KEY not configured on server" });
    }

    const system = `You are an assistant that controls a 2D event layout editor.
You receive a natural language command and a list of currently selected items on the canvas (in millimetres).
Your job is to translate the command into ONE simple edit action on ALL selected items.

ALWAYS reply with STRICT JSON only, no prose, with this exact TypeScript type:
type ActionResponse =
  | {
      action: {
        type: "resize";
        width?: number;       // absolute mm width for each item
        height?: number;      // absolute mm height for each item
        scale?: number;       // absolute scale factor to apply
        scaleFactor?: number; // relative multiplier, e.g. 2 = twice as big
      };
      message: string;
    }
  | {
      action: {
        type: "move";
        x?: number;   // absolute x in mm
        y?: number;   // absolute y in mm
        dx?: number;  // relative move in mm on x axis (positive = right)
        dy?: number;  // relative move in mm on y axis (positive = down)
      };
      message: string;
    }
  | {
      action: {
        type: "rotate";
        rotation?: number;      // absolute rotation in degrees
        deltaRotation?: number; // relative rotation in degrees
      };
      message: string;
    }
  | {
      action: {
        type: "update";
        updates: Record<string, any>; // generic updates, e.g. { width: 5000, x: 1000 }
      };
      message: string;
    };

Rules:
- Units are ALWAYS millimetres.
- If the user says "make it bigger/smaller", use type="resize" with scaleFactor (e.g. 1.5, 0.5).
- If the user says "move 1000mm to the right", use type="move" with dx=1000.
- If the user says "center this in the canvas", use type="move" with absolute x and y at the canvas centre.
- If multiple numbers are given like "resize to 5000 by 3000", map to width and height (mm).
- Never mention items by id in the message; just confirm the action in natural language.
- If the intent is unclear, choose the closest reasonable action and explain in message.
`;

    const userPayload = {
      prompt,
      selectedAssets,
      canvas,
    };

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: system },
          { role: "user", content: JSON.stringify(userPayload) },
        ],
        temperature: 0.1,
        response_format: { type: "json_object" },
      }),
    });

    const json = await r.json();
    const content = json?.choices?.[0]?.message?.content || "{}";

    let parsed: any = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = {};
    }

    return res.status(200).json(parsed);
  } catch (e: any) {
    return res
      .status(500)
      .json({ error: e?.message || "AI command handler error" });
  }
}




