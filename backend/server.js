import express from "express";
import cors from "cors";

const app = express();
const PORT = 5050;

// Middleware
app.use(cors());
app.use(express.json());

// Root test route
app.get("/", (req, res) => {
  res.send("Student Helper backend running");
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Core /ask endpoint
app.post("/ask", (req, res) => {
  const { question } = req.body;

  if (!question || typeof question !== "string") {
    return res.status(400).json({
      answer: "Please enter a valid question.",
    });
  }

  // Normalize question
  let cleaned = question
    .toLowerCase()
    .replace("what is", "")
    .replace("calculate", "")
    .replace("solve", "")
    .replace("?", "")
    .trim();

  try {
    // Replace common math symbols
    cleaned = cleaned.replace(/x/g, "*").replace(/÷/g, "/");

    // Only allow numbers and math operators (safety)
    if (!/^[0-9+\-*/().\s]+$/.test(cleaned)) {
      throw new Error("Unsupported expression");
    }

    const result = eval(cleaned);

    res.json({
      answer: `Let's break this down step by step:\n\n${cleaned} = ${result}`,
    });
  } catch (error) {
    res.json({
      answer:
        "I can help explain this problem step by step, but I can't solve it automatically yet.",
    });
  }
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
