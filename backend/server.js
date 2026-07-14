import "dotenv/config";
import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import multer from "multer";
import fs from "fs";
import {
  createComputerControlPlan,
  convertParsedComputerPlanToSteps,
  handleComputerControlCommand,
  handleComputerControlPlan,
} from "./browserControl.js";

const app = express();
const PORT = Number(process.env.PORT) || 5050;
const GROQ_BASE_URL =
  process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1";
const OPENAI_BASE_URL =
  process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const ENABLE_WARMUP =
  String(process.env.GROQ_ENABLE_WARMUP || "").toLowerCase() === "true";
const CHAT_MODEL = process.env.GROQ_CHAT_MODEL || "llama-3.1-8b-instant";
const FAST_MODEL = process.env.GROQ_FAST_MODEL || CHAT_MODEL;
const PRO_MODEL = process.env.GROQ_PRO_MODEL || "openai/gpt-oss-20b";
const VISION_MODEL =
  process.env.GROQ_VISION_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct";
const OPENAI_API_KEY =
  process.env.OPENAI_API_KEY || process.env.AI_API_KEY || "";
const OPENAI_FAST_MODEL = process.env.OPENAI_FAST_MODEL || "gpt-4o-mini";
const OPENAI_PRO_MODEL = process.env.OPENAI_PRO_MODEL || "gpt-4o";
const OPENAI_VISION_MODEL =
  process.env.OPENAI_VISION_MODEL || OPENAI_FAST_MODEL;
const OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_CHAT_MODEL =
  process.env.OLLAMA_CHAT_MODEL || "llama3:latest";
const OLLAMA_VISION_MODEL =
  process.env.OLLAMA_VISION_MODEL || "llava:latest";
const REQUESTED_AI_PROVIDER = String(process.env.AI_PROVIDER || "")
  .trim()
  .toLowerCase();
const AUTO_PROVIDER_FALLBACK =
  String(process.env.AI_AUTO_FALLBACK || "true").toLowerCase() !== "false";
const ENABLE_COMPUTER_AI_PLANNER =
  String(process.env.COMPUTER_MODE_USE_AI_PLANNER || "").toLowerCase() ===
  "true";
const REGULAR_MODE = "regular";
const COMPUTER_MODE = "computer";
const DEFAULT_ASSISTANT_CONFIG = {
  model: "fast",
  reasoning: "fast",
};
const OLLAMA_REACHABILITY_CACHE_TTL_MS = 30 * 1000;
let ollamaReachabilityCache = {
  checkedAt: 0,
  isAvailable: false,
};
const WEB_UI_DESIGN_BRIEF = `
When the user asks for a sidebar, chat UI, web app layout, HTML/CSS/JS interface, or frontend design work, use this brief:

The sidebar collapse/expand must be fully functional.

When collapsed:
- Sidebar shrinks from 280px to 76px
- Only icons remain visible
- Text labels fade out smoothly
- Chat titles hide
- Search bar becomes an icon-only button
- Bottom profile/settings section becomes icon-only
- Tooltips appear on hover for hidden labels
- Main content automatically shifts to fill the extra space

When expanded:
- Sidebar returns to full width
- Text labels fade back in
- Chat history is fully visible
- Search input is usable again
- Profile/settings section expands
- Main content resizes smoothly

Animation requirements:
- Smooth width transition
- No layout jumping
- Use CSS transitions
- Collapse state should be saved in localStorage
- Add a keyboard shortcut: Ctrl+B or Cmd+B to toggle sidebar
- Add a clear toggle button with an arrow icon that changes direction

Make sure the collapse button, mobile drawer, and desktop collapse behavior all work correctly together.

Build a fully working, professional, unique sidebar for an AI chat web app using HTML, CSS, and JavaScript in one complete file.

The sidebar must include:
- App logo/name at the top
- New Chat button
- Search input for chats
- Chat history grouped by Today, Yesterday, Previous 7 Days, Older
- Each chat item should have:
  - Icon
  - Chat title
  - Timestamp
  - Hover state
  - Active selected state
  - Three-dot menu button
- Collapsible sidebar button
- Bottom account/settings section
- Upgrade/Pro card
- Light and dark mode support
- Mobile slide-out drawer behavior
- Smooth animations
- Clean spacing
- Rounded corners
- Subtle borders and shadows
- Professional typography
- Fully functional JavaScript for:
  - Opening/closing sidebar
  - Collapsing sidebar
  - Searching chats
  - Selecting active chat
  - Opening three-dot menus
  - Switching light/dark mode
  - Mobile overlay close

Style direction:
Make it unique but still professional. Do not copy ChatGPT exactly. Use a premium SaaS dashboard style with soft gradients, glassy panels, subtle icons, clean spacing, and modern micro-interactions.

Important design details:
- Sidebar width: 280px expanded, 76px collapsed
- Border radius: 16px
- Use CSS variables for colors
- Use a modern font stack: Inter, SF Pro Display, system-ui, sans-serif
- Background should feel clean, not too busy
- Text must be high contrast and readable
- Icons can use simple emoji or inline SVG
- Chat items should truncate long titles with ellipsis
- Sidebar should be keyboard accessible
- Include aria-labels on buttons
- Make it responsive for desktop, tablet, and mobile

Create a clean, professional ChatGPT-style web app UI.

Requirements:
- Modern responsive layout
- Left sidebar with:
  - New chat button
  - Search chats
  - Chat history list
  - Settings button at bottom
- Main screen with:
  - Header/title area
  - Center welcome state
  - Message area
  - Sticky input box at bottom
- Right sidebar with:
  - Current chat info
  - Tools/settings panel
  - Helpful shortcuts
- Sidebars should be collapsible
- Mobile view should hide sidebars behind menu buttons
- Smooth animations
- Clean spacing, rounded corners, subtle shadows
- Light and dark mode
- Professional font and typography
- Working buttons, toggles, and sidebar open/close behavior

Use HTML, CSS, and JavaScript only.

Make the UI feel premium, minimal, fast, and polished. Include all code in one complete working file.
`.trim();

