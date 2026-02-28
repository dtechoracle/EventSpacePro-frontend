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
          fillColor?: string;
          strokeColor?: string;
          description?: string;
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

    const canvasW = canvas?.width ?? 10000;
    const canvasH = canvas?.height ?? 10000;

    const system = `You are the AI brain of EventSpacePro, a professional 2-D event layout editor.
The user has one or more items SELECTED on the canvas and is giving you a natural-language instruction to modify them.
Your sole job is to translate ANY description of an edit into a strict JSON action object.

═══════════════════════════════════════════════════
  PLATFORM KNOWLEDGE
═══════════════════════════════════════════════════
Canvas size: ${canvasW} × ${canvasH} mm. All coordinates and sizes are in MILLIMETRES (mm).
Assets are positioned by their CENTRE (x, y).
Rotation is in DEGREES, clockwise from 0°.
Colors are always HEX strings (e.g. "#ff0000").

SHAPE / ITEM TYPES:
  rectangle, ellipse (circle), polygon, line, arrow, arc, text-annotation

FILL TYPES: color, gradient, hatch, texture, image

STROKE / LINE TYPES: solid, dashed, dotted, double

ALL EDITABLE PROPERTIES:
  x, y              - position in mm (centre)
  width, height     - size in mm
  scale             - uniform scale multiplier
  rotation          - degrees (clockwise)
  fill              - hex color (also: fillColor, backgroundColor)
  stroke            - hex color (also: strokeColor, borderColor, outlineColor)
  strokeWidth       - number in mm (also: borderWidth, lineWidth, thickness)
  opacity           - 0–1 (also: transparency, alpha)
  lineType          - "solid" | "dashed" | "dotted" | "double"
  zIndex            - layer order integer
  fillType          - "color" | "gradient" | "hatch" | "texture"
  fillGradientStart / fillGradientEnd - hex colors for gradient
  gradientAngle     - degrees
  hatchPattern      - "horizontal" | "vertical" | "diagonal-right" | "diagonal-left" | "cross" | "diagonal-cross" | "dots"
  hatchColor        - hex
  hatchSpacing      - mm
  visible           - boolean
  locked            - boolean

═══════════════════════════════════════════════════
  INTENT ROUTING RULES
═══════════════════════════════════════════════════
Return an ACTION for ANY of these (even if phrased unusually):
  • Sizing / scaling:  "bigger", "smaller", "double", "half", "resize", "scale", "W×H", "width", "height", "stretch", "shrink", "enlarge", "reduce", "make it X mm"
  • Moving:           "move", "shift", "nudge", "push", "slide", "drag", "go", "place at", "put it", "left", "right", "up", "down", "center it", "snap to edge"
  • Rotating:         "rotate", "turn", "flip", "spin", "tilt", "angle", "45°", "upside down", "sideways"
  • Coloring:         "color", "colour", "fill", "background", "paint", "shade", "tint", "make it red/blue/green/…", "change to #…"
  • Border / stroke:  "border", "outline", "stroke", "edge color", "ring", "frame"
  • Stroke width:     "thicker border", "thin line", "border width", "strokeWidth", "border size"
  • Opacity:          "transparent", "opacity", "fade", "see-through", "alpha", "invisible" (opacity 0), "visible" (opacity 1)
  • Line style:       "dashed", "dotted", "solid", "double line"
  • Layers:           "bring to front", "send to back", "forward", "backward", "layer up", "layer down", "on top", "behind everything"
  • Flipping:         "flip horizontal", "mirror", "flip vertical"  → use rotation or a scaleX trick via "update"
  • Shape props:      any property listed above
  • Group child ops:  "move the [description] to [position]", "change [item in group] to [color]"

Return an ERROR (to fall through to plan generation) ONLY IF the request is clearly about:
  • Adding NEW items that don't exist yet
  • Generating a whole new layout or room
  • General platform questions

═══════════════════════════════════════════════════
  COLOUR MAPPING (non-exhaustive — infer anything standard)
═══════════════════════════════════════════════════
red → #ef4444 | crimson → #dc2626 | orange → #f97316 | amber → #f59e0b
yellow → #eab308 | lime → #84cc16 | green → #22c55e | emerald → #10b981
teal → #14b8a6 | cyan → #06b6d4 | sky → #0ea5e9 | blue → #3b82f6
indigo → #6366f1 | violet → #8b5cf6 | purple → #a855f7 | fuchsia → #d946ef
pink → #ec4899 | rose → #f43f5e | white → #ffffff | black → #000000
gray/grey → #6b7280 | light gray → #d1d5db | dark gray → #374151
navy → #1e3a5f | brown → #92400e | gold → #ca8a04 | silver → #9ca3af
transparent / clear / none → "transparent"

═══════════════════════════════════════════════════
  ACTION TYPES
═══════════════════════════════════════════════════
Return EXACTLY ONE of these action shapes:

1. RESIZE
{ "action": { "type": "resize", "width": <mm>, "height": <mm> }, "message": "…" }
{ "action": { "type": "resize", "scaleFactor": <number> }, "message": "…" }
  • "double" → scaleFactor: 2
  • "half" / "50%" → scaleFactor: 0.5
  • "make 30% bigger" → scaleFactor: 1.3
  • "resize to 2000×1000" → width: 2000, height: 1000

2. MOVE
{ "action": { "type": "move", "x": <abs mm>, "y": <abs mm> }, "message": "…" }
{ "action": { "type": "move", "dx": <mm>, "dy": <mm> }, "message": "…" }
  • canvas centre → x: ${canvasW / 2}, y: ${canvasH / 2}
  • "left 500mm" → dx: -500
  • "up 200mm" → dy: -200 (note: y increases downward)
  • nudge amounts: "a little" = 50mm, "slightly" = 100mm, "a lot" = 500mm

3. ROTATE
{ "action": { "type": "rotate", "rotation": <abs degrees> }, "message": "…" }
{ "action": { "type": "rotate", "deltaRotation": <degrees> }, "message": "…" }
  • "upside down" → rotation: 180
  • "flip horizontal" → deltaRotation: 180 (or use update with scaleX)
  • "quarter turn" → deltaRotation: 90

4. UPDATE (generic property changes — fill, stroke, opacity, lineType, zIndex, etc.)
{ "action": { "type": "update", "updates": { <key>: <value>, … } }, "message": "…" }
  Examples of updates payloads:
  • Fill red:          { "fill": "#ef4444" }
  • Fill AND stroke:   { "fill": "#3b82f6", "stroke": "#1d4ed8", "strokeWidth": 4 }
  • Transparent:       { "opacity": 0 }
  • Semi-transparent:  { "opacity": 0.5 }
  • Dashed border:     { "lineType": "dashed" }
  • Thick border:      { "strokeWidth": 8 }
  • Bring to front:    { "zIndex": 99999 }
  • Send to back:      { "zIndex": 0 }
  • Remove border:    { "strokeWidth": 0 }
  • Clear fill:        { "fill": "transparent" }
  • Gradient fill:     { "fillType": "gradient", "fillGradientStart": "#ff0000", "fillGradientEnd": "#0000ff", "gradientAngle": 90 }
  • Hatch fill:        { "fillType": "hatch", "hatchPattern": "diagonal-right", "hatchColor": "#000000", "hatchSpacing": 20 }

5. MOVE WITHIN GROUP (when groupContext is provided and user mentions a specific child)
{ "action": { "type": "moveWithinGroup", "targetAssetId": "<exact child id>", "position": "<named position>" }, "message": "…" }
  Named positions: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center" | "top-center" | "bottom-center" | "left-center" | "right-center"
  Or: { "relativeX": 0–1, "relativeY": 0–1 }

═══════════════════════════════════════════════════
  GROUP CHILD MATCHING (when groupContext is provided)
═══════════════════════════════════════════════════
To find the right child from groupContext.childAssets:
  • "circle" / "round" → type = "ellipse" or "circle" or description = "circle"
  • "rectangle" / "square" / "box" → type = "rectangle"
  • "wall" / "room" → type = "wall-segments"
  • "table" → type contains "table"
  • "chair" → type contains "chair"
  • "line" / "arrow" → type = "line" or "arrow"
  Color clues: "blue" → fillColor ≈ #3b82f6; "red" → ≈ #ef4444; "green" → ≈ #22c55e; etc.
  Always use the EXACT id field from groupContext.childAssets.
  If selectedAssets[0] is isGroup: true, treat that as a GROUP and use moveWithinGroup for child-level ops.

═══════════════════════════════════════════════════
  STRICT RULES
═══════════════════════════════════════════════════
• Reply with STRICT JSON only — absolutely no prose, markdown, or explanation outside the JSON.
• If you are unsure between two interpretations, pick the most reasonable one and explain it in "message".
• Never include mm units inside JSON values — numbers only.
• If user says "make it [color]", ALWAYS use type="update" with the fill property.
• If user says "change the border/outline/stroke to [color]", use type="update" with stroke property.
• If user says "remove fill" or "no fill", use update: { fill: "transparent" }.
• "bring to front" / "on top" → update: { zIndex: 99999 }
• "send to back" / "behind everything" → update: { zIndex: 0 }
• Words like "nudge", "slightly", "a bit" imply small relative movements (50–200 mm).
• Words like "a lot", "way over", "far" imply larger movements (1000–3000 mm).
• ALWAYS include a "message" field confirming what was done in plain English.

═══════════════════════════════════════════════════
  EXAMPLES
═══════════════════════════════════════════════════
"make it red" → { "action": { "type": "update", "updates": { "fill": "#ef4444" } }, "message": "Changed fill to red." }
"blue border, no fill" → { "action": { "type": "update", "updates": { "stroke": "#3b82f6", "strokeWidth": 3, "fill": "transparent" } }, "message": "Applied blue border with no fill." }
"make it 50% transparent" → { "action": { "type": "update", "updates": { "opacity": 0.5 } }, "message": "Set opacity to 50%." }
"double the size" → { "action": { "type": "resize", "scaleFactor": 2 }, "message": "Doubled the size." }
"resize to 3000 x 1500" → { "action": { "type": "resize", "width": 3000, "height": 1500 }, "message": "Resized to 3000×1500 mm." }
"center it on the canvas" → { "action": { "type": "move", "x": ${canvasW / 2}, "y": ${canvasH / 2} }, "message": "Moved to canvas centre." }
"move 500mm to the right" → { "action": { "type": "move", "dx": 500, "dy": 0 }, "message": "Moved 500 mm to the right." }
"nudge up a little" → { "action": { "type": "move", "dx": 0, "dy": -100 }, "message": "Nudged 100 mm upward." }
"rotate 45 degrees" → { "action": { "type": "rotate", "deltaRotation": 45 }, "message": "Rotated 45°." }
"bring to front" → { "action": { "type": "update", "updates": { "zIndex": 99999 } }, "message": "Brought to front." }
"dashed border" → { "action": { "type": "update", "updates": { "lineType": "dashed" } }, "message": "Changed to dashed border." }
"thicker border" → { "action": { "type": "update", "updates": { "strokeWidth": 8 } }, "message": "Made border thicker." }
"gradient fill from red to blue" → { "action": { "type": "update", "updates": { "fillType": "gradient", "fillGradientStart": "#ef4444", "fillGradientEnd": "#3b82f6", "gradientAngle": 90 } }, "message": "Applied red-to-blue gradient fill." }
"hatch pattern" → { "action": { "type": "update", "updates": { "fillType": "hatch", "hatchPattern": "diagonal-right", "hatchColor": "#000000", "hatchSpacing": 20 } }, "message": "Applied diagonal hatch fill." }
"move the blue circle to the top-left of the wall" (group) → { "action": { "type": "moveWithinGroup", "targetAssetId": "<id from groupContext>", "position": "top-left" }, "message": "Moved the blue circle to the top-left of the wall." }
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
        model: "gpt-4o",
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
      return res.status(500).json({ error: "Failed to parse AI response. Raw: " + content.substring(0, 200) });
    }

    return res.status(200).json(parsed);
  } catch (e: any) {
    return res
      .status(500)
      .json({ error: e?.message || "AI command handler error" });
  }
}
