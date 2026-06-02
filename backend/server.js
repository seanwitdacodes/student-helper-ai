import "dotenv/config";
import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import multer from "multer";
import fs from "fs";

const app = express();
const PORT = Number(process.env.PORT) || 5050;
const GROQ_BASE_URL =
  process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1";
const ENABLE_WARMUP =
  String(process.env.GROQ_ENABLE_WARMUP || "").toLowerCase() === "true";
const CHAT_MODEL = process.env.GROQ_CHAT_MODEL || "llama-3.1-8b-instant";
const FAST_MODEL = process.env.GROQ_FAST_MODEL || CHAT_MODEL;
const PRO_MODEL = process.env.GROQ_PRO_MODEL || "openai/gpt-oss-20b";
const VISION_MODEL =
  process.env.GROQ_VISION_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct";
const REGULAR_MODE = "regular";
const COMPUTER_MODE = "computer";
const DEFAULT_ASSISTANT_CONFIG = {
  model: "fast",
  reasoning: "fast",
};

const OUTPUT_LIMITS = {
  vision: {
    fast: { free: 120, pro: 160 },
    balanced: { free: 160, pro: 220 },
    deep: { free: 220, pro: 280 },
  },
  regular: {
    fast: { free: 128, pro: 192 },
    balanced: { free: 192, pro: 256 },
    deep: { free: 280, pro: 360 },
  },
  computer: {
    fast: { free: 160, pro: 220 },
    balanced: { free: 220, pro: 300 },
    deep: { free: 320, pro: 420 },
  },
};

app.use(cors());
app.use(express.json());

const upload = multer({ dest: "uploads/" });

app.get("/", (_, res) => {
  res.send("Operator AI backend running");
});

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
  if (
    value === COMPUTER_MODE ||
    value === "Control" ||
    value === "Automation"
  ) {
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
      raw.reasoning === "deep"
        ? "deep"
        : raw.reasoning === "balanced"
          ? "balanced"
          : "fast",
  };
}

function getOutputLimit(reasoning, isPro, useVision, mode) {
  const profileKey = useVision
    ? "vision"
    : mode === COMPUTER_MODE
      ? "computer"
      : "regular";
  const profile =
    OUTPUT_LIMITS[profileKey]?.[reasoning] || OUTPUT_LIMITS[profileKey]?.fast;
  return isPro ? profile.pro : profile.free;
}

function getReasoningEffort(model, reasoning) {
  if (model.startsWith("openai/gpt-oss-")) {
    return reasoning === "deep"
      ? "high"
      : reasoning === "balanced"
        ? "medium"
        : "low";
  }

  if (model.startsWith("qwen/")) {
    return reasoning === "deep"
      ? "high"
      : reasoning === "balanced"
        ? "medium"
        : "low";
  }

  return null;
}

function getCapabilityConfig(tier, mode, useVision = false, assistant = {}) {
  const isPro = normalizeTier(tier) === "pro";
  const assistantConfig = parseAssistantConfig(assistant);
  const shouldUseProModel =
    assistantConfig.model === "pro" && isPro && !useVision;
  const normalizedMode = normalizeMode(mode);
  const model = useVision
    ? VISION_MODEL
    : shouldUseProModel
      ? PRO_MODEL
      : FAST_MODEL;

  return {
    model,
    temperature: useVision
      ? 0.2
      : normalizedMode === COMPUTER_MODE
        ? 0.15
        : 0.35,
    topP: 0.9,
    maxCompletionTokens: getOutputLimit(
      assistantConfig.reasoning,
      isPro,
      useVision,
      normalizedMode,
    ),
    reasoningEffort: getReasoningEffort(model, assistantConfig.reasoning),
  };
}

function buildChatSystemPrompt(mode, tier, assistant = {}) {
  const isPro = normalizeTier(tier) === "pro";
  const normalizedMode = normalizeMode(mode);
  const assistantConfig = parseAssistantConfig(assistant);

  const common = [
    isPro
      ? "You are Operator AI Pro, a fast assistant for school, work, and computer tasks."
      : "You are Operator AI, a fast assistant for school, work, and everyday tasks.",
    "Be clear, accurate, direct, and practical.",
    "Be honest about limitations. Do not claim to browse the web, inspect local files, or control the device unless the result of that action is actually available in the conversation.",
    assistantConfig.reasoning === "deep"
      ? "Think carefully when needed, but keep the final answer concise."
      : assistantConfig.reasoning === "balanced"
        ? "Balance speed with a small amount of structure."
        : "Prefer the fastest correct answer and avoid unnecessary detail.",
  ].join(" ");

  if (normalizedMode === COMPUTER_MODE) {
    return `${common} You are in Computer Control. Focus on commands, system actions, app workflows, debugging steps, and clear instructions for doing tasks on a computer. If you are not actually connected to a control tool, say that you are giving guidance rather than taking the action yourself.`;
  }

  return `${common} You are in Regular AI mode. Help with questions, writing, brainstorming, studying, coding guidance, and image-based follow-up questions when an image is attached.`;
}

