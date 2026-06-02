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
const OPENAI_BASE_URL =
  process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const ENABLE_WARMUP =
  String(process.env.GROQ_ENABLE_WARMUP || "").toLowerCase() === "true";
const CHAT_MODEL = process.env.GROQ_CHAT_MODEL || "llama-3.1-8b-instant";
const FAST_MODEL = process.env.GROQ_FAST_MODEL || CHAT_MODEL;
const PRO_MODEL = process.env.GROQ_PRO_MODEL || "openai/gpt-oss-20b";
const VISION_MODEL =
  process.env.GROQ_VISION_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct";
const OPENAI_API_KEY =
  process.env.OPENAI_API_KEY || process.env.AI_API_KEY || "";
const OPENAI_FAST_MODEL = process.env.OPENAI_FAST_MODEL || "gpt-4o-mini";
const OPENAI_PRO_MODEL = process.env.OPENAI_PRO_MODEL || "gpt-4o";
const OPENAI_VISION_MODEL =
  process.env.OPENAI_VISION_MODEL || OPENAI_FAST_MODEL;
const OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_CHAT_MODEL =
  process.env.OLLAMA_CHAT_MODEL || "llama3:latest";
const OLLAMA_VISION_MODEL =
  process.env.OLLAMA_VISION_MODEL || "llava:latest";
const REQUESTED_AI_PROVIDER = String(process.env.AI_PROVIDER || "")
  .trim()
  .toLowerCase();
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

function getAiProvider() {
  if (REQUESTED_AI_PROVIDER) {
    if (REQUESTED_AI_PROVIDER === "groq") {
      if (!process.env.GROQ_API_KEY) {
        throw new Error(
          "AI_PROVIDER is set to groq but GROQ_API_KEY is missing.",
        );
      }
      return "groq";
    }

    if (REQUESTED_AI_PROVIDER === "openai") {
      if (!OPENAI_API_KEY) {
        throw new Error(
          "AI_PROVIDER is set to openai but AI_API_KEY/OPENAI_API_KEY is missing.",
        );
      }
      return "openai";
    }

    if (REQUESTED_AI_PROVIDER === "ollama") {
      return "ollama";
    }

    throw new Error(
      "AI_PROVIDER must be one of: groq, openai, ollama.",
    );
  }

  if (process.env.GROQ_API_KEY) {
    return "groq";
  }

  return "ollama";

  if (OPENAI_API_KEY) {
    return "openai";
  }

  throw new Error(
    "Missing GROQ_API_KEY or AI_API_KEY/OPENAI_API_KEY. Add one to backend/.env before starting the server.",
  );
}