const COMPUTER_CONTROL_PLANNER_PROMPT = `
You are the planning layer for Operator AI Computer Control.

Your job is to convert the user's browser request into a very simple chronological JSON action plan.
Do not explain anything. Return valid JSON only. No markdown. No code fences.

Supported actions:
- open_url
- wait_for_page
- site_search
- click
- fill
- scroll
- summarize
- search_page
- find_contact
- copy_headline
- go_back
- go_forward

Return one of these shapes:

For executable plans:
{
  "type": "plan",
  "steps": [
    { "action": "open_url", "siteLabel": "YouTube", "url": "https://www.youtube.com" },
    { "action": "wait_for_page" },
    { "action": "site_search", "siteLabel": "YouTube", "query": "Dhar Mann", "directUrl": "https://www.youtube.com/results?search_query=Dhar%20Mann" }
  ]
}

For blocked, risky, or ambiguous requests:
{
  "type": "message",
  "message": "Short direct message for the user."
}

Rules:
- NEVER treat the entire user sentence as a URL.
- Separate destination websites from search queries and click targets.
- Put steps in chronological order.
- If the user says open/go to/navigate to, make open_url first.
- After opening a site, add wait_for_page before any click, fill, search, or read action.
- If the user says search/look up/find/browse/shop for/check out something on a site, use site_search with the query only.
- For current-page follow-ups like "scroll down", "summarize this page", "search this page for pricing", "click login", "fill email with x", "go back", or "go forward", return only the follow-up step and do not add open_url.
- Use official URLs for obvious sites.
- You may use directUrl for known site searches when obvious.
- Never include passwords, verification codes, payments, purchases, deletes, sending messages, or final form submits in a plan. Return type "message" instead.
- Keep the plan minimal and reliable.
`.trim();

const OUTPUT_LIMITS = {
  vision: {
    fast: { free: 900, pro: 1400 },
    balanced: { free: 1600, pro: 2400 },
    deep: { free: 2400, pro: 3400 },
  },
  regular: {
    fast: { free: 1200, pro: 1800 },
    balanced: { free: 2200, pro: 3200 },
    deep: { free: 3200, pro: 4200 },
  },
  computer: {
    fast: { free: 1400, pro: 2200 },
    balanced: { free: 2400, pro: 3400 },
    deep: { free: 3400, pro: 4600 },
  },
};
const OUTPUT_LIMIT_OVERRIDE = Number(
  process.env.AI_MAX_COMPLETION_TOKENS || 0,
);
const COMPUTER_TASK_POLL_TIMEOUT_MS = 90 * 1000;
const COMPUTER_TASK_RETRY_WINDOW_MS = 30 * 1000;
const computerSessions = new Map();
let latestComputerSessionId = "";

