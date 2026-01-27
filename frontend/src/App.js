import { useState } from "react";

function App() {
  const [question, setQuestion] = useState("");
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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question }),
      });

      const data = await res.json();
      setAnswer(data.answer);
    } catch (err) {
      setAnswer("❌ Error connecting to backend");
    }
  };

  return (
    <div style={{ padding: 40, maxWidth: 600 }}>
      <h1>Student Helper</h1>

      <textarea
        rows="4"
        style={{ width: "100%" }}
        placeholder="Ask a question..."
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
      />

      <br />
      <br />

      <button onClick={askQuestion}>Ask</button>

      <p style={{ marginTop: 20, whiteSpace: "pre-line" }}>{answer}</p>
    </div>
  );
}

export default App;
