import { useState } from "react";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import ChatInput from "./components/ChatInput";
import "./App.css";

function App() {
  const [mode, setMode] = useState("Tutor");
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi! How can I help you today?" },
  ]);

  const sendMessage = (text) => {
    const userMsg = { role: "user", content: text };
    const aiMsg = {
      role: "assistant",
      content: `(${mode} Mode)\nThis is where the response will go.`,
    };

    setMessages((prev) => [...prev, userMsg, aiMsg]);
  };

  return (
    <div className="layout">
      <Sidebar mode={mode} setMode={setMode} />
      <div className="chat-area">
        <ChatWindow messages={messages} />
        <ChatInput onSend={sendMessage} />
      </div>
    </div>
  );
}

export default App;
