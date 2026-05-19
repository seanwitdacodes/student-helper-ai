import { useEffect, useMemo, useState } from "react";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import ChatInput from "./components/ChatInput";
import Flashcards from "./components/Flashcards";
import Slides from "./components/Slides";
import MathWorkspace from "./components/MathWorkspace";
import BillingModal from "./components/BillingModal";
import "./App.css";

const API_BASE = "http://localhost:5050";
const ACCOUNT_STORAGE_KEY = "studentHelperAccount";
const TRIAL_LENGTH_DAYS = 7;
const TRIAL_LENGTH_MS = TRIAL_LENGTH_DAYS * 24 * 60 * 60 * 1000;

const defaultAssistantState = {
  model: "max",
  reasoning: "deep",
};

const defaultFlashcardsState = {
  deckTitle: "",
  deckDescription: "",
  notes: "",
  rawCards: "",
  importText: "",
  exportText: "",
  cards: [],
  mode: "flashcards",
  promptSide: "term",
  starredOnly: false,
  searchTerm: "",
  studyIndex: 0,
  index: 0,
  isFlipped: false,
  writeInput: "",
  writeFeedback: "",
  learnFeedback: "",
  stats: { correct: 0, attempts: 0, streak: 0, bestStreak: 0 },
  testQuestions: [],
  testAnswers: {},
  testSubmitted: false,
  matchTokens: [],
  matchSelected: [],
  matchMatched: [],
  matchStartedAt: 0,
  matchFinishedAt: 0,
  matchMoves: 0,
  bestMatchMs: 0,
  count: 12,
};

const defaultSlidesState = {
  title: "Untitled presentation",
  subtitle: "Pitch, lecture, or lesson deck",
  theme: "aurora",
  notes: "",
  rawSlides: "",
  outlineText: "",
  slideCount: 6,
  canvasItems: [
    { id: "canvas-1", title: "Hook", body: "What should the audience remember?" },
    { id: "canvas-2", title: "Evidence", body: "Key facts, proof, or examples" },
  ],
  slides: [
    {
      title: "Title Slide",
      subtitle: "Subtitle goes here",
      bullets: ["Set the context", "State the goal", "Preview the story"],
      speakerNotes: "",
      layout: "title-bullets",
    },
  ],
  activeIndex: 0,
};

const defaultMathState = {
  question: "",
  solverResult: null,
  rawResponse: "",
  isLoading: false,
  error: "",
  history: [],
  activeHistoryId: null,
  lastSolvedAt: 0,
};

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

function getDefaultConversationTitle(mode = "Build", view = "chat") {
  if (view === "flashcards") return "Flashcards";
  if (view === "slides") return "Slides";
  if (view === "update") return "Update version";
  if (mode === "Math") return "Math Solver";
  if (mode === "Control") return "Control Computer Mode";
  return "New chat";
}

