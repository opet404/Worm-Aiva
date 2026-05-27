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
  } catch (err) {}
  return defaultInstruction;
};

const handleStream = async (req: VercelRequest, res: VercelResponse) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sendSSE = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const { history, systemInstruction, temperature, file } = req.body || {};
    if (!history || !Array.isArray(history)) {
      sendSSE("error", { error: "Invalid request." });
      return res.end();
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      sendSSE("error", { error: "OPENROUTER_API_KEY belum dikonfigurasi." });
      return res.end();
    }

    const finalSystem = getSystemPrompt(systemInstruction || "Anda adalah Worm Aiva.");
    const messages: any[] = [];
    if (finalSystem) messages.push({ role: "system", content: finalSystem });

    history.forEach((item: any, index: number) => {
      const isLast = index === history.length - 1;
      const role = item.role === "user" ? "user" : "assistant";
      if (isLast && role === "user" && file) {
        if (file.base64) {
          messages.push({ role: "user", content: [
            { type: "text", text: item.text || "Analisis gambar ini." },
            { type: "image_url", image_url: { url: `data:${file.type};base64,${file.base64}` } },
          ]});
        } else if (file.textData) {
          messages.push({ role: "user", content: `--- ${file.name} ---\n${file.textData}\n---\n\n${item.text || "Analisis berkas ini."}` });
        }
      } else {
        messages.push({ role, content: item.text || "" });
      }
    });

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
        messages,
        temperature: temperature || 0.7,
        max_tokens: 4096,
        stream: false,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenRouter error ${response.status}: ${err}`);
    }

    const data: any = await response.json();
    const text = data.choices?.[0]?.message?.content || "";
    sendSSE("chunk", { text });
    sendSSE("done", { success: true });
    res.end();

  } catch (error: any) {
    sendSSE("error", { error: error.message || "Terjadi kesalahan." });
    res.end();
  }
};

const handleGenerate = async (req: VercelRequest, res: VercelResponse) => {
  try {
    const { prompt, systemInstruction, temperature } = req.body || {};
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("OPENROUTER_API_KEY belum dikonfigurasi.");

    const finalSystem = getSystemPrompt(systemInstruction || "Anda adalah Worm Aiva.");
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
          { role: "system", content: finalSystem },
          { role: "user", content: prompt },
        ],
        temperature: temperature || 0.7,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenRouter error ${response.status}: ${err}`);
    }

    const data: any = await response.json();
    res.json({ text: data.choices?.[0]?.message?.content || "" });

  } catch (error: any) {
    res.status(500).json({ error: error.message || "Terjadi kesalahan." });
  }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = req.url || "";

  if (url.includes("/chat/stream")) return handleStream(req, res);
  if (url.includes("/chat/generate")) return handleGenerate(req, res);

  res.json({ status: "ok", time: new Date().toISOString() });
}