function getCapabilityConfig(tier, mode, useVision = false, assistant = {}) {
  const provider = getAiProvider();
  const isPro = normalizeTier(tier) === "pro";
  const assistantConfig = parseAssistantConfig(assistant);
  const shouldUseProModel =
    assistantConfig.model === "pro" && isPro && !useVision;
  const normalizedMode = normalizeMode(mode);
  const model = useVision
    ? provider === "groq"
      ? VISION_MODEL
      : provider === "openai"
        ? OPENAI_VISION_MODEL
        : OLLAMA_VISION_MODEL
    : shouldUseProModel
      ? provider === "groq"
        ? PRO_MODEL
        : provider === "openai"
          ? OPENAI_PRO_MODEL
          : OLLAMA_CHAT_MODEL
      : provider === "groq"
        ? FAST_MODEL
        : provider === "openai"
          ? OPENAI_FAST_MODEL
          : OLLAMA_CHAT_MODEL;

  return {
    provider,
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
    reasoningEffort:
      provider === "groq"
        ? getReasoningEffort(model, assistantConfig.reasoning)
        : null,
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

function getApiBaseUrl(provider) {
  if (provider === "groq") return GROQ_BASE_URL;
  if (provider === "openai") return OPENAI_BASE_URL;
  return OLLAMA_BASE_URL;
}

function getApiHeaders(provider) {
  if (provider === "ollama") {
    return {
      "Content-Type": "application/json",
    };
  }

  const apiKey =
    provider === "groq" ? process.env.GROQ_API_KEY : OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      provider === "groq"
        ? "Missing GROQ_API_KEY. Add it to backend/.env before starting the server."
        : "Missing AI_API_KEY or OPENAI_API_KEY. Add one to backend/.env before starting the server.",
    );
  }

  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

async function throwApiError(response, label) {
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
  if (config.provider === "ollama") {
    return {
      model: config.model,
      messages,
      stream,
      options: {
        temperature: config.temperature,
        top_p: config.topP,
        num_predict: config.maxCompletionTokens,
      },
    };
  }

  const payload = {
    model: config.model,
    messages,
    temperature: config.temperature,
    top_p: config.topP,
    stream,
  };

  if (config.provider === "groq") {
    payload.max_completion_tokens = config.maxCompletionTokens;
  } else {
    payload.max_tokens = config.maxCompletionTokens;
  }

  if (config.reasoningEffort) {
    payload.reasoning_effort = config.reasoningEffort;
  }

  return payload;
}

async function askChat(messages, config) {
  const endpoint =
    config.provider === "ollama" ? "/api/chat" : "/chat/completions";
  const response = await fetch(`${getApiBaseUrl(config.provider)}${endpoint}`, {
    method: "POST",
    headers: getApiHeaders(config.provider),
    body: JSON.stringify(buildChatPayload(messages, config, false)),
  });

  if (!response.ok) {
    await throwApiError(
      response,
      config.provider === "groq" ? "Groq chat error" : "OpenAI chat error",
    );
  }

  const data = await response.json();
  if (config.provider === "ollama") {
    return data?.message?.content?.trim() || "";
  }
  return data?.choices?.[0]?.message?.content?.trim() || "";
}

async function streamChatResponse(messages, config, onChunk) {
  const endpoint =
    config.provider === "ollama" ? "/api/chat" : "/chat/completions";
  const response = await fetch(`${getApiBaseUrl(config.provider)}${endpoint}`, {
    method: "POST",
    headers: getApiHeaders(config.provider),
    body: JSON.stringify(buildChatPayload(messages, config, true)),
  });

  if (!response.ok) {
    await throwApiError(
      response,
      config.provider === "groq" ? "Groq chat error" : "OpenAI chat error",
    );
  }

  let buffer = "";

  for await (const chunk of response.body) {
    buffer += chunk.toString("utf8");
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        continue;
      }

      if (config.provider !== "ollama") {
        if (line.startsWith(":") || !line.startsWith("data:")) {
          continue;
        }
      }

      const data =
        config.provider === "ollama" ? line : line.slice(5).trim();
      if (!data) continue;
      if (data === "[DONE]") return;

      const parsed = JSON.parse(data);
      const delta =
        config.provider === "ollama"
          ? parsed?.message?.content
          : parsed?.choices?.[0]?.delta?.content;
      if (typeof delta === "string" && delta) {
        onChunk(delta);
      }

      if (config.provider === "ollama" && parsed?.done) {
        return;
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

  if (config.provider === "ollama") {
    const rawBase64 = imageDataUrl.includes(";base64,")
      ? imageDataUrl.split(";base64,")[1]
      : imageDataUrl;
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: getApiHeaders("ollama"),
      body: JSON.stringify({
        model: config.model,
        stream: false,
        messages: [
          {
            role: "system",
            content: buildChatSystemPrompt(mode, tier, assistant),
          },
          {
            role: "user",
            content: String(question || "").trim() || "Analyze this image.",
            images: [rawBase64],
          },
        ],
        options: {
          temperature: config.temperature,
          top_p: config.topP,
          num_predict: config.maxCompletionTokens,
        },
      }),
    });

    if (!response.ok) {
      await throwApiError(response, "Ollama vision error");
    }

    const data = await response.json();
    return data?.message?.content?.trim() || "";
  }

  if (config.provider === "openai") {
    const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: getApiHeaders("openai"),
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: "system",
            content: buildChatSystemPrompt(mode, tier, assistant),
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: String(question || "").trim() || "Analyze this image.",
              },
              {
                type: "image_url",
                image_url: {
                  url: imageDataUrl,
                },
              },
            ],
          },
        ],
        max_tokens: config.maxCompletionTokens,
        temperature: config.temperature,
        top_p: config.topP,
      }),
    });

    if (!response.ok) {
      await throwApiError(response, "OpenAI vision error");
    }

    const data = await response.json();
    return data?.choices?.[0]?.message?.content?.trim() || "";
  }

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
    headers: getApiHeaders("groq"),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    await throwApiError(response, "Groq vision error");
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
      let wroteAnyChunk = false;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders?.();

      await streamChatResponse(messages, config, (text) => {
        wroteAnyChunk = true;
        res.write(text);
      });

      if (!wroteAnyChunk) {
        throw new Error(
          "AI returned an empty response. Check your API key and model configuration.",
        );
      }

      res.end();
      return;
    }

    const answer = await askChat(messages, config);

    res.json({ answer });
  } catch (error) {
    if (stream) {
      if (!res.headersSent) {
        res.status(502).end(error?.message || "AI backend error");
      } else {
        res.write(
          `\n[AI error] ${error?.message || "AI backend error"}`.trim(),
        );
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
    await askChat(
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
