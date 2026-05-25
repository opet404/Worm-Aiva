import type { VercelRequest, VercelResponse } from "@vercel/node";
import fs from "fs";
import path from "path";

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

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sendSSE = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const { history, systemInstruction, temperature, file } = req.body;
    const finalSystemInstruction = getSystemPrompt(
      systemInstruction || "Anda adalah Worm Aiva."
    );

    const deepseekApiKey = process.env.DEEPSEEK_API_KEY;
    if (!deepseekApiKey) {
      sendSSE("error", {
        error: "DEEPSEEK_API_KEY belum dikonfigurasi.",
      });
      res.end();
      return;
    }

    const messages: any[] = [];
    if (finalSystemInstruction) {
      messages.push({ role: "system", content: finalSystemInstruction });
    }

    history.forEach((item: any, index: number) => {
      const isLastItem = index === history.length - 1;
      const role = item.role === "user" ? "user" : "assistant";

      if (isLastItem && role === "user" && file) {
        if (file.base64) {
          messages.push({
            role: "user",
            content: [
              { type: "text", text: item.text || "Tolong bantu analisis gambar yang dilampirkan ini." },
              { type: "image_url", image_url: { url: `data:${file.type};base64,${file.base64}` } },
            ],
          });
        } else if (file.textData) {
          const fileContext = `--- LAMPIRAN BERKAS: ${file.name} ---\n${file.textData}\n--- AKHIR BERKAS ---\n\n`;
          messages.push({ role: "user", content: fileContext + (item.text || "Tolong jelaskan atau analisis isi berkas di atas.") });
        }
      } else {
        messages.push({ role, content: item.text || "" });
      }
    });

    // Non-streaming request to DeepSeek (more compatible with Vercel)
    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${deepseekApiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages,
        temperature: temperature || 0.7,
        max_tokens: 4096,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`DeepSeek API error ${response.status}: ${errText}`);
    }

    const data: any = await response.json();
    const text = data.choices?.[0]?.message?.content || "";

    // Send full text as single chunk then done
    sendSSE("chunk", { text });
    sendSSE("done", { success: true });
    res.end();

  } catch (error: any) {
    console.error("Stream error:", error);
    sendSSE("error", {
      error: error.message || "Terjadi kesalahan koneksi API DeepSeek.",
    });
    res.end();
  }
}