function createServerId(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function getComputerSession(sessionId) {
  return computerSessions.get(String(sessionId || "").trim()) || null;
}

function serializeComputerTask(task) {
  if (!task) return null;
  return {
    id: task.id,
    command: task.command,
    context: Array.isArray(task.context) ? task.context : [],
    status: task.status,
    result: task.result || "",
    error: task.error || "",
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    claimedAt: task.claimedAt || 0,
  };
}

function serializeComputerSession(session) {
  if (!session) return null;
  return {
    id: session.id,
    status: session.status,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    activeTask: serializeComputerTask(session.activeTask),
    pendingCount: session.queue.length,
    completedCount: session.completedTasks.length,
    memory: session.memory.slice(-12),
    recentEvents: session.events.slice(-8),
  };
}

function pushComputerEvent(session, type, message, extra = {}) {
  session.events.push({
    id: createServerId("evt"),
    type,
    message,
    createdAt: Date.now(),
    ...extra,
  });
  session.events = session.events.slice(-30);
}

function promoteNextComputerTask(session) {
  if (session.activeTask || !session.queue.length) return;
  const nextTask = session.queue.shift();
  nextTask.status = "pending";
  nextTask.updatedAt = Date.now();
  session.activeTask = nextTask;
  session.updatedAt = Date.now();
  pushComputerEvent(session, "task-pending", `Queued: ${nextTask.command}`, {
    taskId: nextTask.id,
  });
}

function createComputerSession() {
  const session = {
    id: createServerId("ccs"),
    status: "idle",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    activeTask: null,
    queue: [],
    completedTasks: [],
    memory: [],
    events: [],
  };
  computerSessions.set(session.id, session);
  latestComputerSessionId = session.id;
  pushComputerEvent(
    session,
    "session-created",
    "Computer Control session is ready for Conductor.",
  );
  return session;
}

function getOrCreateComputerSession(sessionId = "") {
  const existing = getComputerSession(sessionId);
  if (existing) return existing;
  if (sessionId && !existing) return null;
  return createComputerSession();
}

function enqueueComputerTask(session, command, source = "web", context = []) {
  const task = {
    id: createServerId("task"),
    command: String(command || "").trim(),
    context: Array.isArray(context) ? context.slice(-16) : [],
    source,
    status: "queued",
    result: "",
    error: "",
    claimedAt: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  session.queue.push(task);
  session.updatedAt = Date.now();
  session.status = "waiting_for_extension";
  latestComputerSessionId = session.id;
  session.memory.push({
    role: "user",
    content: task.command,
    source,
    createdAt: task.createdAt,
  });
  session.memory = session.memory.slice(-40);
  pushComputerEvent(session, "task-queued", `Sent to Conductor: ${task.command}`, {
    taskId: task.id,
    source,
  });
  promoteNextComputerTask(session);
  return task;
}

function claimComputerTask(session) {
  promoteNextComputerTask(session);
  const task = session.activeTask;
  if (!task) return null;
  if (
    task.status === "claimed" &&
    Date.now() - Number(task.claimedAt || 0) < COMPUTER_TASK_RETRY_WINDOW_MS
  ) {
    return null;
  }
  task.status = "claimed";
  task.claimedAt = Date.now();
  task.updatedAt = Date.now();
  session.status = "running";
  session.updatedAt = Date.now();
  pushComputerEvent(session, "task-claimed", `Conductor is working on: ${task.command}`, {
    taskId: task.id,
  });
  return task;
}

function completeComputerTask(session, taskId, result, error = "") {
  const task = session.activeTask;
  if (!task || task.id !== taskId) {
    throw new Error("That Computer Control task is no longer active.");
  }

  task.status = error ? "failed" : "completed";
  task.result = String(result || "").trim();
  task.error = String(error || "").trim();
  task.updatedAt = Date.now();
  session.updatedAt = Date.now();
  session.status = error ? "failed" : "idle";
  pushComputerEvent(
    session,
    error ? "task-failed" : "task-completed",
    error || task.result || "Computer Control task finished.",
    { taskId: task.id },
  );
  session.activeTask = null;
  session.completedTasks.push({
    ...task,
  });
  session.completedTasks = session.completedTasks.slice(-30);
  session.memory.push({
    role: error ? "system" : "assistant",
    content: error || task.result || "Computer Control task finished.",
    source: "extension",
    createdAt: Date.now(),
  });
  session.memory = session.memory.slice(-40);
  promoteNextComputerTask(session);
  if (session.activeTask) {
    session.status = "waiting_for_extension";
  }
  return task;
}

app.use(cors());
app.use(express.json());

const upload = multer({ dest: "uploads/" });

app.get("/", (_, res) => {
  res.send("Operator AI backend running");
});

function safeDelete(path) {
  if (!path) return;
  try {
    fs.unlinkSync(path);
  } catch {
    // best-effort cleanup
  }
}

function normalizeTier(value) {
  return value === "pro" || value === "trial" ? "pro" : "free";
}

function normalizeMode(value) {
  if (
    value === COMPUTER_MODE ||
    value === "Control" ||
    value === "Automation"
  ) {
    return COMPUTER_MODE;
  }
  return REGULAR_MODE;
}

function parseAssistantConfig(raw) {
  if (!raw) {
    return { ...DEFAULT_ASSISTANT_CONFIG };
  }

  if (typeof raw === "string") {
    try {
      return parseAssistantConfig(JSON.parse(raw));
    } catch {
      return { ...DEFAULT_ASSISTANT_CONFIG };
    }
  }

  return {
    model: raw.model === "pro" ? "pro" : "fast",
    reasoning:
      raw.reasoning === "deep"
        ? "deep"
        : raw.reasoning === "balanced"
          ? "balanced"
          : "fast",
  };
}

function getOutputLimit(reasoning, isPro, useVision, mode) {
  if (
    Number.isFinite(OUTPUT_LIMIT_OVERRIDE) &&
    OUTPUT_LIMIT_OVERRIDE > 0
  ) {
    return OUTPUT_LIMIT_OVERRIDE;
  }

  const profileKey = useVision
    ? "vision"
    : mode === COMPUTER_MODE
      ? "computer"
      : "regular";
  const profile =
    OUTPUT_LIMITS[profileKey]?.[reasoning] || OUTPUT_LIMITS[profileKey]?.fast;
  return isPro ? profile.pro : profile.free;
}

function getReasoningEffort(model, reasoning) {
  if (model.startsWith("openai/gpt-oss-")) {
    return reasoning === "deep"
      ? "high"
      : reasoning === "balanced"
        ? "medium"
        : "low";
  }

  if (model.startsWith("qwen/")) {
    return reasoning === "deep"
      ? "high"
      : reasoning === "balanced"
        ? "medium"
        : "low";
  }

  return null;
}

function getAiProvider() {
  if (REQUESTED_AI_PROVIDER) {
    if (REQUESTED_AI_PROVIDER === "groq") {
      if (!process.env.GROQ_API_KEY) {
        throw new Error(
          "AI_PROVIDER is set to groq but GROQ_API_KEY is missing.",
        );
      }
      return "groq";
    }

    if (REQUESTED_AI_PROVIDER === "openai") {
      if (!OPENAI_API_KEY) {
        throw new Error(
          "AI_PROVIDER is set to openai but AI_API_KEY/OPENAI_API_KEY is missing.",
        );
      }
      return "openai";
    }

    if (REQUESTED_AI_PROVIDER === "ollama") {
      return "ollama";
    }

    throw new Error(
      "AI_PROVIDER must be one of: groq, openai, ollama.",
    );
  }

  if (process.env.GROQ_API_KEY) {
    return "groq";
  }

  if (OPENAI_API_KEY) {
    return "openai";
  }

  return "ollama";
}

function getCapabilityConfigForProvider(
  provider,
  tier,
  mode,
  useVision = false,
  assistant = {},
) {
  const isPro = normalizeTier(tier) === "pro";
  const assistantConfig = parseAssistantConfig(assistant);
  const shouldUseProModel =
    assistantConfig.model === "pro" && isPro && !useVision;
  const normalizedMode = normalizeMode(mode);
  const model = useVision
    ? provider === "groq"
      ? VISION_MODEL
      : provider === "openai"
        ? OPENAI_VISION_MODEL
        : OLLAMA_VISION_MODEL
    : shouldUseProModel
      ? provider === "groq"
        ? PRO_MODEL
        : provider === "openai"
          ? OPENAI_PRO_MODEL
          : OLLAMA_CHAT_MODEL
      : provider === "groq"
        ? FAST_MODEL
        : provider === "openai"
          ? OPENAI_FAST_MODEL
          : OLLAMA_CHAT_MODEL;

  return {
    provider,
    model,
    temperature: useVision
      ? 0.2
      : normalizedMode === COMPUTER_MODE
        ? 0.15
        : 0.35,
    topP: 0.9,
    maxCompletionTokens: getOutputLimit(
      assistantConfig.reasoning,
      isPro,
      useVision,
      normalizedMode,
    ),
    reasoningEffort:
      provider === "groq"
        ? getReasoningEffort(model, assistantConfig.reasoning)
        : null,
  };
}

function getCapabilityConfig(tier, mode, useVision = false, assistant = {}) {
  return getCapabilityConfigForProvider(
    getAiProvider(),
    tier,
    mode,
    useVision,
    assistant,
  );
}

async function isOllamaReachable(forceRefresh = false) {
  const now = Date.now();
  if (
    !forceRefresh &&
    now - ollamaReachabilityCache.checkedAt < OLLAMA_REACHABILITY_CACHE_TTL_MS
  ) {
    return ollamaReachabilityCache.isAvailable;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 900);

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      method: "GET",
      signal: controller.signal,
    });
    ollamaReachabilityCache = {
      checkedAt: Date.now(),
      isAvailable: response.ok,
    };
  } catch {
    ollamaReachabilityCache = {
      checkedAt: Date.now(),
      isAvailable: false,
    };
  } finally {
    clearTimeout(timeoutId);
  }

  return ollamaReachabilityCache.isAvailable;
}

