import { useEffect, useMemo, useState } from "react";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import ChatInput from "./components/ChatInput";
import BillingModal from "./components/BillingModal";
import "./App.css";

const API_BASE = "http://localhost:5050";
const ACCOUNT_STORAGE_KEY = "studentHelperAccount";
const TRIAL_LENGTH_DAYS = 7;
const TRIAL_LENGTH_MS = TRIAL_LENGTH_DAYS * 24 * 60 * 60 * 1000;
const REGULAR_MODE = "regular";
const COMPUTER_MODE = "computer";
const CHAT_MODES = new Set([REGULAR_MODE, COMPUTER_MODE]);
const LEGACY_COMPUTER_MODES = new Set(["Control", "Automation"]);
const SUPPORTED_VIEWS = new Set(["chat", "update"]);
const STREAM_UPDATE_INTERVAL_MS = 48;

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

function getPlanLabel(tier) {
  if (tier === "pro") return "Full Version";
  if (tier === "trial") return "Free Trial";
  return "Free Plan";
}

function normalizeMode(mode) {
  if (CHAT_MODES.has(mode)) return mode;
  if (LEGACY_COMPUTER_MODES.has(mode)) return COMPUTER_MODE;
  return REGULAR_MODE;
}

function getDefaultConversationTitle(mode = REGULAR_MODE, view = "chat") {
  if (view === "update") return "Update version";
  if (mode === COMPUTER_MODE) return "Computer Mode";
  return "New chat";
}