function isDefaultConversationTitle(title, mode = "Build", view = "chat") {
  const normalizedTitle = String(title || "").trim().toLowerCase();
  const defaults = new Set([
    getDefaultConversationTitle(mode, view).toLowerCase(),
    "new chat",
    "new chat",
    "math solver",
    "control computer mode",
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
  const view = conversation.view || "chat";
  const flashcards = { ...defaultFlashcardsState, ...(conversation.flashcards || {}) };

  if (!["flashcards", "learn", "write", "test", "match"].includes(flashcards.mode)) {
    flashcards.mode = "flashcards";
  }

  return {
    ...conversation,
    mode: conversation.mode || "Build",
    view,
    title: conversation.title || getDefaultConversationTitle(conversation.mode || "Build", view),
    messages: Array.isArray(conversation.messages) ? conversation.messages : [],
    assistant: { ...defaultAssistantState, ...(conversation.assistant || {}) },
    flashcards,
    slides: { ...defaultSlidesState, ...(conversation.slides || {}) },
    math: { ...defaultMathState, ...(conversation.math || {}) },
    createdAt: conversation.createdAt || Date.now(),
    updatedAt: conversation.updatedAt || Date.now(),
  };
}

function createConversation(mode = "Build", view = "chat") {
  return normalizeConversation({
    id: uid(),
    title: getDefaultConversationTitle(mode, view),
    mode,
    view,
    messages: [],
    assistant: { ...defaultAssistantState },
    flashcards: { ...defaultFlashcardsState },
    slides: { ...defaultSlidesState },
    math: { ...defaultMathState },
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
  if (activeView === "flashcards") {
    return {
      eyebrow: "Study tool",
      title: conversation?.flashcards?.deckTitle || "Flashcards",
      summary: "Build decks, review terms, and drill recall with a focused study flow.",
    };
  }

  if (activeView === "slides") {
    return {
      eyebrow: "Study tool",
      title: conversation?.slides?.title || "Slides",
      summary: "Draft, refine, and organize slide content with a structured editor.",
    };
  }

  if (activeView === "update") {
    return {
      eyebrow: "Settings",
      title: "Update Version",
      summary: "Manage plan access and unlock premium workspace features.",
    };
  }

  if (activeMode === "Math") {
    return {
      eyebrow: "Math",
      title: "Math Solver",
      summary: "Upload or type a problem to get a worked solution with history.",
    };
  }

  if (activeMode === "Control") {
    return {
      eyebrow: "Computer control",
      title: "Control Computer Mode",
      summary: "Use chat to map tasks, commands, and guided computer workflows.",
    };
  }

  return {
    eyebrow: "Conversation",
    title: conversation?.messages?.length ? conversation?.title || "New chat" : "Helper AI",
    summary: "A minimal, streaming-first AI workspace for questions, notes, and ideas.",
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
    return [createConversation("Build")];
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
    localStorage.setItem("chatHistory", JSON.stringify(conversations));
    if (activeId) {
      localStorage.setItem("chatActiveId", activeId);
    }
  }, [activeId, conversations]);

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

  const createAndFocusConversation = (mode = activeConversation?.mode || "Build", view = "chat") => {
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
        math: { ...defaultMathState },
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

    createAndFocusConversation(activeConversation?.mode || "Build", view);
  };

  const sendMessage = async (text) => {
    if (!activeConversation || !String(text || "").trim()) return;

    const convoId = activeConversation.id;
    const title = makeTitle(text);
    const assistantId = uid();
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
          mode: activeConversation.mode,
          tier,
          assistant: activeConversation.assistant,
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

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        assistantText += decoder.decode(value, { stream: true });
        const nextAssistantText = assistantText;

        updateConversation(convoId, (conversation) => ({
          ...conversation,
          messages: conversation.messages.map((message) =>
            message.id === assistantId
              ? {
                  ...message,
                  content: nextAssistantText || "Thinking...",
                  isStreaming: true,
                }
              : message,
          ),
          updatedAt: Date.now(),
        }));
      }

      assistantText += decoder.decode();

      updateConversation(convoId, (conversation) => ({
        ...conversation,
        messages: conversation.messages.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                content: assistantText.trim() || "No answer returned.",
                isStreaming: false,
              }
            : message,
        ),
        updatedAt: Date.now(),
      }));
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
    formData.append("mode", activeConversation.mode);
    formData.append("tier", tier);
    formData.append("assistant", JSON.stringify(activeConversation.assistant || defaultAssistantState));

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

  const solveMath = async ({ question, image }) => {
    if (!activeConversation) return;
    if (!String(question || "").trim() && !image) return;

    const convoId = activeConversation.id;
    const prompt = String(question || "").trim();

    updateConversation(convoId, (conversation) => ({
      ...conversation,
      title:
        conversation.title === getDefaultConversationTitle("Math", "chat")
          ? makeTitle(prompt, "Math Solver")
          : conversation.title,
      math: {
        ...conversation.math,
        question: prompt,
        isLoading: true,
        error: "",
      },
      updatedAt: Date.now(),
    }));

    const formData = new FormData();
    if (image) formData.append("image", image);
    if (prompt) formData.append("question", prompt);
    formData.append("tier", tier);
    formData.append("assistant", JSON.stringify(activeConversation.assistant || defaultAssistantState));

    try {
      const res = await fetch(`${API_BASE}/math-solve`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      const solution = data.solution || null;
      const historyItem = solution
        ? {
            id: uid(),
            createdAt: Date.now(),
            prompt: prompt || solution.detectedProblem || "Math problem",
            result: solution,
          }
        : null;

      updateConversation(convoId, (conversation) => ({
        ...conversation,
        messages: solution
          ? [
              ...conversation.messages,
              { id: uid(), role: "user", content: prompt || "Solved from uploaded image." },
              {
                id: uid(),
                role: "assistant",
                content:
                  solution.finalAnswer ||
                  solution.summary ||
                  "Step-by-step solution added to Math Mode.",
              },
            ]
          : conversation.messages,
        math: {
          ...conversation.math,
          question: prompt,
          solverResult: solution,
          rawResponse: data.raw || "",
          isLoading: false,
          error: solution ? "" : "The solver returned an empty result.",
          activeHistoryId: historyItem?.id || conversation.math.activeHistoryId,
          history: historyItem
            ? [historyItem, ...(conversation.math.history || [])].slice(0, tier !== "free" ? 20 : 3)
            : conversation.math.history || [],
          lastSolvedAt: Date.now(),
        },
        updatedAt: Date.now(),
      }));
    } catch {
      updateConversation(convoId, (conversation) => ({
        ...conversation,
        math: {
          ...conversation.math,
          question: prompt,
          isLoading: false,
          error: "Math solving failed. Check the backend and required Ollama models.",
        },
        updatedAt: Date.now(),
      }));
    }
  };

  const activeView = activeConversation?.view || "chat";
  const activeMode = activeConversation?.mode || "Build";
  const isCenteredChat = activeView === "chat" && activeMode !== "Math" && (activeConversation?.messages || []).length === 0;
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
        onOpenHome={() => {
          openChatMode("Build");
          setIsSidebarOpen(false);
        }}
        onOpenControlMode={() => {
          openChatMode("Control");
          setIsSidebarOpen(false);
        }}
        onOpenMathMode={() => {
          openChatMode("Math");
          setIsSidebarOpen(false);
        }}
        onSelectConversation={(id) => {
          setActiveId(id);
          setIsSidebarOpen(false);
        }}
        onNewConversation={() => {
          createAndFocusConversation(activeConversation?.mode || "Build");
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
              const fresh = createConversation("Build");
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

        {activeView === "chat" && activeMode !== "Math" && (
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

        {activeView === "chat" && activeMode === "Math" && (
          <>
            <MathWorkspace
              state={activeConversation.math || defaultMathState}
              plan={tier}
              onOpenBilling={() => openToolView("update")}
              onChange={(next) =>
                updateConversation(activeConversation.id, (conversation) => ({
                  ...conversation,
                  math: next,
                  updatedAt: Date.now(),
                }))
              }
              onSolve={solveMath}
            />
            <div className="app-footer">Helper AI can make mistakes. Check important answers.</div>
          </>
        )}

        {activeView === "flashcards" && (
          <Flashcards
            state={activeConversation.flashcards || defaultFlashcardsState}
            plan={tier}
            onOpenBilling={() => openToolView("update")}
            onChange={(next) =>
              updateConversation(activeConversation.id, (conversation) => ({
                ...conversation,
                title:
                  next.deckTitle && conversation.title === getDefaultConversationTitle(activeMode, "flashcards")
                    ? makeTitle(next.deckTitle, "Flashcards")
                    : conversation.title,
                flashcards: next,
                updatedAt: Date.now(),
              }))
            }
          />
        )}

        {activeView === "slides" && (
          <Slides
            state={activeConversation.slides || defaultSlidesState}
            plan={tier}
            onOpenBilling={() => openToolView("update")}
            onChange={(next) =>
              updateConversation(activeConversation.id, (conversation) => ({
                ...conversation,
                title:
                  next.title && conversation.title === getDefaultConversationTitle(activeMode, "slides")
                    ? makeTitle(next.title, "Slides")
                    : conversation.title,
                slides: next,
                updatedAt: Date.now(),
              }))
            }
          />
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