async function getProviderCandidates(preferredProvider) {
  const providers = [preferredProvider];
  if (!AUTO_PROVIDER_FALLBACK) {
    return providers;
  }

  if (preferredProvider !== "groq" && process.env.GROQ_API_KEY) {
    providers.push("groq");
  }

  if (preferredProvider !== "openai" && OPENAI_API_KEY) {
    providers.push("openai");
  }

  if (
    preferredProvider !== "ollama" &&
    (await isOllamaReachable())
  ) {
    providers.push("ollama");
  }

  return providers;
}

async function isComputerPlannerAvailable() {
  if (!ENABLE_COMPUTER_AI_PLANNER) {
    return false;
  }

  if (process.env.GROQ_API_KEY || OPENAI_API_KEY) {
    return true;
  }

  if (REQUESTED_AI_PROVIDER === "ollama") {
    return isOllamaReachable();
  }

  return false;
}

function buildChatSystemPrompt(mode, tier, assistant = {}) {
  const isPro = normalizeTier(tier) === "pro";
  const normalizedMode = normalizeMode(mode);
  const assistantConfig = parseAssistantConfig(assistant);

  const common = [
    isPro
      ? "You are Operator AI Pro, a fast assistant for school, work, and computer tasks."
      : "You are Operator AI, a fast assistant for school, work, and everyday tasks.",
    "Be clear, accurate, direct, and practical.",
    "Be honest about limitations. Do not claim to browse the web, inspect local files, or control the device unless the result of that action is actually available in the conversation.",
    assistantConfig.reasoning === "deep"
      ? "Think carefully when needed and fully answer every part of the user's request."
      : assistantConfig.reasoning === "balanced"
        ? "Balance speed with clear structure and enough detail to finish the answer."
        : "Prefer the fastest correct answer, but do not cut the answer short when the user needs more detail.",
  ].join(" ");

  if (normalizedMode === COMPUTER_MODE) {
    return `${common} You are in Computer Control. Focus on commands, system actions, app workflows, browser-task planning, and clear step-by-step help for doing tasks on a computer. If direct Chrome control is unavailable for a request, say exactly what the user should do next.`;
  }

  return `${common} You are in Regular AI mode. Help with questions, writing, brainstorming, studying, coding guidance, and image-based follow-up questions when an image is attached. For frontend and UI work, follow this design brief closely: ${WEB_UI_DESIGN_BRIEF}`;
}

function getApiBaseUrl(provider) {
  if (provider === "groq") return GROQ_BASE_URL;
  if (provider === "openai") return OPENAI_BASE_URL;
  return OLLAMA_BASE_URL;
}

function getApiHeaders(provider) {
  if (provider === "ollama") {
    return {
      "Content-Type": "application/json",
    };
  }

  const apiKey =
    provider === "groq" ? process.env.GROQ_API_KEY : OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      provider === "groq"
        ? "Missing GROQ_API_KEY. Add it to backend/.env before starting the server."
        : "Missing AI_API_KEY or OPENAI_API_KEY. Add one to backend/.env before starting the server.",
    );
  }

  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

function extractApiErrorMessage(text) {
  try {
    const parsed = JSON.parse(text);
    const message = parsed?.error?.message;
    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
  } catch {
    // fall back to raw text
  }

  return String(text || "").trim();
}

function isNetworkBlockedMessage(detail) {
  const normalizedDetail = String(detail || "").toLowerCase();
  return (
    normalizedDetail.includes("access denied") ||
    normalizedDetail.includes("network settings")
  );
}

function createNetworkBlockedError(detail) {
  const error = new Error(
    "The current AI provider blocked this request from your network. VPNs, proxies, or restricted exit regions often cause this. The app will try any configured fallback provider automatically. If none are available, switch VPN servers, add an OpenAI key, or run Ollama locally on this machine.",
  );
  error.code = "NETWORK_BLOCKED";
  error.detail = detail;
  return error;
}

function isNetworkBlockedError(error) {
  return error?.code === "NETWORK_BLOCKED";
}

async function throwApiError(response, label) {
  const text = await response.text();
  const detail = extractApiErrorMessage(text);

  if (response.status === 403 && isNetworkBlockedMessage(detail)) {
    throw createNetworkBlockedError(detail);
  }

  throw new Error(
    `${label} ${response.status}: ${detail || "Unknown API error"}`,
  );
}

function buildChatMessages(message, mode, tier, assistant = {}) {
  return [
    { role: "system", content: buildChatSystemPrompt(mode, tier, assistant) },
    { role: "user", content: String(message || "").trim() || "Hello." },
  ];
}

