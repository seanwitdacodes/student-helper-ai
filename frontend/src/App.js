import { useEffect, useMemo, useState } from "react";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import ChatInput from "./components/ChatInput";
import Flashcards from "./components/Flashcards";
import Slides from "./components/Slides";
import "./App.css";

function App() {
  const defaultFlashcardsState = {
    notes: "",
    rawCards: "",
    cards: [],
    mode: "learn",
    index: 0,
    isFlipped: false,
    showAnswer: false,
    userAnswer: "",
    score: 0,
    attempts: 0,
    count: 12,
  };

  const defaultSlidesState = {
    notes: "",
    rawSlides: "",
    slides: [{ title: "Title Slide", bullets: ["Subtitle goes here"] }],
    activeIndex: 0,
  };

  const normalizeConversation = (c) => {
    const view = c.view || "chat";
    return {
      ...c,
      view,
      title:
        c.title ||
        (view === "flashcards" ? "Flashcards" : view === "slides" ? "Slides" : "New Chat"),
      messages: Array.isArray(c.messages) ? c.messages : [],
      flashcards: { ...defaultFlashcardsState, ...(c.flashcards || {}) },
      slides: { ...defaultSlidesState, ...(c.slides || {}) },
    };
  };

  const createConversation = (mode, view = "chat") => ({
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    title:
      view === "flashcards"
        ? "Flashcards"
        : view === "slides"
        ? "Slides"
        : "New Chat",
    mode,
    view,
    messages: [
      { role: "assistant", content: `${mode} Mode activated. Ask your question.` },
    ],
    flashcards: { ...defaultFlashcardsState },
    slides: { ...defaultSlidesState },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  const [conversations, setConversations] = useState(() => {
    const raw = localStorage.getItem("chatHistory");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(normalizeConversation);
        }
      } catch {
        // ignore malformed storage
      }
    }
    return [createConversation("Answer")].map(normalizeConversation);
  });

  const [activeId, setActiveId] = useState(() => {
    const stored = localStorage.getItem("chatActiveId");
    return stored || null;
  });

  useEffect(() => {
    if (!activeId && conversations.length > 0) {
      setActiveId(conversations[0].id);
    }
  }, [activeId, conversations]);

  useEffect(() => {
    localStorage.setItem("chatHistory", JSON.stringify(conversations));
    if (activeId) {
      localStorage.setItem("chatActiveId", activeId);
    }
  }, [conversations, activeId]);

  const activeConversation =
    conversations.find((c) => c.id === activeId) || conversations[0];

  const orderedConversations = useMemo(() => {
    return [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);
  }, [conversations]);

  const updateConversation = (id, updater) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? updater(c) : c)),
    );
  };

  const makeTitle = (text) => {
    const cleaned = (text || "").trim().replace(/\s+/g, " ");
    return cleaned.slice(0, 48) || "New Chat";
  };

  const resetChat = (newMode) => {
    if (!activeConversation) return;
    updateConversation(activeConversation.id, (c) => ({
      ...c,
      mode: newMode,
      title: "New Chat",
      view: "chat",
      messages: [
        {
          role: "assistant",
          content: `${newMode} Mode activated. Ask your question.`,
        },
      ],
      updatedAt: Date.now(),
    }));
  };

  const sendMessage = async (text) => {
    if (!activeConversation) return;
    const convoId = activeConversation.id;
    const title = makeTitle(text);

    updateConversation(convoId, (c) => ({
      ...c,
      title: c.title === "New Chat" ? title : c.title,
      messages: [...c.messages, { role: "user", content: text }],
      updatedAt: Date.now(),
    }));

    try {
      const res = await fetch("http://localhost:5050/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, mode: activeConversation.mode }),
      });

      const data = await res.json();
      updateConversation(convoId, (c) => ({
        ...c,
        messages: [...c.messages, { role: "assistant", content: data.answer }],
        updatedAt: Date.now(),
      }));
    } catch {
      updateConversation(convoId, (c) => ({
        ...c,
        messages: [
          ...c.messages,
          { role: "assistant", content: "⚠️ Backend or AI not running." },
        ],
        updatedAt: Date.now(),
      }));
    }
  };

  const sendImageMessage = async (text, image) => {
    if (!activeConversation) return;
    const convoId = activeConversation.id;
    const title = makeTitle(text || "Image question");

    updateConversation(convoId, (c) => ({
      ...c,
      title: c.title === "New Chat" ? title : c.title,
      messages: [
        ...c.messages,
        { role: "user", content: text || "Analyze this image." },
      ],
      updatedAt: Date.now(),
    }));

    const formData = new FormData();
    formData.append("image", image);
    formData.append("question", text);
    formData.append("mode", activeConversation.mode);

    try {
      const res = await fetch("http://localhost:5050/vision", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      updateConversation(convoId, (c) => ({
        ...c,
        messages: [...c.messages, { role: "assistant", content: data.answer }],
        updatedAt: Date.now(),
      }));
    } catch {
      updateConversation(convoId, (c) => ({
        ...c,
        messages: [
          ...c.messages,
          { role: "assistant", content: "⚠️ Image analysis failed." },
        ],
        updatedAt: Date.now(),
      }));
    }
  };

  return (
    <div className="layout">
      <Sidebar
        mode={activeConversation?.mode || "Answer"}
        setMode={(m) => {
          resetChat(m);
        }}
        conversations={orderedConversations}
        activeId={activeConversation?.id}
        onSelectConversation={(id) => {
          setActiveId(id);
        }}
        onNewConversation={() => {
          const fresh = createConversation(activeConversation?.mode || "Answer");
          setConversations((prev) => [fresh, ...prev]);
          setActiveId(fresh.id);
        }}
        onOpenTool={(tool) => {
          const fresh = createConversation(
            activeConversation?.mode || "Answer",
            tool,
          );
          setConversations((prev) => [fresh, ...prev]);
          setActiveId(fresh.id);
        }}
        onDeleteConversation={(id) => {
          setConversations((prev) => {
            const next = prev.filter((c) => c.id !== id);
            if (next.length === 0) {
              const fresh = createConversation("Answer");
              setActiveId(fresh.id);
              return [fresh];
            }
            if (activeId === id) {
              setActiveId(next[0]?.id || null);
            }
            return next;
          });
        }}
      />

      <div className="chat-area">
        {activeConversation?.view === "chat" && (
          <>
            <div className="chat-topbar">
              <div>
                <div className="chat-title">
                  {activeConversation?.title || "New Chat"}
                </div>
                <div className="chat-subtitle">
                  {activeConversation?.mode || "Answer"} Mode
                </div>
              </div>
              <button
                className="new-chat-cta"
                onClick={() => {
                  const fresh = createConversation(
                    activeConversation?.mode || "Answer",
                  );
                  setConversations((prev) => [fresh, ...prev]);
                  setActiveId(fresh.id);
                }}
              >
                New Chat
              </button>
            </div>
            <ChatWindow messages={activeConversation?.messages || []} />
            <ChatInput onSend={sendMessage} onSendImage={sendImageMessage} />
          </>
        )}

        {activeConversation?.view === "flashcards" && (
          <Flashcards
            state={activeConversation.flashcards || defaultFlashcardsState}
            onChange={(next) =>
              updateConversation(activeConversation.id, (c) => ({
                ...c,
                flashcards: next,
                updatedAt: Date.now(),
              }))
            }
          />
        )}
        {activeConversation?.view === "slides" && (
          <Slides
            state={activeConversation.slides || defaultSlidesState}
            onChange={(next) =>
              updateConversation(activeConversation.id, (c) => ({
                ...c,
                slides: next,
                updatedAt: Date.now(),
              }))
            }
          />
        )}
      </div>
    </div>
  );
}

export default App;
