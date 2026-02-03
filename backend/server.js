import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import multer from "multer";
import fs from "fs";

const app = express();
const PORT = 5050;

app.use(cors());
app.use(express.json());

const upload = multer({ dest: "uploads/" });

app.get("/", (_, res) => {
  res.send("Student Helper AI backend running");
});

/* ---------- OLLAMA HELPER ---------- */
async function askOllama(payload) {
  const res = await fetch("http://localhost:11434/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.response;
}

/* ---------- TEXT CHAT ---------- */
app.post("/chat", async (req, res) => {
  const { message, mode } = req.body;

  let systemPrompt = "";

  if (mode === "Answer") {
    systemPrompt =
      "Give the shortest, most direct answer possible. Do not explain unless asked.";
  }

  if (mode === "Tutor") {
    systemPrompt =
      "Explain step by step. Be patient and educational. Encourage questions.";
  }

  if (mode === "Math") {
    systemPrompt =
      "Solve the math problem. Show all steps clearly and explain formulas.";
  }

  try {
    const answer = await askOllama({
      model: "llama3",
      prompt: `${systemPrompt}\n\nUser question:\n${message}`,
      stream: false,
    });

    res.json({ answer });
  } catch (error) {
    res.status(502).json({
      error: "AI backend error",
      detail: error?.message || "Unknown error",
    });
  }
});

/* ---------- FLASHCARDS ---------- */
app.post("/flashcards", async (req, res) => {
  const { notes, count } = req.body;
  const safeCount = Math.min(Math.max(Number(count) || 12, 6), 50);

  const prompt = [
    `Create ${safeCount} concise study flashcards from the notes below.`,
    "Format strictly as:",
    "Q: question",
    "A: answer",
    "Repeat for each card. Keep answers short and factual.",
    "Avoid duplicates.",
    "",
    "Notes:",
    notes || "",
  ].join("\n");

  try {
    const cards = await askOllama({
      model: "llama3",
      prompt,
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

/* ---------- SLIDES ---------- */
app.post("/slides", async (req, res) => {
  const { notes } = req.body;

  const prompt = [
    "Turn the notes into slide content.",
    "Format strictly as:",
    "Slide 1: Title",
    "- bullet",
    "- bullet",
    "Slide 2: Title",
    "- bullet",
    "",
    "Notes:",
    notes || "",
  ].join("\n");

  try {
    const slides = await askOllama({
      model: "llama3",
      prompt,
      stream: false,
    });

    res.json({ slides });
  } catch (error) {
    res.status(502).json({
      error: "AI backend error",
      detail: error?.message || "Unknown error",
    });
  }
});

/* ---------- IMAGE / VISION CHAT ---------- */
app.post("/vision", upload.single("image"), async (req, res) => {
  const { question, mode } = req.body;
  if (!req.file) {
    return res.status(400).json({ error: "Image file is required." });
  }

  const imagePath = req.file.path;
  let imageBase64 = "";

  try {
    imageBase64 = fs.readFileSync(imagePath, "base64");
  } catch (error) {
    return res.status(500).json({
      error: "Failed to read uploaded image.",
      detail: error?.message || "Unknown error",
    });
  }

  let systemPrompt = "";

  if (mode === "Answer") {
    systemPrompt = "Give a direct answer based on the image.";
  }

  if (mode === "Tutor") {
    systemPrompt = "Explain step by step using the image.";
  }

  if (mode === "Math") {
    systemPrompt = "Solve the math problem shown. Show all steps.";
  }

  try {
    const answer = await askOllama({
      model: "llava",
      prompt: `${systemPrompt}\n\nUser question:\n${question || "Analyze this image."}`,
      images: [imageBase64],
      stream: false,
    });

    res.json({ answer });
  } catch (error) {
    res.status(502).json({
      error: "AI backend error",
      detail: error?.message || "Unknown error",
    });
  } finally {
    try {
      fs.unlinkSync(imagePath);
    } catch {
      // best-effort cleanup
    }
  }
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
