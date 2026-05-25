import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check API
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // Helper to read promt.txt dynamically on every request
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

  // Direct generation API
  app.post("/api/chat/generate", async (req, res) => {
    try {
      const { prompt, systemInstruction, temperature } = req.body;
      const finalSystemInstruction = getSystemPrompt(systemInstruction || "Anda adalah Worm Aiva.");
      
      const deepseekApiKey = process.env.DEEPSEEK_API_KEY;
      if (!deepseekApiKey) {
        throw new Error("DEEPSEEK_API_KEY belum dikonfigurasi. Silakan tambahkan DEEPSEEK_API_KEY Anda di panel Secrets AI Studio.");
      }

      console.log("Calling DeepSeek generate API...");
      const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${deepseekApiKey}`
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: finalSystemInstruction },
            { role: "user", content: prompt }
          ],
          temperature: temperature || 0.7,
          max_tokens: 4096
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`DeepSeek API returns error ${response.status}: ${errText}`);
      }

      const data: any = await response.json();
      const text = data.choices?.[0]?.message?.content || "";
      return res.json({ text });

    } catch (error: any) {
      console.error("Generate error:", error);
      res.status(500).json({ error: error.message || "An error occurred during generation." });
    }
  });

  // Chat stream API via Server-Sent Events (SSE)
  app.post("/api/chat/stream", async (req, res) => {
    // Set headers for Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Helper to send formatted SSE messages
    const sendSSE = (event: string, data: any) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const { history, systemInstruction, temperature, file } = req.body;
      const finalSystemInstruction = getSystemPrompt(systemInstruction || "Anda adalah Worm Aiva.");
      
      const deepseekApiKey = process.env.DEEPSEEK_API_KEY;
      if (!deepseekApiKey) {
        sendSSE('error', { error: "DEEPSEEK_API_KEY belum dikonfigurasi. Silakan tambahkan Kunci API DeepSeek Anda di panel Secrets AI Studio (Settings > Secrets)." });
        res.end();
        return;
      }

      console.log("Using DeepSeek stream endpoint with API key...");
      
      // Structure OpenAI style messages array
      const messages: any[] = [];
      if (finalSystemInstruction) {
        messages.push({ role: "system", content: finalSystemInstruction });
      }

      history.forEach((item: any, index: number) => {
        const isLastItem = index === history.length - 1;
        const role = item.role === 'user' ? 'user' : 'assistant';
        
        if (isLastItem && role === 'user' && file) {
          if (file.base64) {
            // Vision support (OpenAI Vision specs compatible)
            messages.push({
              role: "user",
              content: [
                { type: "text", text: item.text || "Tolong bantu analisis gambar yang dilampirkan ini." },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${file.type};base64,${file.base64}`
                  }
                }
              ]
            });
          } else if (file.textData) {
            // Text file support
            const fileContext = `--- LAMPIRAN BERKAS: ${file.name} ---\n${file.textData}\n--- AKHIR BERKAS ---\n\n`;
            messages.push({
              role: "user",
              content: fileContext + (item.text || "Tolong jelaskan atau analisis isi berkas di atas.")
            });
          }
        } else {
          messages.push({
            role: role,
            content: item.text || ""
          });
        }
      });

      const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${deepseekApiKey}`
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages,
          temperature: temperature || 0.7,
          max_tokens: 4096,
          stream: true
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`DeepSeek API stream error ${response.status}: ${errText}`);
      }

      const body = response.body;
      if (!body) {
        throw new Error("No response body received from DeepSeek.");
      }

      const handleLineData = (line: string) => {
        const cleanLine = line.trim();
        if (!cleanLine) return;
        if (cleanLine === "data: [DONE]") return;
        if (cleanLine.startsWith("data: ")) {
          try {
            const json = JSON.parse(cleanLine.substring(6));
            const deltaText = json.choices?.[0]?.delta?.content || "";
            if (deltaText) {
              sendSSE('chunk', { text: deltaText });
            }
          } catch (err) {
            // JSON parse error or partial data chunk
          }
        }
      };

      if (typeof (body as any).getReader === "function") {
        const reader = (body as any).getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            handleLineData(line);
          }
        }
        if (buffer) {
          handleLineData(buffer);
        }
      } else {
        const decoder = new TextDecoder("utf-8");
        let buffer = "";
        for await (const chunk of body as any) {
          buffer += decoder.decode(chunk, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            handleLineData(line);
          }
        }
        if (buffer) {
          handleLineData(buffer);
        }
      }

      sendSSE('done', { success: true });
      res.end();

    } catch (error: any) {
      console.error("Stream error in server.ts:", error);
      sendSSE('error', { error: error.message || "Terjadi kesalahan koneksi API DeepSeek." });
      res.end();
    }
  });

  // Setup Vite Dev Server / Static files handler
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