function stripJsonCodeFences(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  return trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function parseJsonResponse(text) {
  const cleaned = stripJsonCodeFences(text);

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("AI planner returned invalid JSON.");
  }
}

function normalizePlannerActionName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
}

function isValidHttpUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function deriveSiteLabelFromUrl(url) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./i, "");
    const root = hostname.split(".")[0] || hostname;
    return root
      .split(/[-_]/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  } catch {
    return "Website";
  }
}

function normalizeComputerPlanStep(rawStep, lastSiteLabel = "") {
  const action = normalizePlannerActionName(rawStep?.action);

  if (action === "open-url") {
    const url = String(rawStep?.url || "").trim();
    if (!isValidHttpUrl(url)) {
      throw new Error("AI planner returned an invalid open_url step.");
    }
    return {
      action,
      url,
      siteLabel:
        String(rawStep?.siteLabel || rawStep?.site || "").trim() ||
        deriveSiteLabelFromUrl(url),
    };
  }

  if (action === "wait-for-page") {
    return { action };
  }

  if (action === "site-search") {
    const query = String(rawStep?.query || "").trim();
    if (!query) {
      throw new Error("AI planner returned an empty site_search query.");
    }
    const directUrl = String(rawStep?.directUrl || rawStep?.direct_url || "").trim();
    if (directUrl && !isValidHttpUrl(directUrl)) {
      throw new Error("AI planner returned an invalid site_search direct URL.");
    }
    return {
      action,
      query,
      directUrl,
      siteLabel:
        String(rawStep?.siteLabel || rawStep?.site || "").trim() ||
        lastSiteLabel ||
        "the site",
    };
  }

  if (action === "click") {
    const target = String(rawStep?.target || rawStep?.text || "").trim();
    if (!target) {
      throw new Error("AI planner returned an empty click target.");
    }
    return { action, target };
  }

  if (action === "fill") {
    const field = String(rawStep?.field || "").trim();
    const value = String(rawStep?.value || "").trim();
    if (!field || !value) {
      throw new Error("AI planner returned an incomplete fill step.");
    }
    return { action, field, value };
  }

  if (action === "scroll") {
    return {
      action,
      direction:
        String(rawStep?.direction || "").trim().toLowerCase() === "up"
          ? "up"
          : "down",
    };
  }

  if (action === "search-page") {
    const query = String(rawStep?.query || "").trim();
    if (!query) {
      throw new Error("AI planner returned an empty search_page query.");
    }
    return { action, query };
  }

  if (
    [
      "summarize",
      "find-contact",
      "copy-headline",
      "go-back",
      "go-forward",
    ].includes(action)
  ) {
    return { action };
  }

  throw new Error(`AI planner returned an unsupported action: ${action || "unknown"}`);
}

function normalizeComputerPlan(rawPlan) {
  const resultType = String(
    rawPlan?.type || rawPlan?.mode || rawPlan?.result_type || "plan",
  )
    .trim()
    .toLowerCase();

  if (resultType === "message") {
    return {
      type: "message",
      message:
        String(rawPlan?.message || rawPlan?.reason || "").trim() ||
        "Computer Control needs a clearer instruction before it can continue.",
    };
  }

  const rawSteps = Array.isArray(rawPlan?.steps)
    ? rawPlan.steps
    : Array.isArray(rawPlan?.plan?.steps)
      ? rawPlan.plan.steps
      : [];

  if (!rawSteps.length) {
    throw new Error("AI planner returned no steps.");
  }

  let lastSiteLabel = "";
  const steps = rawSteps.map((rawStep) => {
    const normalized = normalizeComputerPlanStep(rawStep, lastSiteLabel);
    if (normalized.action === "open-url" && normalized.siteLabel) {
      lastSiteLabel = normalized.siteLabel;
    }
    if (normalized.action === "site-search" && normalized.siteLabel) {
      lastSiteLabel = normalized.siteLabel;
    }
    return normalized;
  });

  return {
    type: "plan",
    plan: {
      kind: "ai-plan",
      steps,
    },
  };
}

function collectExpectedComputerActions(message) {
  const normalized = String(message || "").trim().toLowerCase();
  const expected = new Set();

  if (
    /\b(open|go to|navigate to|launch|head to|head over to|take me to)\b/.test(
      normalized,
    )
  ) {
    expected.add("open-url");
  }

  if (/search(?:\s+this)?\s+page\s+for\b/.test(normalized)) {
    expected.add("search-page");
  } else if (
    /\b(search(?:\s+up)?|look up|look for|look at|browse|shop for|check out)\b/.test(
      normalized,
    )
  ) {
    expected.add("site-search");
  }

  if (/\bclick(?:\s+on)?\b/.test(normalized)) {
    expected.add("click");
  }

  if (/^fill\b|\bfill\s+.+\s+with\s+.+/.test(normalized)) {
    expected.add("fill");
  }

  if (/\bscroll\s+(up|down)\b/.test(normalized)) {
    expected.add("scroll");
  }

  if (/\b(?:summarize|summarise)\b/.test(normalized)) {
    expected.add("summarize");
  }

  if (/\bfind\s+the\s+contact\s+page\b/.test(normalized)) {
    expected.add("find-contact");
  }

  if (/\bcopy\s+the\s+main\s+headline\b/.test(normalized)) {
    expected.add("copy-headline");
  }

  if (/\bgo\s+back\b/.test(normalized)) {
    expected.add("go-back");
  }

  if (/\bgo\s+forward\b/.test(normalized)) {
    expected.add("go-forward");
  }

  return expected;
}

function validateComputerPlanAgainstMessage(message, normalizedPlan) {
  const expected = collectExpectedComputerActions(message);
  if (!expected.size) {
    return normalizedPlan;
  }

  const actual = new Set(
    (normalizedPlan?.steps || []).map((step) => normalizePlannerActionName(step?.action)),
  );

  for (const action of expected) {
    if (!actual.has(action)) {
      throw new Error(`AI planner missed a required action: ${action}`);
    }
  }

  return normalizedPlan;
}