function getGroqApiKey() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing GROQ_API_KEY. Add it to backend/.env before starting the server.",
    );
  }
  return apiKey;
}

function getGroqHeaders() {
  return {
    Authorization: `Bearer ${getGroqApiKey()}`,
    "Content-Type": "application/json",
  };
}

async function throwGroqError(response, label) {
  const text = await response.text();
  throw new Error(`${label} ${response.status}: ${text}`);
}

function buildChatMessages(message, mode, tier, assistant = {}) {
  return [
    { role: "system", content: buildChatSystemPrompt(mode, tier, assistant) },
    { role: "user", content: String(message || "").trim() || "Hello." },
  ];
}

function buildChatPayload(messages, config, stream = false) {
  const payload = {
    model: config.model,
    messages,
    temperature: config.temperature,
    top_p: config.topP,
    max_completion_tokens: config.maxCompletionTokens,
    stream,
  };

  if (config.reasoningEffort) {
    payload.reasoning_effort = config.reasoningEffort;
  }

  return payload;
}

async function askGroqChat(messages, config) {
  const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: getGroqHeaders(),
    body: JSON.stringify(buildChatPayload(messages, config, false)),
  });

  if (!response.ok) {
    await throwGroqError(response, "Groq chat error");
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content?.trim() || "";
}

async function streamGroqChatResponse(messages, config, onChunk) {
  const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: getGroqHeaders(),
    body: JSON.stringify(buildChatPayload(messages, config, true)),
  });

  if (!response.ok) {
    await throwGroqError(response, "Groq chat error");
  }

  let buffer = "";

  for await (const chunk of response.body) {
    buffer += chunk.toString("utf8");
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith(":") || !line.startsWith("data:")) {
        continue;
      }

      const data = line.slice(5).trim();
      if (!data) continue;
      if (data === "[DONE]") return;

      const parsed = JSON.parse(data);
      const delta = parsed?.choices?.[0]?.delta?.content;
      if (typeof delta === "string" && delta) {
        onChunk(delta);
      }
    }
  }
}

function extractResponseText(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const textParts = [];
  for (const item of Array.isArray(data?.output) ? data.output : []) {
    if (!Array.isArray(item?.content)) continue;

    for (const contentItem of item.content) {
      if (
        contentItem?.type === "output_text" &&
        typeof contentItem.text === "string"
      ) {
        textParts.push(contentItem.text);
      }
    }
  }

  return textParts.join("\n\n").trim();
}

async function askGroqVision(
  question,
  imageDataUrl,
  mode,
  tier,
  assistant = {},
) {
  const config = getCapabilityConfig(tier, mode, true, assistant);
  const payload = {
    model: config.model,
    instructions: buildChatSystemPrompt(mode, tier, assistant),
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: String(question || "").trim() || "Analyze this image.",
          },
          {
            type: "input_image",
            image_url: imageDataUrl,
            detail: "auto",
          },
        ],
      },
    ],
    max_output_tokens: config.maxCompletionTokens,
    temperature: config.temperature,
    top_p: config.topP,
  };

  if (config.reasoningEffort) {
    payload.reasoning = { effort: config.reasoningEffort };
  }

  const response = await fetch(`${GROQ_BASE_URL}/responses`, {
    method: "POST",
    headers: getGroqHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    await throwGroqError(response, "Groq vision error");
  }

  const data = await response.json();
  return extractResponseText(data);
}

app.post("/chat", async (req, res) => {
  const { message, mode, tier, assistant, stream } = req.body;
  const assistantConfig = parseAssistantConfig(assistant);
  const normalizedMode = normalizeMode(mode);
  const config = getCapabilityConfig(
    tier,
    normalizedMode,
    false,
    assistantConfig,
  );
  const messages = buildChatMessages(
    message,
    normalizedMode,
    tier,
    assistantConfig,
  );

  try {
    if (stream) {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders?.();

      await streamGroqChatResponse(messages, config, (text) => {
        res.write(text);
      });

      res.end();
      return;
    }

    const answer = await askGroqChat(messages, config);

    res.json({ answer });
  } catch (error) {
    if (stream) {
      if (!res.headersSent) {
        res.status(502).end(error?.message || "AI backend error");
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
  if (!ENABLE_WARMUP) {
    return res.status(204).end();
  }

  const tier = req.body?.tier;
  const mode = req.body?.mode;
  const assistantConfig = parseAssistantConfig(req.body?.assistant);
  const config = getCapabilityConfig(
    tier,
    normalizeMode(mode),
    false,
    assistantConfig,
  );

  try {
    await askGroqChat(
      buildChatMessages(
        "Reply with OK.",
        normalizeMode(mode),
        tier,
        assistantConfig,
      ),
      {
        ...config,
        maxCompletionTokens: 1,
      },
    );

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
    const answer = await askGroqVision(
      question,
      `data:${req.file.mimetype};base64,${imageBase64}`,
      normalizedMode,
      tier,
      assistantConfig,
    );

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
