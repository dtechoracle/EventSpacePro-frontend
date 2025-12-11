import type { NextApiRequest, NextApiResponse } from "next";
import formidable from "formidable";
import fs from "fs";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export const config = {
    api: {
        bodyParser: false,
    },
};

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    if (!OPENAI_API_KEY) {
        return res
            .status(500)
            .json({ error: "OPENAI_API_KEY not configured on server" });
    }

    try {
        // Parse form data
        const form = formidable({});
        const [fields, files] = await form.parse(req);

        const imageFile = Array.isArray(files.image) ? files.image[0] : files.image;

        if (!imageFile) {
            return res.status(400).json({ error: "No image file uploaded" });
        }

        // Read image file and convert to base64
        const imageBuffer = fs.readFileSync(imageFile.filepath);
        const base64Image = imageBuffer.toString("base64");
        const mimeType = imageFile.mimetype || "image/jpeg";

        // Prepare prompt for GPT-4 Vision
        const systemPrompt = `You are an expert in analyzing venue and floor plan images. Your task is to analyze the uploaded image and extract layout information that can be used to recreate the venue in a 2D event planning editor.

Return ONLY valid JSON with this structure:
{
  "dimensions": {
    "width": number (in millimeters),
    "height": number (in millimeters)
  },
  "walls": [
    {
      "start": { "x": number, "y": number },
      "end": { "x": number, "y": number },
      "thickness": number (default 150mm)
    }
  ],
  "furniture": [
    {
      "type": "table" | "chair" | "stage" | "bar" | "rectangle" | "circle",
      "x": number,
      "y": number,
      "width": number,
      "height": number,
      "rotation": number (degrees, 0-360)
    }
  ]
}

Guidelines:
- Estimate realistic millimeter dimensions (typical venues are 5000-20000mm)
- Position coordinates should be relative to top-left corner (0,0)
- Identify walls, furniture, stages, bars, tables, chairs
- If you can't identify specific furniture, use generic shapes (rectangle/circle)
- Be conservative with estimates rather than overly precise`;

        // Call GPT-4 Vision API
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content: systemPrompt,
                    },
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: "Analyze this venue/floor plan image and return the layout data as JSON.",
                            },
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:${mimeType};base64,${base64Image}`,
                                },
                            },
                        ],
                    },
                ],
                max_tokens: 2000,
                temperature: 0.2,
                response_format: { type: "json_object" },
            }),
        });

        const aiData = await response.json();

        if (!response.ok) {
            console.error("OpenAI API Error:", aiData);
            return res.status(response.status).json({
                error: `OpenAI Error: ${aiData?.error?.message || response.statusText}`,
            });
        }

        const content = aiData?.choices?.[0]?.message?.content || "{}";

        let layout: any = {};
        try {
            layout = JSON.parse(content);
        } catch (e) {
            console.error("AI JSON Parse Error:", e);
            console.log("Raw Content:", content);
            return res
                .status(500)
                .json({ error: "Failed to parse AI response", rawContent: content });
        }

        // Clean up uploaded file
        fs.unlinkSync(imageFile.filepath);

        return res.status(200).json({ layout });
    } catch (e: any) {
        console.error("Venue analysis error:", e);
        return res
            .status(500)
            .json({ error: e?.message || "Venue analysis handler error" });
    }
}
