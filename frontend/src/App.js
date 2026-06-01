import { startTransition, useEffect, useMemo, useState } from "react";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import ChatInput from "./components/ChatInput";
import "./App.css";

const API_BASE = process.env.REACT_APP_API_BASE_URL || "http://localhost:5050";
const ACCOUNT_STORAGE_KEY = "studentHelperAccount";
const REGULAR_MODE = "regular";
const COMPUTER_MODE = "computer";
const CHAT_MODES = new Set([REGULAR_MODE, COMPUTER_MODE]);
const LEGACY_CHAT_MODES = new Set(["agent"]);
const LEGACY_COMPUTER_MODES = new Set(["Control", "Automation"]);
const STREAM_UPDATE_INTERVAL_MS = 180;
const ENABLE_STARTUP_WARMUP = process.env.REACT_APP_ENABLE_WARMUP === "true";

const defaultAccountState = {
  tier: "free",
  hasUsedTrial: false,
  startedTrialAt: 0,
  trialEndsAt: 0,
  paymentMethod: null,
  updatedAt: 0,
};

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function hasPremiumAccess(tier) {
  return tier === "trial" || tier === "pro";
}

function normalizeMode(mode) {
  if (CHAT_MODES.has(mode)) return mode;
  if (LEGACY_CHAT_MODES.has(mode)) return REGULAR_MODE;
  if (LEGACY_COMPUTER_MODES.has(mode)) return COMPUTER_MODE;
  return REGULAR_MODE;
}

function getDefaultConversationTitle(mode = REGULAR_MODE) {
  return mode === COMPUTER_MODE ? "Computer Mode" : "New chat";
}

function isDefaultConversationTitle(title, mode = REGULAR_MODE) {
  const normalizedTitle = String(title || "").trim().toLowerCase();
  const defaults = new Set([
    getDefaultConversationTitle(mode).toLowerCase(),
    "new chat",
    "helper ai",
    "regular ai",
    "agent workspace",
    "computer mode",
    "control computer mode",
    "update version",
    "upgrade operator",
    "preferences",
  ]);
  return defaults.has(normalizedTitle);
}

function normalizeAccount(value) {
  const requestedTier = hasPremiumAccess(value?.tier) ? value.tier : "free";
  const startedTrialAt = Number(value?.startedTrialAt) || 0;
  const trialEndsAt = Number(value?.trialEndsAt) || 0;
  const hasUsedTrial = Boolean(value?.hasUsedTrial || startedTrialAt || trialEndsAt);
  const tier = requestedTier === "trial" ? (trialEndsAt > Date.now() ? "trial" : "free") : requestedTier;

  return {
    ...defaultAccountState,
    ...value,
    tier,
    hasUsedTrial,
    startedTrialAt: hasUsedTrial ? startedTrialAt : 0,
    trialEndsAt: tier === "trial" ? trialEndsAt : 0,
    paymentMethod:
      tier === "pro" && value?.paymentMethod && typeof value.paymentMethod === "object"
        ? value.paymentMethod
        : null,
  };
}

function normalizeConversation(conversation) {
  const source = conversation && typeof conversation === "object" ? conversation : {};
  const {
    assistant: _assistant,
    flashcards: _flashcards,
    math: _math,
    slides: _slides,
    view: _view,
    ...rest
  } = source;
  const mode = normalizeMode(rest.mode);
  const fallbackTitle = getDefaultConversationTitle(mode);
  const title = isDefaultConversationTitle(rest.title, mode) ? fallbackTitle : rest.title || fallbackTitle;

  return {
    id: rest.id || uid(),
    mode,
    title,
    messages: Array.isArray(rest.messages) ? rest.messages : [],
    createdAt: Number(rest.createdAt) || Date.now(),
    updatedAt: Number(rest.updatedAt) || Date.now(),
  };
}

