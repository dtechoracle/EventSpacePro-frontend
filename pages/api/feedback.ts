import type { NextApiRequest, NextApiResponse } from "next";

const WEB3FORMS_KEY = process.env.WEB3FORMS_ACCESS_KEY || "";

const TYPE_LABELS: Record<string, string> = {
  bug: "Bug Report",
  feature: "Feature Request",
  general: "General Feedback",
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { type, message, email, page, timestamp } = req.body;

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Message is required" });
  }

  const subject = `[EventSpacePro ${TYPE_LABELS[type] || "Feedback"}] ${message.slice(0, 60)}`;

  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <div style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:20px 24px;border-radius:12px 12px 0 0;">
        <h2 style="color:white;margin:0;font-size:18px;">EventSpacePro Feedback</h2>
        <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:13px;">${TYPE_LABELS[type] || "Feedback"}</p>
      </div>
      <div style="background:#f9fafb;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr>
            <td style="padding:8px 0;color:#6b7280;width:100px;vertical-align:top;">Type</td>
            <td style="padding:8px 0;color:#111827;font-weight:500;">${TYPE_LABELS[type] || type}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#6b7280;vertical-align:top;">Message</td>
            <td style="padding:8px 0;color:#111827;white-space:pre-wrap;line-height:1.5;">${message
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#6b7280;">From</td>
            <td style="padding:8px 0;color:#111827;">${email || "Anonymous"}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#6b7280;">Page</td>
            <td style="padding:8px 0;color:#111827;font-family:monospace;font-size:12px;">${page}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#6b7280;">Time</td>
            <td style="padding:8px 0;color:#111827;font-size:12px;">${new Date(timestamp).toLocaleString("en-US", {
              timeZone: "Africa/Lagos",
              dateStyle: "full",
              timeStyle: "long",
            })}</td>
          </tr>
        </table>
      </div>
    </div>
  `;

  if (!WEB3FORMS_KEY) {
    console.log("[Feedback] No WEB3FORMS_ACCESS_KEY configured. Feedback logged:");
    console.log(JSON.stringify({ type, message, email, page, timestamp }, null, 2));
    return res.status(200).json({
      ok: true,
      note: "Feedback logged (no email service configured). Set WEB3FORMS_ACCESS_KEY in .env.local to enable email delivery.",
    });
  }

  try {
    const response = await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_key: WEB3FORMS_KEY,
        to: "iamezekieljeremiah@gmail.com",
        subject,
        html,
        from: "EventSpacePro Feedback <noreply@eventspacepro.com>",
        reply_to: email || undefined,
      }),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || "Web3Forms submission failed");
    }

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error("[Feedback] Email send failed:", err.message);
    return res.status(500).json({ error: "Failed to send feedback" });
  }
}
