import { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import ChatInput from "./components/ChatInput";
import Flashcards from "./components/Flashcards";
import Slides from "./components/Slides";
import "./App.css";

function App() {
  const [mode, setMode] = useState("Answer");
  const [view, setView] = useState("chat");

  const [messages, setMessages] = useState(() => [
    { role: "assistant", content: "Answer Mode activated. Ask your question." },
  ]);

  useEffect(() => {
    localStorage.setItem("chat", JSON.stringify(messages));
  }, [messages]);

  const resetChat = (newMode) => {
    setMessages([
      {
        role: "assistant",
        content: `${newMode} Mode activated. Ask your question.`,
      },
    ]);
  };

  const sendMessage = async (text) => {
    setMessages((prev) => [...prev, { role: "user", content: text }]);

    try {
      const res = await fetch("http://localhost:5050/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, mode }),
      });

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "⚠️ Backend or AI not running." },
      ]);
    }
  };

  const sendImageMessage = async (text, image) => {
    setMessages((prev) => [
      ...prev,
      { role: "user", content: text || "Analyze this image." },
    ]);

    const formData = new FormData();
    formData.append("image", image);
    formData.append("question", text);
    formData.append("mode", mode);

    try {
      const res = await fetch("http://localhost:5050/vision", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "⚠️ Image analysis failed." },
      ]);
    }
  };

  return (
    <div className="layout">
      <Sidebar
        mode={mode}
        setMode={(m) => {
          setMode(m);
          resetChat(m);
        }}
        setView={setView}
      />

      <div className="chat-area">
        {view === "chat" && (
          <>
            <ChatWindow messages={messages} />
            <ChatInput onSend={sendMessage} onSendImage={sendImageMessage} />
          </>
        )}

        {view === "flashcards" && <Flashcards />}
        {view === "slides" && <Slides />}
      </div>
    </div>
  );
}

export default App;
