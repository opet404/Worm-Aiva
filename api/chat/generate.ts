import type { VercelRequest, VercelResponse } from "@vercel/node";
import fs from "fs";
import path from "path";

export const config = {
  api: { bodyParser: true },
};

const getSystemPrompt = (defaultInstruction: string = ""): string => {
  try {
    const promptPath = path.join(process.cwd(), "promt.txt");
    if (fs.existsSync(promptPath)) {
      return fs.readFileSync(promptPath, "utf-8");
    }
  } catch (err) {
    console.error("Error reading promt.txt:", err);
  }
  return defaultInstruction;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { prompt, systemInstruction, temperature } = req.body || {};
    const finalSystemInstruction = getSystemPrompt(
      systemInstruction || "Anda adalah Worm Aiva."
    );

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error("OPENROUTER_API_KEY belum dikonfigurasi di Vercel Environment Variables.");
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "https://worm-aiva.vercel.app",
        "X-Title": "Worm Aiva",
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-chat-v3-0324:free",
        messages: [
          { role: "system", content: finalSystemInstruction },
          { role: "user", content: prompt },
        ],
        temperature: temperature || 0.7,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenRouter API error ${response.status}: ${errText}`);
    }

    const data: any = await response.json();
    const text = data.choices?.[0]?.message?.content || "";
    return res.json({ text });

  } catch (error: any) {
    console.error("Generate error:", error);
    res.status(500).json({ error: error.message || "An error occurred during generation." });
  }
}
