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
      groupContext,
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
        fill?: string;
        stroke?: string;
        strokeWidth?: number;
        isGroup?: boolean;
        groupAssets?: Array<{
          id: string;
          type: string;
          x: number;
          y: number;
          width?: number;
          height?: number;
        }>;
      }[];
      canvas?: { width: number; height: number };
      groupContext?: {
        groupId: string;
        groupBounds: { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number };
        childAssets: Array<{ 
          id: string; 
          type: string; 
          x: number; 
          y: number; 
          width?: number; 
          height?: number;
          fillColor?: string;
          strokeColor?: string;
          scale?: number;
          rotation?: number;
          description?: string;
        }>;
      };
    };

    if (!OPENAI_API_KEY) {
      return res
        .status(500)
        .json({ error: "OPENAI_API_KEY not configured on server" });
    }

    const system = `You are an intelligent assistant that controls a 2D event layout editor.
You receive natural language requests and a list of currently selected items on the canvas (in millimetres).
Your job is to understand the user's intent and translate it into an appropriate action.

IMPORTANT: 
- Understand natural language flexibly - users may phrase requests in many ways
- If the request is about editing/modifying selected items (resize, move, rotate, change properties, position within groups), return an action
- If the request is about creating new items, planning layouts, or general questions, return an error so the system can route to plan generation
- If groupContext is provided, the selected item is a GROUP containing child assets. Child assets have RELATIVE positions within the group bounds. When moving items within a group, use type="moveWithinGroup" with relative positions.

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
        type: "moveWithinGroup";
        targetAssetId: string; // ID of the child asset to move within the group
        position: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center" | "top-center" | "bottom-center" | "left-center" | "right-center";
        // OR use relative coordinates within group bounds (0,0 is top-left of group)
        relativeX?: number; // relative position from group's left edge (0 = left edge, 1 = right edge)
        relativeY?: number; // relative position from group's top edge (0 = top edge, 1 = bottom edge)
        // OR use absolute offset from a corner
        offsetX?: number; // offset in mm from the specified corner
        offsetY?: number; // offset in mm from the specified corner
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
        updates: Record<string, any>; // generic updates, e.g. { fill: '#ff0000', strokeWidth: 5 }
      };
      message: string;
    };

Rules:
- Units are ALWAYS millimetres.
- If the user says "make it bigger/smaller", use type="resize" with scaleFactor (e.g. 1.5, 0.5).
- If the user says "move 1000mm to the right", use type="move" with dx=1000.
- If the user says "center this in the canvas", use type="move" with absolute x and y at the canvas centre.
- If groupContext is provided AND the command mentions moving a child item relative to the group (e.g., "move the circle to the top left corner of the wall"), use type="moveWithinGroup".
- For "moveWithinGroup", you MUST identify the target child asset by matching the user's description to childAssets in groupContext.childAssets array.
- Matching rules:
  * "circle" or "round" -> find child with type="ellipse" or type="circle" OR description="circle"
  * "rectangle" or "rect" -> find child with type="rectangle" OR description="rectangle"  
  * "wall" -> find child with type="wall-segments" OR description="wall"
  * "table" -> find child with type containing "table"
  * Color words: "blue" matches fillColor="#3b82f6" or "#0000ff" or "#60a5fa", "red" matches "#ef4444" or "#ff0000", "green" matches "#00ff00" or "#10b981"
  * If user says "the circle" or "the blue circle", match BOTH type AND color if color is mentioned
- CRITICAL: 
  * You MUST use the EXACT childAsset.id from groupContext.childAssets array
  * When groupContext is provided, selectedAssets[0] is the GROUP itself, NOT a child
  * childAssets array contains all items INSIDE the group - use one of those IDs
  * If you cannot find a matching child, return an error explaining which children are available
- For relative positions within groups:
  - "top-left" = (0, 0) relative to group bounds
  - "top-right" = (1, 0) relative to group bounds
  - "bottom-left" = (0, 1) relative to group bounds
  - "bottom-right" = (1, 1) relative to group bounds
  - "center" = (0.5, 0.5) relative to group bounds
- If multiple numbers are given like "resize to 5000 by 3000" or "300x300", map to width and height (mm).
- For "resize to [W] x [H]", the first number is width, second is height.
- For colors, use hex codes (e.g. "red" -> "#ff0000", "blue" -> "#0000ff").
- Supported properties for "update": fill, stroke, strokeWidth, opacity, type.
- Never mention items by id in the message; just confirm the action in natural language.
- If the intent is unclear, choose the closest reasonable action and explain in message.

Examples:
User: "Resize to 300mm x 300mm"
JSON: { "action": { "type": "resize", "width": 300, "height": 300 }, "message": "Resized to 300mm x 300mm." }

User: "Move the circle to the top left corner of the wall"
Context: groupContext.childAssets = [{ id: "abc123", type: "ellipse", description: "circle", fillColor: "#3b82f6" }, { id: "def456", type: "wall-segments", description: "wall" }]
JSON: { "action": { "type": "moveWithinGroup", "targetAssetId": "abc123", "position": "top-left" }, "message": "Moved the circle to the top left corner of the wall." }

User: "Move the blue circle to the center of the wall"
Context: groupContext.childAssets = [{ id: "abc123", type: "ellipse", description: "circle", fillColor: "#3b82f6" }, { id: "def456", type: "wall-segments", description: "wall" }]
JSON: { "action": { "type": "moveWithinGroup", "targetAssetId": "abc123", "position": "center" }, "message": "Moved the blue circle to the center of the wall." }

IMPORTANT MATCHING INSTRUCTIONS:
- When user says "circle", look for child with type="ellipse" OR type="circle" OR description="circle"
- When user says "blue circle", match BOTH: (type="ellipse" OR type="circle") AND fillColor="#3b82f6" (or similar blue)
- When user says "wall", look for child with type="wall-segments" OR description="wall"
- ALWAYS use the EXACT id from groupContext.childAssets array - never use the group's own ID
- If multiple children match, prefer the one that matches more criteria (e.g., both type AND color)

User: "Change color to blue"
JSON: { "action": { "type": "update", "updates": { "fill": "#3b82f6" } }, "message": "Changed color to blue." }
`;

    const userPayload = {
      prompt,
      selectedAssets,
      canvas,
      groupContext,
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

    if (!r.ok) {
      console.error("OpenAI API Error:", json);
      return res.status(r.status).json({
        error: `OpenAI Error: ${json?.error?.message || r.statusText}`
      });
    }

    const content = json?.choices?.[0]?.message?.content || "{}";

    let parsed: any = {};
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.error("AI JSON Parse Error:", e);
      console.log("Raw Content:", content);
      return res.status(500).json({ error: "Failed to parse AI response. Raw: " + content.substring(0, 100) });
    }

    return res.status(200).json(parsed);
  } catch (e: any) {
    return res
      .status(500)
      .json({ error: e?.message || "AI command handler error" });
  }
}