async function planComputerControlWithAi(
  message,
  tier,
  assistant = {},
  history = [],
) {
  const compactHistory = Array.isArray(history)
    ? history
        .filter(
          (item) =>
            item &&
            typeof item === "object" &&
            String(item.content || "").trim(),
        )
        .slice(-10)
        .map((item) => ({
          role: item.role === "assistant" ? "assistant" : "user",
          content: String(item.content || "").trim(),
        }))
    : [];
  const plannerMessages = [
    { role: "system", content: COMPUTER_CONTROL_PLANNER_PROMPT },
    ...compactHistory,
    {
      role: "user",
      content: String(message || "").trim() || "Open YouTube and search up FlightReacts.",
    },
  ];

  const plannerAssistant = {
    ...assistant,
    reasoning:
      assistant?.reasoning === "fast" ? "balanced" : assistant?.reasoning,
  };

  const response = await askChatWithFallback(plannerMessages, {
    tier,
    mode: COMPUTER_MODE,
    assistant: plannerAssistant,
  });

  const normalizedPlan = normalizeComputerPlan(parseJsonResponse(response));
  if (normalizedPlan.type === "plan") {
    validateComputerPlanAgainstMessage(message, normalizedPlan.plan);
  }
  return normalizedPlan;
}

async function buildComputerControlPlan(
  message,
  tier,
  assistant = {},
  history = [],
) {
  const deterministicPlan = convertParsedComputerPlanToSteps(
    createComputerControlPlan(message),
  );

  if (!(await isComputerPlannerAvailable())) {
    return deterministicPlan;
  }

  try {
    return await planComputerControlWithAi(message, tier, assistant, history);
  } catch {
    return deterministicPlan;
  }
}

function buildChatPayload(messages, config, stream = false) {
  if (config.provider === "ollama") {
    return {
      model: config.model,
      messages,
      stream,
      options: {
        temperature: config.temperature,
        top_p: config.topP,
        num_predict: config.maxCompletionTokens,
      },
    };
  }

  const payload = {
    model: config.model,
    messages,
    temperature: config.temperature,
    top_p: config.topP,
    stream,
  };

  if (config.provider === "groq") {
    payload.max_completion_tokens = config.maxCompletionTokens;
  } else {
    payload.max_tokens = config.maxCompletionTokens;
  }

  if (config.reasoningEffort) {
    payload.reasoning_effort = config.reasoningEffort;
  }

  return payload;
}

async function askChat(messages, config) {
  const endpoint =
    config.provider === "ollama" ? "/api/chat" : "/chat/completions";
  const response = await fetch(`${getApiBaseUrl(config.provider)}${endpoint}`, {
    method: "POST",
    headers: getApiHeaders(config.provider),
    body: JSON.stringify(buildChatPayload(messages, config, false)),
  });

  if (!response.ok) {
    await throwApiError(
      response,
      config.provider === "groq" ? "Groq chat error" : "OpenAI chat error",
    );
  }

  const data = await response.json();
  if (config.provider === "ollama") {
    return data?.message?.content?.trim() || "";
  }
  return data?.choices?.[0]?.message?.content?.trim() || "";
}

async function askChatWithFallback(messages, options) {
  const preferredProvider = getAiProvider();
  const providers = await getProviderCandidates(preferredProvider);
  let lastError = null;

  for (const provider of providers) {
    const config = getCapabilityConfigForProvider(
      provider,
      options.tier,
      options.mode,
      false,
      options.assistant,
    );

    try {
      return await askChat(messages, config);
    } catch (error) {
      lastError = error;
      if (!isNetworkBlockedError(error)) {
        throw error;
      }
    }
  }

  throw lastError || new Error("No AI provider is available.");
}

async function streamChatResponse(messages, config, onChunk) {
  const endpoint =
    config.provider === "ollama" ? "/api/chat" : "/chat/completions";
  const response = await fetch(`${getApiBaseUrl(config.provider)}${endpoint}`, {
    method: "POST",
    headers: getApiHeaders(config.provider),
    body: JSON.stringify(buildChatPayload(messages, config, true)),
  });

  if (!response.ok) {
    await throwApiError(
      response,
      config.provider === "groq" ? "Groq chat error" : "OpenAI chat error",
    );
  }

  let buffer = "";

  for await (const chunk of response.body) {
    buffer += chunk.toString("utf8");
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        continue;
      }

      if (config.provider !== "ollama") {
        if (line.startsWith(":") || !line.startsWith("data:")) {
          continue;
        }
      }

      const data =
        config.provider === "ollama" ? line : line.slice(5).trim();
      if (!data) continue;
      if (data === "[DONE]") return;

      const parsed = JSON.parse(data);
      const delta =
        config.provider === "ollama"
          ? parsed?.message?.content
          : parsed?.choices?.[0]?.delta?.content;
      if (typeof delta === "string" && delta) {
        onChunk(delta);
      }

      if (config.provider === "ollama" && parsed?.done) {
        return;
      }
    }
  }
}

async function streamChatWithFallback(messages, options, onChunk) {
  const preferredProvider = getAiProvider();
  const providers = await getProviderCandidates(preferredProvider);
  let lastError = null;

  for (const provider of providers) {
    const config = getCapabilityConfigForProvider(
      provider,
      options.tier,
      options.mode,
      false,
      options.assistant,
    );
    let wroteChunkForProvider = false;

    try {
      await streamChatResponse(messages, config, (text) => {
        wroteChunkForProvider = true;
        onChunk(text);
      });
      return;
    } catch (error) {
      lastError = error;
      if (wroteChunkForProvider || !isNetworkBlockedError(error)) {
        throw error;
      }
    }
  }

  throw lastError || new Error("No AI provider is available.");
}

