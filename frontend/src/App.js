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
const PROJECT_HANDLE = "student-helper";
const TRIAL_LENGTH_DAYS = 7;
const TRIAL_LENGTH_MS = TRIAL_LENGTH_DAYS * 24 * 60 * 60 * 1000;

const MODEL_OPTIONS = [
  { value: "max", label: "Local Max" },
  { value: "fast", label: "Local Fast" },
  { value: "builder", label: "Builder" },
];

const REASONING_OPTIONS = [
  { value: "fast", label: "Fast" },
  { value: "balanced", label: "Balanced" },
  { value: "deep", label: "Deep" },
];

const MODE_DETAILS = {
  Answer: {
    label: "Answer",
    summary: "Direct responses when you want the quickest correct answer.",
  },
  Tutor: {
    label: "Tutor",
    summary: "Step-by-step explanations with examples and teaching tone.",
  },
  Build: {
    label: "Build",
    summary: "UI, product, prompt, and implementation help in one workspace.",
  },
  Research: {
    label: "Research",
    summary: "Organize findings, compare options, and draft report-style outputs.",
  },
  Automation: {
    label: "Automation",
    summary: "Design recurring workflows, task flows, and operational prompts.",
  },
  Math: {
    label: "Math",
    summary: "Camera-first math solving with full worked steps.",
  },
};

const WELCOME_CAPABILITIES = [
  {
    title: "Reasoning and Analysis",
    detail: "Switch between fast and deep thinking with a live context meter for each thread.",
    tags: ["Deep reasoning", "Context aware", "Multi-step output"],
  },
  {
    title: "Coding and Product Build",
    detail: "Use Build mode for features, prompt systems, UI planning, and implementation help.",
    tags: ["Product design", "Coding help", "Prompt systems"],
  },
  {
    title: "Multimodal and Files",
    detail: "Upload screenshots, solve from images, and turn notes into flashcards or slides.",
    tags: ["Vision", "Flashcards", "Slides"],
  },
  {
    title: "Research and Reports",
    detail: "Draft structured research-style answers with tradeoffs, assumptions, and next steps.",
    tags: ["Comparisons", "Reports", "Decision support"],
  },
  {
    title: "Automation Workflows",
    detail: "Map automations, recurring tasks, agent flows, and plugin-style integrations.",
    tags: ["Workflows", "Integrations", "Task design"],
  },
  {
    title: "Persistent Project Memory",
    detail: "Keep threads, modes, and tool outputs inside one project-like desktop workspace.",
    tags: ["Threads", "Saved history", "Project context"],
  },
];

const defaultAssistantState = {
  model: "max",
  reasoning: "deep",
  showIntegrationHint: true,
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
  if (tier === "trial") return "Trial";
  if (tier === "pro") return "Max";
  return "Starter";
}

function getDefaultConversationTitle(mode = "Build", view = "chat") {
  if (view === "flashcards") return "Flashcards";
  if (view === "slides") return "Slides";
  if (mode === "Math") return "Math Solver";
  return "New chat";
}

