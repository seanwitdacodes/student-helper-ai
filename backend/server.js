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

  const answer = await askOllama({
    model: "llama3",
    prompt: `${systemPrompt}\n\nUser question:\n${message}`,
    stream: false,
  });

  res.json({ answer });
});

/* ---------- IMAGE / VISION CHAT ---------- */
app.post("/vision", upload.single("image"), async (req, res) => {
  const { question, mode } = req.body;
  const imagePath = req.file.path;

  const imageBase64 = fs.readFileSync(imagePath, "base64");

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

  const answer = await askOllama({
    model: "llava",
    prompt: `${systemPrompt}\n\nUser question:\n${question || "Analyze this image."}`,
    images: [imageBase64],
    stream: false,
  });

  fs.unlinkSync(imagePath); // delete uploaded image

  res.json({ answer });
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