function extractResponseText(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const textParts = [];
  for (const item of Array.isArray(data?.output) ? data.output : []) {
    if (!Array.isArray(item?.content)) continue;

    for (const contentItem of item.content) {
      if (
        contentItem?.type === "output_text" &&
        typeof contentItem.text === "string"
      ) {
        textParts.push(contentItem.text);
      }
    }
  }

  return textParts.join("\n\n").trim();
}

async function askVisionWithConfig(
  question,
  imageDataUrl,
  mode,
  tier,
  assistant = {},
  config,
) {
  if (config.provider === "ollama") {
    const rawBase64 = imageDataUrl.includes(";base64,")
      ? imageDataUrl.split(";base64,")[1]
      : imageDataUrl;
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: getApiHeaders("ollama"),
      body: JSON.stringify({
        model: config.model,
        stream: false,
        messages: [
          {
            role: "system",
            content: buildChatSystemPrompt(mode, tier, assistant),
          },
          {
            role: "user",
            content: String(question || "").trim() || "Analyze this image.",
            images: [rawBase64],
          },
        ],
        options: {
          temperature: config.temperature,
          top_p: config.topP,
          num_predict: config.maxCompletionTokens,
        },
      }),
    });

    if (!response.ok) {
      await throwApiError(response, "Ollama vision error");
    }

    const data = await response.json();
    return data?.message?.content?.trim() || "";
  }

  if (config.provider === "openai") {
    const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: getApiHeaders("openai"),
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: "system",
            content: buildChatSystemPrompt(mode, tier, assistant),
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: String(question || "").trim() || "Analyze this image.",
              },
              {
                type: "image_url",
                image_url: {
                  url: imageDataUrl,
                },
              },
            ],
          },
        ],
        max_tokens: config.maxCompletionTokens,
        temperature: config.temperature,
        top_p: config.topP,
      }),
    });

    if (!response.ok) {
      await throwApiError(response, "OpenAI vision error");
    }

    const data = await response.json();
    return data?.choices?.[0]?.message?.content?.trim() || "";
  }

  const payload = {
    model: config.model,
    instructions: buildChatSystemPrompt(mode, tier, assistant),
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: String(question || "").trim() || "Analyze this image.",
          },
          {
            type: "input_image",
            image_url: imageDataUrl,
            detail: "auto",
          },
        ],
      },
    ],
    max_output_tokens: config.maxCompletionTokens,
    temperature: config.temperature,
    top_p: config.topP,
  };

  if (config.reasoningEffort) {
    payload.reasoning = { effort: config.reasoningEffort };
  }

  const response = await fetch(`${GROQ_BASE_URL}/responses`, {
    method: "POST",
    headers: getApiHeaders("groq"),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    await throwApiError(response, "Groq vision error");
  }

  const data = await response.json();
  return extractResponseText(data);
}

async function askVisionWithFallback(
  question,
  imageDataUrl,
  mode,
  tier,
  assistant = {},
) {
  const preferredProvider = getAiProvider();
  const providers = await getProviderCandidates(preferredProvider);
  let lastError = null;

  for (const provider of providers) {
    const config = getCapabilityConfigForProvider(
      provider,
      tier,
      mode,
      true,
      assistant,
    );

    try {
      return await askVisionWithConfig(
        question,
        imageDataUrl,
        mode,
        tier,
        assistant,
        config,
      );
    } catch (error) {
      lastError = error;
      if (!isNetworkBlockedError(error)) {
        throw error;
      }
    }
  }

  throw lastError || new Error("No AI provider is available.");
}

app.post("/computer/plan", async (req, res) => {
  const { message, tier, assistant, history } = req.body || {};
  const assistantConfig = parseAssistantConfig(assistant);
  const trimmedMessage = String(message || "").trim();

  if (!trimmedMessage) {
    res.status(400).json({
      error: "Computer Control error",
      detail: "Computer Control needs a browser instruction first.",
    });
    return;
  }

  try {
    const plan = await buildComputerControlPlan(
      trimmedMessage,
      tier,
      assistantConfig,
      Array.isArray(history) ? history : [],
    );
    res.json(plan);
  } catch (error) {
    res.status(400).json({
      error: "Computer Control error",
      detail:
        error?.message ||
        "Computer Control could not build a browser plan for that request.",
    });
  }
});

app.post("/computer/session", (req, res) => {
  const requestedId = String(req.body?.sessionId || "").trim();
  const session = getOrCreateComputerSession(requestedId);

  if (!session) {
    res.status(404).json({
      error: "Computer Control error",
      detail: "That Computer Control session no longer exists.",
    });
    return;
  }

  res.json({
    session: serializeComputerSession(session),
  });
});

app.get("/computer/session/active", (_req, res) => {
  const session = getComputerSession(latestComputerSessionId);
  res.json({
    session: serializeComputerSession(session),
  });
});

app.post("/computer/session/:sessionId/command", (req, res) => {
  const session = getComputerSession(req.params.sessionId);
  const command = String(req.body?.command || "").trim();
  const source = String(req.body?.source || "web").trim() || "web";
  const context = Array.isArray(req.body?.context) ? req.body.context : [];

  if (!session) {
    res.status(404).json({
      error: "Computer Control error",
      detail: "That Computer Control session no longer exists.",
    });
    return;
  }

  if (!command) {
    res.status(400).json({
      error: "Computer Control error",
      detail: "Computer Control needs a command before it can continue.",
    });
    return;
  }

  const task = enqueueComputerTask(session, command, source, context);
  res.json({
    task: serializeComputerTask(task),
    session: serializeComputerSession(session),
  });
});

