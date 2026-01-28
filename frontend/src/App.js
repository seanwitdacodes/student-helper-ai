import { useState } from "react";
import "./App.css";

function App() {
  const [question, setQuestion] = useState("");
  const [mode, setMode] = useState("tutor");
  const [grade, setGrade] = useState("middle");
  const [answer, setAnswer] = useState("");

  const askQuestion = async () => {
    if (!question.trim()) {
      setAnswer("Please enter a question.");
      return;
    }

    setAnswer("Thinking...");

    try {
      const res = await fetch("http://localhost:5050/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, mode, grade }),
      });

      const data = await res.json();
      setAnswer(data.answer);
    } catch {
      setAnswer("❌ Error connecting to backend.");
    }
  };

  return (
    <div className="app">
      <div className="card">
        <h1>Student Helper AI</h1>
        <p className="subtitle">Learn smarter, not harder.</p>

        <label>Mode</label>
        <select value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="tutor">Tutor Mode</option>
          <option value="answer">Answer Mode</option>
          <option value="practice">Practice Mode</option>
        </select>

        <label>Grade Level</label>
        <select value={grade} onChange={(e) => setGrade(e.target.value)}>
          <option value="middle">Middle School</option>
          <option value="high">High School</option>
        </select>

        <textarea
          placeholder="Ask a question (e.g. What is 3 × 3?)"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />

        <button onClick={askQuestion}>Ask</button>

        {answer && (
          <div className="answer-box">
            <pre>{answer}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
