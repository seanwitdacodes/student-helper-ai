import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import multer from "multer";
import fs from "fs";

const app = express();
const PORT = 5050;
const CHAT_MODEL = process.env.OLLAMA_CHAT_MODEL || "llama3";
const FAST_MODEL = process.env.OLLAMA_FAST_MODEL || CHAT_MODEL;
const PRO_MODEL = process.env.OLLAMA_PRO_MODEL || CHAT_MODEL;
const VISION_MODEL = process.env.OLLAMA_VISION_MODEL || "llava";
const REGULAR_MODE = "regular";
const COMPUTER_MODE = "computer";
const DEFAULT_ASSISTANT_CONFIG = {
  model: "fast",
  reasoning: "balanced",
};

app.use(cors());
app.use(express.json());

const upload = multer({ dest: "uploads/" });

app.get("/", (_, res) => {
  res.send("Student Helper AI backend running");
});

async function askOllama(payload) {
  const res = await fetch("http://localhost:11434/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      keep_alive: "30m",
      ...payload,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.response;
}

async function streamOllamaResponse(payload, onChunk) {
  const res = await fetch("http://localhost:11434/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      keep_alive: "30m",
      ...payload,
      stream: true,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama error ${res.status}: ${text}`);
  }

  let buffer = "";

  for await (const chunk of res.body) {
    buffer += chunk.toString("utf8");
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;

      const parsed = JSON.parse(line);
      if (parsed.response) {
        onChunk(parsed.response);
      }

      if (parsed.done) {
        return;
      }
    }
  }

  if (!buffer.trim()) return;

  const parsed = JSON.parse(buffer);
  if (parsed.response) {
    onChunk(parsed.response);
  }
}

function safeDelete(path) {
  if (!path) return;
  try {
    fs.unlinkSync(path);
  } catch {
    // best-effort cleanup
  }
}

function normalizeTier(value) {
  return value === "pro" || value === "trial" ? "pro" : "free";
}

function normalizeMode(value) {
  if (value === COMPUTER_MODE || value === "Control" || value === "Automation") {
    return COMPUTER_MODE;
  }
  return REGULAR_MODE;
}

function parseAssistantConfig(raw) {
  if (!raw) {
    return { ...DEFAULT_ASSISTANT_CONFIG };
  }

  if (typeof raw === "string") {
    try {
      return parseAssistantConfig(JSON.parse(raw));
    } catch {
      return { ...DEFAULT_ASSISTANT_CONFIG };
    }
  }

  return {
    model: raw.model === "pro" ? "pro" : "fast",
    reasoning:
      raw.reasoning === "deep" ? "deep" : raw.reasoning === "balanced" ? "balanced" : "fast",
  };
}

function getCapabilityConfig(tier, mode, useVision = false, assistant = {}) {
  const isPro = normalizeTier(tier) === "pro";
  const assistantConfig = parseAssistantConfig(assistant);
  const shouldUseProModel = assistantConfig.model === "pro" && isPro && !useVision;
  const normalizedMode = normalizeMode(mode);

  return {
    model: useVision ? VISION_MODEL : shouldUseProModel ? PRO_MODEL : FAST_MODEL,
    options: {
      temperature: useVision ? 0.2 : normalizedMode === COMPUTER_MODE ? 0.15 : 0.35,
      top_p: 0.9,
      num_ctx:
        assistantConfig.reasoning === "deep" ? (isPro ? 8192 : 6144) : isPro ? 6144 : 4096,
      num_predict: useVision ? (isPro ? 260 : 180) : normalizedMode === COMPUTER_MODE ? (isPro ? 320 : 220) : isPro ? 280 : 180,
    },
  };
}

function buildChatSystemPrompt(mode, tier, assistant = {}) {
  const isPro = normalizeTier(tier) === "pro";
  const normalizedMode = normalizeMode(mode);
  const assistantConfig = parseAssistantConfig(assistant);

  const common = [
    isPro
      ? "You are Student Helper Pro AI, a fast local assistant for school, work, and computer tasks."
      : "You are Student Helper AI, a fast local assistant for school, work, and everyday tasks.",
    "Be clear, accurate, direct, and practical.",
    "Be honest about limitations. Do not claim to browse the web, inspect local files, or control the device unless the result of that action is actually available in the conversation.",
    assistantConfig.reasoning === "deep"
      ? "Think carefully when needed, but keep the final answer concise."
      : assistantConfig.reasoning === "balanced"
      ? "Balance speed with a small amount of structure."
      : "Prefer the fastest correct answer.",
  ].join(" ");

  if (normalizedMode === COMPUTER_MODE) {
    return `${common} You are in Computer Mode. Focus on commands, system actions, app workflows, debugging steps, and clear instructions for doing tasks on a computer. If you are not actually connected to a control tool, say that you are giving guidance rather than taking the action yourself.`;
  }

  return `${common} You are in Regular AI mode. Help with questions, writing, brainstorming, studying, coding guidance, and image-based follow-up questions when an image is attached.`;
}

app.post("/chat", async (req, res) => {
  const { message, mode, tier, assistant, stream } = req.body;
  const assistantConfig = parseAssistantConfig(assistant);
  const normalizedMode = normalizeMode(mode);
  const config = getCapabilityConfig(tier, normalizedMode, false, assistantConfig);
  const prompt = `${buildChatSystemPrompt(normalizedMode, tier, assistantConfig)}\n\nUser message:\n${message || ""}`;

  try {
    if (stream) {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders?.();

      await streamOllamaResponse(
        {
          model: config.model,
          prompt,
          options: config.options,
        },
        (text) => {
          res.write(text);
        },
      );

      res.end();
      return;
    }

    const answer = await askOllama({
      model: config.model,
      prompt,
      options: config.options,
      stream: false,
    });

    res.json({ answer });
  } catch (error) {
    if (stream) {
      if (!res.headersSent) {
        res.status(502).end("AI backend error");
      } else {
        res.end();
      }
      return;
    }

    res.status(502).json({
      error: "AI backend error",
      detail: error?.message || "Unknown error",
    });
  }
});

app.post("/warmup", async (req, res) => {
  const tier = req.body?.tier;
  const mode = req.body?.mode;
  const assistantConfig = parseAssistantConfig(req.body?.assistant);
  const config = getCapabilityConfig(tier, normalizeMode(mode), false, assistantConfig);

  try {
    await askOllama({
      model: config.model,
      prompt: "Reply with OK.",
      options: {
        ...config.options,
        num_predict: 1,
      },
      stream: false,
    });

    res.json({ ok: true });
  } catch {
    res.status(204).end();
  }
});

app.post("/vision", upload.single("image"), async (req, res) => {
  const { question, mode, tier } = req.body;
  const assistantConfig = parseAssistantConfig(req.body?.assistant);
  if (!req.file) {
    return res.status(400).json({ error: "Image file is required." });
  }

  const imagePath = req.file.path;
  let imageBase64 = "";

  try {
    imageBase64 = fs.readFileSync(imagePath, "base64");
  } catch (error) {
    safeDelete(imagePath);
    return res.status(500).json({
      error: "Failed to read uploaded image.",
      detail: error?.message || "Unknown error",
    });
  }

  try {
    const normalizedMode = normalizeMode(mode);
    const config = getCapabilityConfig(tier, normalizedMode, true, assistantConfig);
    const answer = await askOllama({
      model: config.model,
      prompt: `${buildChatSystemPrompt(normalizedMode, tier, assistantConfig)}\n\nUser request:\n${
        question || "Analyze this image."
      }`,
      images: [imageBase64],
      options: config.options,
      stream: false,
    });

    res.json({ answer });
  } catch (error) {
    res.status(502).json({
      error: "AI backend error",
      detail: error?.message || "Unknown error",
    });
  } finally {
    safeDelete(imagePath);
  }
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