function isDefaultConversationTitle(title, mode = REGULAR_MODE, view = "chat") {
  const normalizedTitle = String(title || "").trim().toLowerCase();
  const defaults = new Set([
    getDefaultConversationTitle(mode, view).toLowerCase(),
    "new chat",
    "regular ai",
    "computer mode",
    "control computer mode",
    "math solver",
    "answer mode",
    "tutor mode",
    "research mode",
    "automation mode",
    "flashcards",
    "slides",
    "update version",
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
    ...rest
  } = source;
  const storedView = typeof rest.view === "string" ? rest.view : "chat";
  const view = SUPPORTED_VIEWS.has(storedView) ? storedView : "chat";
  const mode = normalizeMode(rest.mode);
  const fallbackTitle = getDefaultConversationTitle(mode, view);
  const title = isDefaultConversationTitle(rest.title, mode, storedView) ? fallbackTitle : rest.title || fallbackTitle;

  return {
    id: rest.id || uid(),
    mode,
    view,
    title,
    messages: Array.isArray(rest.messages) ? rest.messages : [],
    createdAt: Number(rest.createdAt) || Date.now(),
    updatedAt: Number(rest.updatedAt) || Date.now(),
  };
}

function createConversation(mode = REGULAR_MODE, view = "chat") {
  return normalizeConversation({
    id: uid(),
    title: getDefaultConversationTitle(mode, view),
    mode,
    view,
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

function getWorkspaceMeta(activeView, activeMode, conversation) {
  if (activeView === "update") {
    return {
      eyebrow: "Settings",
      title: "Update Version",
      summary: "Manage plan access and unlock premium workspace features.",
    };
  }

  if (activeMode === COMPUTER_MODE) {
    return {
      eyebrow: "Computer Mode",
      title: "Computer Mode",
      summary: "Use this mode for computer tasks, commands, and step-by-step device help.",
    };
  }

  return {
    eyebrow: "Regular AI",
    title: conversation?.messages?.length ? conversation?.title || "New chat" : "Helper AI",
    summary: "A simple, fast AI chat for questions, writing, notes, and ideas.",
  };
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
    return [createConversation()];
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

  useEffect(() => {
    if (!activeId && conversations.length > 0) {
      setActiveId(conversations[0].id);
    }
  }, [activeId, conversations]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      localStorage.setItem("chatHistory", JSON.stringify(conversations));
    }, 180);

    return () => window.clearTimeout(timeoutId);
  }, [conversations]);

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
    if (typeof fetch !== "function") return;

    fetch(`${API_BASE}/warmup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: hasPremiumAccess(account.tier) ? account.tier : "free" }),
    }).catch(() => {
      // best-effort warmup
    });
  }, [account.tier]);

  const activeConversation =
    conversations.find((conversation) => conversation.id === activeId) || conversations[0];
  const tier = hasPremiumAccess(account.tier) ? account.tier : "free";
  const planLabel = getPlanLabel(account.tier);

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

  const createAndFocusConversation = (mode = activeConversation?.mode || REGULAR_MODE, view = "chat") => {
    const fresh = createConversation(mode, view);
    setConversations((previous) => [fresh, ...previous]);
    setActiveId(fresh.id);
  };

  const openChatMode = (nextMode) => {
    if (activeConversation?.view === "chat" && (activeConversation.messages || []).length === 0) {
      updateConversation(activeConversation.id, (conversation) => ({
        ...conversation,
        mode: nextMode,
        view: "chat",
        title: getDefaultConversationTitle(nextMode, "chat"),
        updatedAt: Date.now(),
      }));
      return;
    }

    createAndFocusConversation(nextMode, "chat");
  };

  const openToolView = (view) => {
    const existingConversation = orderedConversations.find((conversation) => conversation.view === view);
    if (existingConversation) {
      setActiveId(existingConversation.id);
      return;
    }

    createAndFocusConversation(activeConversation?.mode || REGULAR_MODE, view);
  };

  const sendMessage = async (text) => {
    if (!activeConversation || !String(text || "").trim()) return;

    const convoId = activeConversation.id;
    const title = makeTitle(text);
    const assistantId = uid();
    const mode = activeConversation.mode;

    updateConversation(convoId, (conversation) => ({
      ...conversation,
      title: isDefaultConversationTitle(conversation.title, conversation.mode, conversation.view)
        ? title
        : conversation.title,
      messages: [
        ...conversation.messages,
        { id: uid(), role: "user", content: text },
        { id: assistantId, role: "assistant", content: "Thinking...", isStreaming: true },
      ],
      updatedAt: Date.now(),
    }));

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
        throw new Error("Chat request failed.");
      }

      if (!res.body) {
        throw new Error("Streaming not available.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";
      let lastRenderAt = 0;

      const paintAssistantMessage = (isStreaming) => {
        updateConversation(convoId, (conversation) => ({
          ...conversation,
          messages: conversation.messages.map((message) =>
            message.id === assistantId
              ? {
                  ...message,
                  content: assistantText.trim() || "Thinking...",
                  isStreaming,
                }
              : message,
          ),
          updatedAt: Date.now(),
        }));
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        assistantText += decoder.decode(value, { stream: true });

        if (Date.now() - lastRenderAt >= STREAM_UPDATE_INTERVAL_MS) {
          lastRenderAt = Date.now();
          paintAssistantMessage(true);
        }
      }

      assistantText += decoder.decode();
      paintAssistantMessage(false);
    } catch {
      updateConversation(convoId, (conversation) => ({
        ...conversation,
        messages: conversation.messages.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                content: "Backend or AI service is unavailable. Start the local backend and Ollama models.",
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
      title: isDefaultConversationTitle(conversation.title, conversation.mode, conversation.view)
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
      updateConversation(convoId, (conversation) => ({
        ...conversation,
        messages: [
          ...conversation.messages,
          { id: uid(), role: "assistant", content: data.answer || "No answer returned." },
        ],
        updatedAt: Date.now(),
      }));
    } catch {
      updateConversation(convoId, (conversation) => ({
        ...conversation,
        messages: [
          ...conversation.messages,
          { id: uid(), role: "assistant", content: "Image analysis failed. Check the backend and vision model." },
        ],
        updatedAt: Date.now(),
      }));
    }
  };

  const activeView = activeConversation?.view || "chat";
  const activeMode = activeConversation?.mode || REGULAR_MODE;
  const isCenteredChat = activeView === "chat" && (activeConversation?.messages || []).length === 0;
  const workspaceMeta = getWorkspaceMeta(activeView, activeMode, activeConversation);

  return (
    <div className={`layout ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <div
        className={`sidebar-backdrop ${isSidebarOpen ? "is-visible" : ""}`}
        onClick={() => setIsSidebarOpen(false)}
        aria-hidden="true"
      />

      <Sidebar
        mode={activeMode}
        activeView={activeView}
        account={account}
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
        onOpenTool={(view) => {
          openToolView(view);
          setIsSidebarOpen(false);
        }}
        onDeleteConversation={(id) => {
          setConversations((previous) => {
            const next = previous.filter((conversation) => conversation.id !== id);
            if (next.length === 0) {
              const fresh = createConversation();
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
        <header className="app-header">
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
            <div className="header-copy">
              <div className="header-eyebrow">{workspaceMeta.eyebrow}</div>
              <h1>{workspaceMeta.title}</h1>
              <p className="header-summary">{workspaceMeta.summary}</p>
            </div>
          </div>

          <div className="header-actions">
            <span className="header-pill">{planLabel}</span>
            <button type="button" className="quiet-btn" onClick={() => openToolView("update")}>
              Update
            </button>
          </div>
        </header>

        {activeView === "chat" && (
          <div className={`chat-screen ${isCenteredChat ? "is-centered" : ""}`}>
            <ChatWindow mode={activeMode} messages={activeConversation?.messages || []} />
            <ChatInput
              mode={activeMode}
              centered={isCenteredChat}
              onSend={sendMessage}
              onSendImage={sendImageMessage}
            />
            <div className="app-footer">Helper AI can make mistakes. Check important answers.</div>
          </div>
        )}

        {activeView === "update" && (
          <BillingModal
            inline
            account={account}
            trialLengthDays={TRIAL_LENGTH_DAYS}
            onClose={() => {}}
            onStartTrial={() => {
              const now = Date.now();
              setAccount(
                normalizeAccount({
                  ...account,
                  tier: "trial",
                  hasUsedTrial: true,
                  startedTrialAt: account.startedTrialAt || now,
                  trialEndsAt: now + TRIAL_LENGTH_MS,
                  paymentMethod: null,
                  updatedAt: now,
                }),
              );
            }}
            onUpgrade={(paymentMethod) => {
              setAccount(
                normalizeAccount({
                  ...account,
                  tier: "pro",
                  paymentMethod,
                  trialEndsAt: 0,
                  updatedAt: Date.now(),
                }),
              );
            }}
            onDowngrade={() => {
              setAccount(
                normalizeAccount({
                  ...account,
                  tier: "free",
                  paymentMethod: null,
                  trialEndsAt: 0,
                  updatedAt: Date.now(),
                }),
              );
            }}
          />
        )}
      </div>
    </div>
  );
}

export default App;
