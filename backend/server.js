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
        onChunk(parsed.response, parsed);
      }

      if (parsed.done) {
        return;
      }
    }
  }

  if (!buffer.trim()) return;

  const parsed = JSON.parse(buffer);
  if (parsed.response) {
    onChunk(parsed.response, parsed);
  }
}

function cleanJsonCandidate(text) {
  const fenced = String(text || "").match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fenced ? fenced[1].trim() : String(text || "").trim();
}

function extractJson(text) {
  const source = cleanJsonCandidate(text);
  const startCandidates = [source.indexOf("{"), source.indexOf("[")].filter((n) => n >= 0);

  if (!startCandidates.length) return null;

  const start = Math.min(...startCandidates);
  const open = source[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < source.length; i += 1) {
    const char = source[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === open) depth += 1;
    if (char === close) depth -= 1;

    if (depth === 0) {
      const candidate = source.slice(start, i + 1);
      try {
        return JSON.parse(candidate);
      } catch {
        return null;
      }
    }
  }

  return null;
}

function safeDelete(path) {
  if (!path) return;
  try {
    fs.unlinkSync(path);
  } catch {
    // best-effort cleanup
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeTier(value) {
  return value === "pro" || value === "trial" ? "pro" : "free";
}

function parseAssistantConfig(raw) {
  if (!raw) {
    return { model: "max", reasoning: "deep" };
  }

  if (typeof raw === "string") {
    try {
      return parseAssistantConfig(JSON.parse(raw));
    } catch {
      return { model: "max", reasoning: "deep" };
    }
  }

  return {
    model: typeof raw.model === "string" ? raw.model : "max",
    reasoning: typeof raw.reasoning === "string" ? raw.reasoning : "deep",
  };
}

function getChatCapability(mode) {
  if (mode === "Build") return "build";
  if (mode === "Research") return "research";
  if (mode === "Automation") return "automation";
  return "chat";
}

function getCapabilityConfig(tier, capability, useVision = false, assistant = {}) {
  const isPro = normalizeTier(tier) === "pro";
  const assistantConfig = parseAssistantConfig(assistant);
  const prefersFast = assistantConfig.model === "fast";
  const prefersBuilder = assistantConfig.model === "builder";
  const wantsDeepReasoning = assistantConfig.reasoning === "deep";

  const numPredictByCapability = {
    chat: isPro ? 320 : 160,
    build: isPro ? 900 : 420,
    research: isPro ? 1100 : 520,
    automation: isPro ? 850 : 420,
    flashcards: isPro ? 900 : 420,
    slides: isPro ? 1200 : 650,
    math: isPro ? 1000 : 520,
    vision: isPro ? 320 : 180,
  };

  return {
    model: useVision
      ? VISION_MODEL
      : prefersFast
      ? FAST_MODEL
      : prefersBuilder
      ? PRO_MODEL
      : isPro
      ? PRO_MODEL
      : FAST_MODEL,
    options: {
      temperature:
        capability === "research" ? 0.15 : capability === "chat" || capability === "vision" ? 0.2 : 0.25,
      top_p: 0.9,
      num_ctx: isPro ? (wantsDeepReasoning ? 10240 : 8192) : wantsDeepReasoning ? 6144 : 4096,
      num_predict: numPredictByCapability[capability] || 240,
    },
  };
}

function fallbackSlides(text) {
  const lines = String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const slides = [];
  let current = null;

  for (const line of lines) {
    const slideMatch = line.match(/^slide\s*\d+\s*:\s*(.+)$/i);
    if (slideMatch) {
      if (current) slides.push(current);
      current = {
        title: slideMatch[1],
        subtitle: "",
        bullets: [],
        speakerNotes: "",
        layout: "title-bullets",
      };
      continue;
    }

    if (line.startsWith("-") || line.startsWith("•")) {
      if (!current) {
        current = {
          title: "Untitled",
          subtitle: "",
          bullets: [],
          speakerNotes: "",
          layout: "title-bullets",
        };
      }
      current.bullets.push(line.replace(/^[-•]\s*/, ""));
      continue;
    }

    if (!current) {
      current = {
        title: line,
        subtitle: "",
        bullets: [],
        speakerNotes: "",
        layout: "title-bullets",
      };
      continue;
    }

    if (!current.subtitle) {
      current.subtitle = line;
    } else {
      current.bullets.push(line);
    }
  }

  if (current) slides.push(current);

  return {
    title: slides[0]?.title || "Presentation",
    subtitle: slides[0]?.subtitle || "",
    theme: "aurora",
    slides:
      slides.length > 0
        ? slides
        : [
            {
              title: "Presentation",
              subtitle: "Add notes and generate slides",
              bullets: ["Summarize the main idea", "Keep each slide concise"],
              speakerNotes: "",
              layout: "title-bullets",
            },
          ],
  };
}

function normalizeSlideDeck(rawText, parsedDeck) {
  if (!parsedDeck || typeof parsedDeck !== "object") {
    return fallbackSlides(rawText);
  }

  const slides = Array.isArray(parsedDeck.slides) ? parsedDeck.slides : [];
  const normalizedSlides = slides
    .map((slide, index) => ({
      title: String(slide?.title || `Slide ${index + 1}`).trim(),
      subtitle: String(slide?.subtitle || "").trim(),
      bullets: Array.isArray(slide?.bullets)
        ? slide.bullets.map((bullet) => String(bullet || "").trim()).filter(Boolean)
        : [],
      speakerNotes: String(slide?.speakerNotes || slide?.notes || "").trim(),
      layout: ["title-bullets", "split", "quote", "timeline"].includes(slide?.layout)
        ? slide.layout
        : "title-bullets",
    }))
    .filter((slide) => slide.title || slide.bullets.length || slide.subtitle);

  return {
    title: String(parsedDeck.title || normalizedSlides[0]?.title || "Presentation").trim(),
    subtitle: String(parsedDeck.subtitle || "").trim(),
    theme: ["aurora", "sunrise", "graphite", "campus"].includes(parsedDeck.theme)
      ? parsedDeck.theme
      : "aurora",
    slides:
      normalizedSlides.length > 0
        ? normalizedSlides
        : fallbackSlides(rawText).slides,
  };
}

function normalizeMathSolution(rawText, question) {
  const parsed = extractJson(rawText);
  const steps = Array.isArray(parsed?.steps)
    ? parsed.steps
        .map((step, index) => ({
          title: String(step?.title || `Step ${index + 1}`).trim(),
          explanation: String(step?.explanation || "").trim(),
        }))
        .filter((step) => step.title || step.explanation)
    : [];

  if (parsed && typeof parsed === "object") {
    return {
      title: String(parsed.title || "Math solution").trim(),
      detectedProblem: String(parsed.detectedProblem || question || "Uploaded math problem").trim(),
      finalAnswer: String(parsed.finalAnswer || "").trim(),
      summary: String(parsed.summary || "").trim(),
      steps,
      checks: Array.isArray(parsed.checks)
        ? parsed.checks.map((item) => String(item || "").trim()).filter(Boolean)
        : [],
      followUps: Array.isArray(parsed.followUps)
        ? parsed.followUps.map((item) => String(item || "").trim()).filter(Boolean)
        : [],
    };
  }

  const paragraphs = String(rawText || "")
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  return {
    title: "Math solution",
    detectedProblem: String(question || "Uploaded math problem").trim(),
    finalAnswer: paragraphs[0] || "Answer available in the explanation below.",
    summary: paragraphs[1] || "Step-by-step explanation generated by Student Helper AI.",
    steps: (paragraphs.slice(2).length ? paragraphs.slice(2) : paragraphs).slice(0, 6).map((part, index) => ({
      title: `Step ${index + 1}`,
      explanation: part,
    })),
    checks: [],
    followUps: ["Ask for a different solving method", "Ask for a simpler explanation"],
  };
}

function buildChatSystemPrompt(mode, tier, assistant = {}) {
  const isPro = normalizeTier(tier) === "pro";
  const assistantConfig = parseAssistantConfig(assistant);
  const common = [
    isPro
      ? "You are Student Helper Max AI, a local multi-capability workspace for building, research, tutoring, and student productivity."
      : "You are Student Helper AI, a local workspace for studying, building, and structured problem solving.",
    "You can help with reasoning, tutoring, product design, prompt systems, coding guidance, research-style summaries, automations, flashcards, slides, and image analysis when an image is attached.",
    "Be honest about limitations. Do not claim to browse the web, inspect files, run tools, or cite external sources unless the user has actually provided that material in the conversation.",
    assistantConfig.reasoning === "deep"
      ? "Use a deliberate reasoning style: think through tradeoffs, preserve context, and provide a stronger final answer."
      : assistantConfig.reasoning === "balanced"
      ? "Balance speed with structure and include the key tradeoffs when they matter."
      : "Prefer a fast, crisp answer and only expand when necessary.",
  ].join(" ");

  if (mode === "Answer") {
    return `${common} Give the answer first, then add one sharp supporting insight, shortcut, or edge case when useful.`;
  }

  if (mode === "Tutor") {
    return `${common} Teach clearly, step by step, with examples, common mistakes, and a short recap that helps a student retain the idea.`;
  }

  if (mode === "Build") {
    return `${common} Operate like a product-minded engineer and design partner. When the user asks for a feature, UI, or prompt system, organize the answer around outcome, implementation approach, tradeoffs, and the most useful next build step.`;
  }

  if (mode === "Research") {
    return `${common} Write like a research partner. Prefer sections such as Summary, Key Findings, Gaps, Risks, and Recommendation. If the user has not supplied sources, explicitly frame the answer as analysis based on the provided conversation rather than external citations.`;
  }

  if (mode === "Automation") {
    return `${common} Think like an automation designer. Break workflows into triggers, steps, safeguards, edge cases, and the final user-facing result.`;
  }

  if (mode === "Math") {
    return `${common} Solve the math problem step by step, verify the answer, and state the final answer clearly.`;
  }

  return `${common} Be clear, accurate, concise, and more useful than a generic assistant.`;
}

app.post("/chat", async (req, res) => {
  const { message, mode, tier, assistant, stream } = req.body;
  const assistantConfig = parseAssistantConfig(assistant);
  const capability = getChatCapability(mode);
  const config = getCapabilityConfig(tier, capability, false, assistantConfig);
  const prompt = `${buildChatSystemPrompt(mode, tier, assistantConfig)}\n\nStudent question:\n${message || ""}`;

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
  const config = getCapabilityConfig(tier, "chat");

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

app.post("/flashcards", async (req, res) => {
  const { notes, count, tier } = req.body;
  const isPro = normalizeTier(tier) === "pro";
  const safeCount = clamp(Number(count) || 12, 6, isPro ? 50 : 12);
  const config = getCapabilityConfig(tier, "flashcards");

  const prompt = [
    `Create ${safeCount} high-quality study flashcards from the notes below.`,
    "Rules:",
    "- Cover definitions, cause/effect, examples, and key facts when possible.",
    "- Keep each answer under 28 words unless the concept truly requires more.",
    "- Avoid duplicates or trivial wording changes.",
    ...(isPro
      ? [
          "- Include a mix of definitions, application questions, and contrast/comparison prompts.",
          "- Favor stronger conceptual coverage and memory cues.",
        ]
      : ["- Keep the deck focused on the most important study points."]),
    '- Output only in this exact repeated format: "Q: ..." then "A: ..."',
    "",
    "Notes:",
    notes || "",
  ].join("\n");

  try {
    const cards = await askOllama({
      model: config.model,
      prompt,
      options: config.options,
      stream: false,
    });

    res.json({ cards });
  } catch (error) {
    res.status(502).json({
      error: "AI backend error",
      detail: error?.message || "Unknown error",
    });
  }
});

app.post("/slides", async (req, res) => {
  const { notes, slideCount, tier } = req.body;
  const isPro = normalizeTier(tier) === "pro";
  const safeCount = clamp(Number(slideCount) || 6, 3, isPro ? 12 : 6);
  const config = getCapabilityConfig(tier, "slides");

  const prompt = [
    `Turn the notes into a ${safeCount}-slide presentation.`,
    "Return strict JSON with this shape:",
    '{',
    '  "title": "Deck title",',
    '  "subtitle": "Short subtitle",',
    '  "theme": "aurora",',
    '  "slides": [',
    "    {",
    '      "title": "Slide title",',
    '      "subtitle": "Optional subtitle",',
    '      "bullets": ["3 to 5 concise bullets"],',
    '      "speakerNotes": "1 to 2 sentences of presenter notes",',
    '      "layout": "title-bullets"',
    "    }",
    "  ]",
    '}',
    'Allowed layouts: "title-bullets", "split", "quote", "timeline".',
    isPro
      ? "Use polished presentation-ready wording, with speaker notes that feel prepared for a real presentation."
      : "Use concise, presentation-ready wording.",
    "",
    "Notes:",
    notes || "",
  ].join("\n");

  try {
    const rawSlides = await askOllama({
      model: config.model,
      prompt,
      options: config.options,
      stream: false,
    });

    const deck = normalizeSlideDeck(rawSlides, extractJson(rawSlides));
    res.json({ slides: rawSlides, deck });
  } catch (error) {
    res.status(502).json({
      error: "AI backend error",
      detail: error?.message || "Unknown error",
    });
  }
});

app.post("/math-solve", upload.single("image"), async (req, res) => {
  const question = String(req.body?.question || "").trim();
  const tier = req.body?.tier;
  const assistantConfig = parseAssistantConfig(req.body?.assistant);
  const imagePath = req.file?.path;
  const isPro = normalizeTier(tier) === "pro";

  if (!question && !imagePath) {
    return res.status(400).json({ error: "A question or math image is required." });
  }

  let imageBase64 = "";

  if (imagePath) {
    try {
      imageBase64 = fs.readFileSync(imagePath, "base64");
    } catch (error) {
      safeDelete(imagePath);
      return res.status(500).json({
        error: "Failed to read uploaded image.",
        detail: error?.message || "Unknown error",
      });
    }
  }

  const prompt = [
    isPro
      ? "You are Student Helper Pro AI solving a student math problem with deeper verification."
      : "You are Student Helper AI solving a student math problem.",
    "Read the problem carefully, then solve it.",
    "Return strict JSON with this shape:",
    "{",
    '  "title": "Short label",',
    '  "detectedProblem": "Restate the problem clearly",',
    '  "finalAnswer": "Final answer only",',
    '  "summary": "Very short summary of the approach",',
    '  "steps": [{"title": "Step 1", "explanation": "Detailed explanation"}],',
    '  "checks": ["How to verify the answer"],',
    '  "followUps": ["Helpful next question a student might ask"]',
    "}",
    isPro
      ? "Keep steps concrete, show the work, include verification ideas, and add better follow-up suggestions."
      : "Keep steps concrete and show the work.",
    "",
    "Student request:",
    question || "Solve the math problem shown in the image.",
  ].join("\n");

  const config = getCapabilityConfig(tier, "math", Boolean(imageBase64), assistantConfig);

  try {
    const raw = await askOllama({
      model: config.model,
      prompt,
      images: imageBase64 ? [imageBase64] : undefined,
      options: config.options,
      stream: false,
    });

    const solution = normalizeMathSolution(raw, question);
    res.json({ solution, raw });
  } catch (error) {
    res.status(502).json({
      error: "AI backend error",
      detail: error?.message || "Unknown error",
    });
  } finally {
    safeDelete(imagePath);
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
    const config = getCapabilityConfig(tier, "vision", true, assistantConfig);
    const answer = await askOllama({
      model: config.model,
      prompt: `${buildChatSystemPrompt(mode, tier, assistantConfig)}\n\nStudent request:\n${question || "Analyze this image."}`,
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
