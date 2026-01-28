import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

console.log("AI KEY LOADED:", process.env.AI_API_KEY ? "YES" : "NO");

const app = express();
const PORT = 5050;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Student Helper AI backend running");
});

// ---------- REAL AI FUNCTION ----------
async function askAI(question, mode, grade) {
  const systemPrompt =
    mode === "answer"
      ? "Give a short, direct answer."
      : mode === "practice"
        ? "Give 3 practice questions only."
        : grade === "high"
          ? "Explain clearly at a high school level."
          : "Explain clearly at a middle school level.";

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.AI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: question },
      ],
      temperature: 0.4,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// ---------- MAIN ENDPOINT ----------
app.post("/ask", async (req, res) => {
  const { question, mode = "tutor", grade = "middle" } = req.body;

  if (!question) {
    return res.json({ answer: "Please enter a question." });
  }

  // 1️⃣ Try math FIRST (only if it looks like math)
  const mathCandidate = question
    .toLowerCase()
    .replace("what is", "")
    .replace("?", "")
    .replace(/x/g, "*")
    .replace(/÷/g, "/")
    .trim();

  if (/^[0-9+\-*/().\s]+$/.test(mathCandidate)) {
    try {
      const result = eval(mathCandidate);

      if (mode === "answer") {
        return res.json({ answer: `${result}` });
      }

      if (mode === "practice") {
        return res.json({
          answer:
            grade === "high"
              ? "Try these:\n1) 7 × 8\n2) 12 ÷ 3\n3) 9 × 6"
              : "Try these:\n1) 4 × 5\n2) 6 × 3\n3) 10 ÷ 2",
        });
      }

      return res.json({
        answer: `Let's break it down step by step:\n${mathCandidate} = ${result}`,
      });
    } catch {
      // If math eval fails, fall through to AI
    }
  }

  // 2️⃣ EVERYTHING ELSE → REAL AI
  try {
    const aiAnswer = await askAI(question, mode, grade);
    res.json({ answer: aiAnswer });
  } catch (err) {
    console.error("AI ERROR:", err.message);
    res.json({
      answer: "There was an error contacting the AI. Try again.",
    });
  }
});

// ---------- START SERVER ----------
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