function createConversation(mode = REGULAR_MODE) {
  return normalizeConversation({
    id: uid(),
    title: getDefaultConversationTitle(mode),
    mode,
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}

function makeTitle(text, fallback = "New chat") {
  const cleaned = String(text || "")
    .trim()
    .replace(/\s+/g, " ");
  return cleaned.slice(0, 52) || fallback;
}

function mergeStreamingMessage(messages, streamingMessage) {
  if (!Array.isArray(messages) || !streamingMessage?.messageId) {
    return Array.isArray(messages) ? messages : [];
  }

  let hasMatch = false;
  const nextMessages = messages.map((message) => {
    if (message.id !== streamingMessage.messageId) {
      return message;
    }

    hasMatch = true;
    return {
      ...message,
      content: streamingMessage.content,
      isStreaming: streamingMessage.isStreaming,
    };
  });

  return hasMatch ? nextMessages : messages;
}

function getHeaderCopy(conversation) {
  const hasMessages = (conversation?.messages || []).length > 0;
  const mode = conversation?.mode || REGULAR_MODE;

  if (!hasMessages) {
    return {
      title: "Operator",
      summary:
        mode === COMPUTER_MODE
          ? "Computer Mode for browser research, desktop tasks, and guided workflows."
          : "Simple private AI chat for questions, drafts, notes, and study help.",
    };
  }

  return {
    title: conversation?.title || getDefaultConversationTitle(mode),
    summary:
      mode === COMPUTER_MODE
        ? "Computer Mode is active."
        : "Chat is active.",
  };
}

function HomeScreen({ mode, summary, onOpenRegularMode, onOpenComputerMode, onSend, onSendImage }) {
  return (
    <div className="home-screen">
      <div className="home-copy">
        <h1>Operator</h1>
        <p>{summary}</p>
      </div>

      <ChatInput mode={mode} centered onSend={onSend} onSendImage={onSendImage} />

      <div className="mode-switch-row is-home">
        <button
          type="button"
          className={`mode-switch-btn ${mode === REGULAR_MODE ? "active" : ""}`}
          onClick={onOpenRegularMode}
        >
          Chat
        </button>
        <button
          type="button"
          className={`mode-switch-btn ${mode === COMPUTER_MODE ? "active" : ""}`}
          onClick={onOpenComputerMode}
        >
          Computer Mode
        </button>
      </div>
    </div>
  );
}

function App() {
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
    return [createConversation(REGULAR_MODE)];
  });

  const [activeId, setActiveId] = useState(() => localStorage.getItem("chatActiveId") || null);
  const [account, setAccount] = useState(() => {
    const raw = localStorage.getItem(ACCOUNT_STORAGE_KEY);
    if (!raw) return defaultAccountState;
    try {
      return normalizeAccount(JSON.parse(raw));
    } catch {
      return defaultAccountState;
    }
  });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState(null);
  const hasStreamingMessages = useMemo(
    () =>
      conversations.some((conversation) =>
        (conversation.messages || []).some((message) => Boolean(message.isStreaming)),
      ),
    [conversations],
  );

  useEffect(() => {
    if (!activeId && conversations.length > 0) {
      setActiveId(conversations[0].id);
    }
  }, [activeId, conversations]);

  useEffect(() => {
    if (hasStreamingMessages) return undefined;

    const timeoutId = window.setTimeout(() => {
      localStorage.setItem("chatHistory", JSON.stringify(conversations));
    }, 180);

    return () => window.clearTimeout(timeoutId);
  }, [conversations, hasStreamingMessages]);

  useEffect(() => {
    if (activeId) {
      localStorage.setItem("chatActiveId", activeId);
    }
  }, [activeId]);

  useEffect(() => {
    localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(account));
  }, [account]);

  useEffect(() => {
    if (account.tier !== "trial") return undefined;

    const remainingMs = Number(account.trialEndsAt || 0) - Date.now();

    if (remainingMs <= 0) {
      setAccount((previous) =>
        normalizeAccount({
          ...previous,
          tier: "free",
          trialEndsAt: 0,
          paymentMethod: null,
          updatedAt: Date.now(),
        }),
      );
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setAccount((previous) =>
        normalizeAccount({
          ...previous,
          tier: "free",
          trialEndsAt: 0,
          paymentMethod: null,
          updatedAt: Date.now(),
        }),
      );
    }, remainingMs);

    return () => window.clearTimeout(timeoutId);
  }, [account.tier, account.trialEndsAt]);

  useEffect(() => {
    if (!ENABLE_STARTUP_WARMUP) return undefined;
    if (typeof fetch !== "function") return undefined;

    const timeoutId = window.setTimeout(() => {
      fetch(`${API_BASE}/warmup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: hasPremiumAccess(account.tier) ? account.tier : "free" }),
      }).catch(() => {
        // best-effort warmup
      });
    }, 1200);

    return () => window.clearTimeout(timeoutId);
  }, [account.tier]);

  const activeConversation =
    conversations.find((conversation) => conversation.id === activeId) || conversations[0];
  const activeStreamingMessage =
    streamingMessage?.conversationId === activeConversation?.id ? streamingMessage : null;
  const activeMessages = useMemo(
    () => mergeStreamingMessage(activeConversation?.messages || [], activeStreamingMessage),
    [activeConversation?.messages, activeStreamingMessage],
  );
  const tier = hasPremiumAccess(account.tier) ? account.tier : "free";

  const orderedConversations = useMemo(
    () => [...conversations].sort((a, b) => b.updatedAt - a.updatedAt),
    [conversations],
  );

  const updateConversation = (id, updater) => {
    setConversations((previous) =>
      previous.map((conversation) =>
        conversation.id === id ? normalizeConversation(updater(conversation)) : conversation,
      ),
    );
  };

  const createAndFocusConversation = (mode = activeConversation?.mode || REGULAR_MODE) => {
    const fresh = createConversation(mode);
    setConversations((previous) => [fresh, ...previous]);
    setActiveId(fresh.id);
  };

  const openChatMode = (nextMode) => {
    if (!activeConversation) return;

    if ((activeConversation.messages || []).length === 0) {
      updateConversation(activeConversation.id, (conversation) => ({
        ...conversation,
        mode: nextMode,
        title: getDefaultConversationTitle(nextMode),
        updatedAt: Date.now(),
      }));
      return;
    }

    createAndFocusConversation(nextMode);
  };

  const sendMessage = async (text) => {
    if (!activeConversation || !String(text || "").trim()) return;

    const convoId = activeConversation.id;
    const title = makeTitle(text);
    const assistantId = uid();
    const mode = activeConversation.mode;

    updateConversation(convoId, (conversation) => ({
      ...conversation,
      title: isDefaultConversationTitle(conversation.title, conversation.mode)
        ? title
        : conversation.title,
      messages: [
        ...conversation.messages,
        { id: uid(), role: "user", content: text },
        { id: assistantId, role: "assistant", content: "Thinking...", isStreaming: true },
      ],
      updatedAt: Date.now(),
    }));
    setStreamingMessage({
      conversationId: convoId,
      messageId: assistantId,
      content: "Thinking...",
      isStreaming: true,
    });

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          mode,
          tier,
          stream: true,
        }),
      });

      if (!res.ok) {
        const detail = (await res.text()).trim();
        throw new Error(detail || "Chat request failed.");
      }

      if (!res.body) {
        throw new Error("Streaming not available.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";
      let lastRenderAt = 0;

      const paintAssistantMessage = () => {
        const nextContent = assistantText.trim() || "Thinking...";
        startTransition(() => {
          setStreamingMessage((current) => {
            if (
              current?.conversationId === convoId &&
              current?.messageId === assistantId &&
              current?.content === nextContent &&
              current?.isStreaming
            ) {
              return current;
            }

            return {
              conversationId: convoId,
              messageId: assistantId,
              content: nextContent,
              isStreaming: true,
            };
          });
        });
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        assistantText += decoder.decode(value, { stream: true });

        if (Date.now() - lastRenderAt >= STREAM_UPDATE_INTERVAL_MS) {
          lastRenderAt = Date.now();
          paintAssistantMessage();
        }
      }

      assistantText += decoder.decode();
      const finalContent = assistantText.trim() || "Thinking...";

      updateConversation(convoId, (conversation) => ({
        ...conversation,
        messages: conversation.messages.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                content: finalContent,
                isStreaming: false,
              }
            : message,
        ),
        updatedAt: Date.now(),
      }));
      setStreamingMessage((current) =>
        current?.conversationId === convoId && current?.messageId === assistantId ? null : current,
      );
    } catch (error) {
      setStreamingMessage((current) =>
        current?.conversationId === convoId && current?.messageId === assistantId ? null : current,
      );
      updateConversation(convoId, (conversation) => ({
        ...conversation,
        messages: conversation.messages.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                content:
                  error?.message ||
                  "Backend or AI service is unavailable. Start the backend and check your Groq API key.",
                isStreaming: false,
              }
            : message,
        ),
        updatedAt: Date.now(),
      }));
    }
  };

  const sendImageMessage = async (text, image) => {
    if (!activeConversation || !image) return;

    const convoId = activeConversation.id;
    const mode = activeConversation.mode;
    const prompt = String(text || "").trim() || "Analyze this image.";

    updateConversation(convoId, (conversation) => ({
      ...conversation,
      title: isDefaultConversationTitle(conversation.title, conversation.mode)
        ? makeTitle(prompt, "Image chat")
        : conversation.title,
      messages: [...conversation.messages, { id: uid(), role: "user", content: prompt }],
      updatedAt: Date.now(),
    }));

    const formData = new FormData();
    formData.append("image", image);
    formData.append("question", prompt);
    formData.append("mode", mode);
    formData.append("tier", tier);

    try {
      const res = await fetch(`${API_BASE}/vision`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.detail || data?.error || "Image analysis failed.");
      }

      updateConversation(convoId, (conversation) => ({
        ...conversation,
        messages: [
          ...conversation.messages,
          { id: uid(), role: "assistant", content: data.answer || "No answer returned." },
        ],
        updatedAt: Date.now(),
      }));
    } catch (error) {
      updateConversation(convoId, (conversation) => ({
        ...conversation,
        messages: [
          ...conversation.messages,
          {
            id: uid(),
            role: "assistant",
            content:
              error?.message ||
              "Image analysis failed. Check the backend and your Groq vision model setup.",
          },
        ],
        updatedAt: Date.now(),
      }));
    }
  };

  const activeMode = activeConversation?.mode || REGULAR_MODE;
  const isCenteredChat = (activeConversation?.messages || []).length === 0;
  const headerCopy = getHeaderCopy(activeConversation);

  return (
    <div className={`layout ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <div
        className={`sidebar-backdrop ${isSidebarOpen ? "is-visible" : ""}`}
        onClick={() => setIsSidebarOpen(false)}
        aria-hidden="true"
      />

      <Sidebar
        mode={activeMode}
        conversations={orderedConversations}
        activeId={activeConversation?.id}
        collapsed={isSidebarCollapsed}
        isOpen={isSidebarOpen}
        onToggleCollapse={() => setIsSidebarCollapsed((current) => !current)}
        onOpenRegularMode={() => {
          openChatMode(REGULAR_MODE);
          setIsSidebarOpen(false);
        }}
        onOpenComputerMode={() => {
          openChatMode(COMPUTER_MODE);
          setIsSidebarOpen(false);
        }}
        onSelectConversation={(id) => {
          setActiveId(id);
          setIsSidebarOpen(false);
        }}
        onNewConversation={() => {
          createAndFocusConversation(activeConversation?.mode || REGULAR_MODE);
          setIsSidebarOpen(false);
        }}
        onDeleteConversation={(id) => {
          setConversations((previous) => {
            const next = previous.filter((conversation) => conversation.id !== id);
            if (next.length === 0) {
              const fresh = createConversation(REGULAR_MODE);
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
        <header className={`app-header ${isCenteredChat ? "is-home" : ""}`}>
          <div className="header-start">
            <button
              type="button"
              className="header-menu-btn"
              onClick={() => {
                setIsSidebarCollapsed(false);
                setIsSidebarOpen(true);
              }}
              aria-label="Open sidebar"
            >
              Menu
            </button>
            {!isCenteredChat && (
              <div className="header-copy">
                <h1>{headerCopy.title}</h1>
                <p className="header-summary">{headerCopy.summary}</p>
              </div>
            )}
          </div>
        </header>

        {isCenteredChat ? (
          <HomeScreen
            mode={activeMode}
            summary={headerCopy.summary}
            onOpenRegularMode={() => openChatMode(REGULAR_MODE)}
            onOpenComputerMode={() => openChatMode(COMPUTER_MODE)}
            onSend={sendMessage}
            onSendImage={sendImageMessage}
          />
        ) : (
          <div className="chat-screen">
            <ChatWindow messages={activeMessages} />
            <ChatInput mode={activeMode} onSend={sendMessage} onSendImage={sendImageMessage} />
            <div className="app-footer">Review important output before acting on it.</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