app.get("/computer/session/:sessionId/task/:taskId", (req, res) => {
  const session = getComputerSession(req.params.sessionId);

  if (!session) {
    res.status(404).json({
      error: "Computer Control error",
      detail: "That Computer Control session no longer exists.",
    });
    return;
  }

  const task =
    (session.activeTask && session.activeTask.id === req.params.taskId
      ? session.activeTask
      : null) ||
    session.queue.find((item) => item.id === req.params.taskId) ||
    session.completedTasks.find((item) => item.id === req.params.taskId) ||
    session.events.find((item) => item.taskId === req.params.taskId);

  if (!task) {
    res.status(404).json({
      error: "Computer Control error",
      detail: "That Computer Control task was not found.",
    });
    return;
  }

  res.json({
    task:
      "command" in task
        ? serializeComputerTask(task)
        : {
            id: req.params.taskId,
            status: task.type === "task-failed" ? "failed" : "completed",
            result: task.type === "task-failed" ? "" : task.message,
            error: task.type === "task-failed" ? task.message : "",
            updatedAt: task.createdAt,
          },
    session: serializeComputerSession(session),
  });
});

app.post("/computer/session/:sessionId/next-task", (req, res) => {
  const session = getComputerSession(req.params.sessionId);

  if (!session) {
    res.status(404).json({
      error: "Computer Control error",
      detail: "That Computer Control session no longer exists.",
    });
    return;
  }

  const task = claimComputerTask(session);
  res.json({
    task: serializeComputerTask(task),
    session: serializeComputerSession(session),
  });
});

app.post("/computer/session/:sessionId/task/:taskId/result", (req, res) => {
  const session = getComputerSession(req.params.sessionId);

  if (!session) {
    res.status(404).json({
      error: "Computer Control error",
      detail: "That Computer Control session no longer exists.",
    });
    return;
  }

  try {
    const task = completeComputerTask(
      session,
      req.params.taskId,
      req.body?.result,
      req.body?.error,
    );
    res.json({
      task: serializeComputerTask(task),
      session: serializeComputerSession(session),
    });
  } catch (error) {
    res.status(400).json({
      error: "Computer Control error",
      detail:
        error?.message ||
        "Computer Control could not save that extension result.",
    });
  }
});

app.post("/chat", async (req, res) => {
  const { message, mode, tier, assistant, stream } = req.body;
  const assistantConfig = parseAssistantConfig(assistant);
  const normalizedMode = normalizeMode(mode);

  if (normalizedMode === COMPUTER_MODE) {
    try {
      const computerPlan = await buildComputerControlPlan(
        message,
        tier,
        assistantConfig,
      );
      const answer =
        computerPlan.type === "message"
          ? computerPlan.message
          : await handleComputerControlPlan(computerPlan.plan);

      if (stream) {
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.setHeader("X-Accel-Buffering", "no");
        res.write(String(answer || ""));
        res.end();
        return;
      }

      res.json({ answer });
    } catch (error) {
      const detail =
        error?.message ||
        "Computer Control could not complete that Chrome command.";

      if (stream) {
        if (!res.headersSent) {
          res.status(400).end(detail);
        } else {
          res.write(`\n[Computer Control error] ${detail}`.trim());
          res.end();
        }
        return;
      }

      res.status(400).json({
        error: "Computer Control error",
        detail,
      });
    }

    return;
  }

  const messages = buildChatMessages(
    message,
    normalizedMode,
    tier,
    assistantConfig,
  );

  try {
    if (stream) {
      let wroteAnyChunk = false;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("X-Accel-Buffering", "no");

      await streamChatWithFallback(
        messages,
        {
          tier,
          mode: normalizedMode,
          assistant: assistantConfig,
        },
        (text) => {
          wroteAnyChunk = true;
          res.write(text);
        },
      );

      if (!wroteAnyChunk) {
        throw new Error(
          "AI returned an empty response. Check your API key and model configuration.",
        );
      }

      res.end();
      return;
    }

    const answer = await askChatWithFallback(messages, {
      tier,
      mode: normalizedMode,
      assistant: assistantConfig,
    });

    res.json({ answer });
  } catch (error) {
    if (stream) {
      if (!res.headersSent) {
        res.status(502).end(error?.message || "AI backend error");
      } else {
        res.write(
          `\n[AI error] ${error?.message || "AI backend error"}`.trim(),
        );
        res.end();
      }
      return;
    }

    res.status(502).json({
      error: "AI backend error",
      detail: error?.message || "Unknown error",
    });
  }
});

app.post("/warmup", async (req, res) => {
  if (!ENABLE_WARMUP) {
    return res.status(204).end();
  }

  const tier = req.body?.tier;
  const mode = req.body?.mode;
  const assistantConfig = parseAssistantConfig(req.body?.assistant);
  const config = getCapabilityConfig(
    tier,
    normalizeMode(mode),
    false,
    assistantConfig,
  );

  try {
    await askChat(
      buildChatMessages(
        "Reply with OK.",
        normalizeMode(mode),
        tier,
        assistantConfig,
      ),
      {
        ...config,
        maxCompletionTokens: 1,
      },
    );

    res.json({ ok: true });
  } catch {
    res.status(204).end();
  }
});

app.post("/vision", upload.single("image"), async (req, res) => {
  const { question, mode, tier } = req.body;
  const assistantConfig = parseAssistantConfig(req.body?.assistant);
  if (!req.file) {
    return res.status(400).json({ error: "Image file is required." });
  }

  const imagePath = req.file.path;
  let imageBase64 = "";

  try {
    imageBase64 = fs.readFileSync(imagePath, "base64");
  } catch (error) {
    safeDelete(imagePath);
    return res.status(500).json({
      error: "Failed to read uploaded image.",
      detail: error?.message || "Unknown error",
    });
  }

  try {
    const normalizedMode = normalizeMode(mode);
    const answer = await askVisionWithFallback(
      question,
      `data:${req.file.mimetype};base64,${imageBase64}`,
      normalizedMode,
      tier,
      assistantConfig,
    );

    res.json({ answer });
  } catch (error) {
    res.status(502).json({
      error: "AI backend error",
      detail: error?.message || "Unknown error",
    });
  } finally {
    safeDelete(imagePath);
  }
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