function isDefaultConversationTitle(title, mode = "Build", view = "chat") {
  const normalizedTitle = String(title || "").trim().toLowerCase();
  const defaults = new Set([
    getDefaultConversationTitle(mode, view).toLowerCase(),
    "new chat",
    "new chat",
    "math solver",
    "flashcards",
    "slides",
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

function estimateMessageTokens(messages) {
  const text = (messages || []).map((message) => String(message?.content || "")).join("\n");
  if (!text.trim()) return 0;
  return Math.ceil(text.length / 4);
}

function getContextBudget(tier, assistant) {
  const base = tier === "free" ? 4096 : 8192;
  return assistant?.reasoning === "deep" ? base + 2048 : base;
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
  const [isBillingOpen, setIsBillingOpen] = useState(false);

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
  const planLabel = getPlanLabel(tier);
  const planActionLabel = tier === "free" ? "Upgrade" : "Manage";

  const orderedConversations = useMemo(
    () => [...conversations].sort((a, b) => b.updatedAt - a.updatedAt),
    [conversations],
  );

  const contextStats = useMemo(() => {
    const assistant = activeConversation?.assistant || defaultAssistantState;
    const budget = getContextBudget(tier, assistant);
    const used = estimateMessageTokens(activeConversation?.messages || []);
    const percent = budget > 0 ? Math.min(100, Math.round((used / budget) * 100)) : 0;

    return {
      used,
      budget,
      percent,
    };
  }, [activeConversation, tier]);

  const updateConversation = (id, updater) => {
    setConversations((previous) =>
      previous.map((conversation) =>
        conversation.id === id ? normalizeConversation(updater(conversation)) : conversation,
      ),
    );
  };

  const updateAssistant = (patch) => {
    if (!activeConversation) return;

    updateConversation(activeConversation.id, (conversation) => ({
      ...conversation,
      assistant: { ...conversation.assistant, ...patch },
      updatedAt: Date.now(),
    }));
  };

  const createAndFocusConversation = (mode = activeConversation?.mode || "Build", view = "chat") => {
    const fresh = createConversation(mode, view);
    setConversations((previous) => [fresh, ...previous]);
    setActiveId(fresh.id);
  };

  const resetConversationMode = (nextMode) => {
    if (!activeConversation) return;

    updateConversation(activeConversation.id, (conversation) => ({
      ...conversation,
      mode: nextMode,
      view: "chat",
      title: getDefaultConversationTitle(nextMode, "chat"),
      messages: [],
      math: { ...defaultMathState },
      updatedAt: Date.now(),
    }));
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
  const assistant = activeConversation?.assistant || defaultAssistantState;
  const workspaceLabel =
    activeView === "chat" ? MODE_DETAILS[activeMode]?.label || activeMode : activeView === "flashcards" ? "Flashcards" : "Slides";
  const workspaceTitle =
    activeView === "chat"
      ? activeConversation?.title || "New chat"
      : activeView === "flashcards"
      ? activeConversation?.flashcards?.deckTitle || "Flashcards"
      : activeConversation?.slides?.title || "Slides";
  const workspaceSummary =
    activeView === "chat"
      ? MODE_DETAILS[activeMode]?.summary || "A desktop workspace for study, building, and AI-assisted tasks."
      : activeView === "flashcards"
      ? "Generate study decks, quiz yourself, and drill recall."
      : "Draft, theme, and refine presentation-ready slide decks.";
  const modelLabel = MODEL_OPTIONS.find((item) => item.value === assistant.model)?.label || "Local Max";
  const reasoningLabel = REASONING_OPTIONS.find((item) => item.value === assistant.reasoning)?.label || "Deep";

  return (
    <div className="layout">
      <Sidebar
        mode={activeMode}
        activeView={activeView}
        account={account}
        conversations={orderedConversations}
        activeId={activeConversation?.id}
        setMode={resetConversationMode}
        onOpenBilling={() => setIsBillingOpen(true)}
        onSelectConversation={setActiveId}
        onNewConversation={() => createAndFocusConversation(activeConversation?.mode || "Build")}
        onOpenTool={(tool) => createAndFocusConversation(activeConversation?.mode || "Build", tool)}
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
        <div className="workspace-header">
          <div className="workspace-title-block">
            <div className="workspace-eyebrow">{workspaceLabel}</div>
            <div className="workspace-title-row">
              <h1>{workspaceTitle}</h1>
              <span className="workspace-plan-pill">{planLabel}</span>
            </div>
            <p className="workspace-summary">{workspaceSummary}</p>
          </div>

          <div className="workspace-actions">
            <span className="workspace-stat-pill">{modelLabel}</span>
            <span className="workspace-stat-pill">{reasoningLabel} reasoning</span>
            <span className="workspace-stat-pill">
              {contextStats.used}/{contextStats.budget} tokens
            </span>
            <button className="quiet-btn" onClick={() => setIsBillingOpen(true)}>
              {planActionLabel}
            </button>
            <button
              className="quiet-btn"
              onClick={() =>
                activeView === "chat"
                  ? createAndFocusConversation(activeConversation?.mode || "Build")
                  : createAndFocusConversation(activeConversation?.mode || "Build", activeView)
              }
            >
              New
            </button>
          </div>
        </div>

        {activeView === "chat" && activeMode !== "Math" && (
          <>
            <ChatWindow
              mode={activeMode}
              messages={activeConversation?.messages || []}
              projectName={PROJECT_HANDLE}
              assistant={assistant}
              contextStats={contextStats}
              capabilities={WELCOME_CAPABILITIES}
              onUsePrompt={sendMessage}
              onDismissIntegrationHint={() => updateAssistant({ showIntegrationHint: false })}
            />
            <ChatInput
              mode={activeMode}
              assistant={assistant}
              contextStats={contextStats}
              onAssistantChange={updateAssistant}
              onSend={sendMessage}
              onSendImage={sendImageMessage}
            />
          </>
        )}

        {activeView === "chat" && activeMode === "Math" && (
          <MathWorkspace
            state={activeConversation.math || defaultMathState}
            plan={tier}
            onOpenBilling={() => setIsBillingOpen(true)}
            onChange={(next) =>
              updateConversation(activeConversation.id, (conversation) => ({
                ...conversation,
                math: next,
                updatedAt: Date.now(),
              }))
            }
            onSolve={solveMath}
          />
        )}

        {activeView === "flashcards" && (
          <Flashcards
            state={activeConversation.flashcards || defaultFlashcardsState}
            plan={tier}
            onOpenBilling={() => setIsBillingOpen(true)}
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
            onOpenBilling={() => setIsBillingOpen(true)}
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

        <div className="workspace-footer">
          <span>Local workspace</span>
          <span>{activeView === "chat" ? `${activeMode} mode` : workspaceLabel}</span>
          <span>{modelLabel}</span>
          <span>{reasoningLabel} reasoning</span>
          <span>{contextStats.percent}% context used</span>
        </div>
      </div>

      {isBillingOpen && (
        <BillingModal
          account={account}
          trialLengthDays={TRIAL_LENGTH_DAYS}
          onClose={() => setIsBillingOpen(false)}
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
            setIsBillingOpen(false);
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
            setIsBillingOpen(false);
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
            setIsBillingOpen(false);
          }}
        />
      )}
    </div>
  );
}

export default App;
