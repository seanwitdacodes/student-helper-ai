import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import CDP from "chrome-remote-interface";

const execFileAsync = promisify(execFile);

const CHROME_APP_NAME = "Google Chrome";
const CHROME_APP_PATHS = [
  "/Applications/Google Chrome.app",
  path.join(process.env.HOME || "", "Applications/Google Chrome.app"),
];
const CHROME_DEBUG_PORT = Number(process.env.CHROME_DEBUG_PORT || 9222);
const CHROME_DEBUG_HOST = process.env.CHROME_DEBUG_HOST || "127.0.0.1";
const CHROME_DEBUG_BASE_URL = `http://${CHROME_DEBUG_HOST}:${CHROME_DEBUG_PORT}`;
const CHROME_STARTUP_TIMEOUT_MS = 15000;
const PAGE_READY_TIMEOUT_MS = 15000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AUTOMATION_PROFILE_DIR = path.join(
  __dirname,
  ".chrome-automation-profile",
);

const SITE_DIRECTORY = [
  {
    keys: ["google", "google search"],
    label: "Google",
    url: "https://www.google.com",
    searchUrl: (query) =>
      `https://www.google.com/search?q=${encodeURIComponent(query)}`,
  },
  {
    keys: ["youtube", "youtube.com"],
    label: "YouTube",
    url: "https://www.youtube.com",
    searchUrl: (query) =>
      `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
  },
  {
    keys: ["instagram", "instagram.com"],
    label: "Instagram",
    url: "https://www.instagram.com",
  },
  {
    keys: ["google classroom", "classroom", "classroom.google.com"],
    label: "Google Classroom",
    url: "https://classroom.google.com",
  },
  {
    keys: ["gmail", "mail.google.com", "google mail"],
    label: "Gmail",
    url: "https://mail.google.com",
  },
  {
    keys: ["google docs", "docs", "docs.google.com"],
    label: "Google Docs",
    url: "https://docs.google.com/document/u/0/",
  },
  {
    keys: ["google flights", "flights", "google travel flights"],
    label: "Google Flights",
    url: "https://www.google.com/travel/flights",
  },
  {
    keys: ["amazon", "amazon.com"],
    label: "Amazon",
    url: "https://www.amazon.com",
    searchUrl: (query) =>
      `https://www.amazon.com/s?k=${encodeURIComponent(query)}`,
  },
  {
    keys: ["espn", "espn.com"],
    label: "ESPN",
    url: "https://www.espn.com",
  },
];

const browserState = {
  workspaceTargetId: "",
};

let computerControlQueue = Promise.resolve();

const NAVIGATION_FOLLOW_UP_PATTERNS = [
  {
    type: "site-search",
    pattern:
      /\b(?:search(?:\s+up)?|look\s+up|look\s+for|look\s+at|find|browse|shop\s+for|check\s+out|go\s+to)\b/i,
  },
  {
    type: "click",
    pattern: /\bclick(?:\s+on)?\b/i,
  },
  {
    type: "fill",
    pattern: /\bfill\b/i,
  },
  {
    type: "scroll",
    pattern: /\bscroll\s+(?:up|down)\b/i,
  },
  {
    type: "summarize",
    pattern: /\b(?:summarize|summarise)\b/i,
  },
  {
    type: "search-page",
    pattern: /\bsearch(?:\s+this)?\s+page\s+for\b/i,
  },
  {
    type: "find-contact",
    pattern: /\bfind\s+the\s+contact\s+page\b/i,
  },
  {
    type: "copy-headline",
    pattern: /\bcopy\s+the\s+main\s+headline\b/i,
  },
  {
    type: "go-back",
    pattern: /\bgo\s+back\b/i,
  },
  {
    type: "go-forward",
    pattern: /\bgo\s+forward\b/i,
  },
];

const SAFETY_RULES = [
  {
    pattern:
      /\b(password|passcode|otp|2fa|two-factor|verification code|security code)\b/i,
    message:
      "Computer Control will not enter passwords or verification codes. You should handle credentials yourself.",
  },
  {
    pattern:
      /\b(buy|purchase|checkout|place order|pay now|payment|credit card|debit card)\b/i,
    message:
      "Computer Control will not make purchases or enter payment details.",
  },
  {
    pattern:
      /\b(send|submit|post)\b.*\b(email|message|dm|form|application)\b/i,
    message:
      "Computer Control will not send messages or submit final forms automatically.",
  },
  {
    pattern: /\b(delete|erase|remove permanently|trash)\b/i,
    message:
      "Computer Control will not delete content automatically.",
  },
  {
    pattern:
      /\b(do|complete|finish|answer|submit)\b.*\b(homework|assignment|quiz|test|exam)\b/i,
    message:
      "I can open the class page and help you work through the assignment, but I will not automatically complete or submit schoolwork for you.",
  },
];

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^\w\s.:/-]/g, " ")
    .replace(/\s+/g, " ");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildUsageMessage() {
  return [
    "Computer Control works best through the Conductor Chrome extension.",
    'Try commands like "Open YouTube then look up FlightReacts", "Open Google Classroom then click Precalculus Honors", "Continue workspace and scroll down", or "Summarize this page".',
    "The extension opens a normal tab in your current Chrome window and follows simple browser steps there.",
  ].join(" ");
}

function getSafetyMessage(command) {
  for (const rule of SAFETY_RULES) {
    if (rule.pattern.test(String(command || ""))) {
      return rule.message;
    }
  }

  return "";
}

function looksLikeUrl(value) {
  return /^https?:\/\//i.test(value) || /^www\./i.test(value);
}

function normalizeUrl(value) {
  if (/^https?:\/\//i.test(value)) return value;
  if (/^[a-z0-9-]+\.[a-z]{2,}/i.test(value)) return `https://${value}`;
  return `https://www.${String(value || "").trim()}.com`;
}

function resolveSite(rawInput) {
  const input = String(rawInput || "").trim();
  if (!input) return null;

  if (looksLikeUrl(input)) {
    return {
      label: input.replace(/^https?:\/\//i, ""),
      url: normalizeUrl(input),
    };
  }

  const normalized = normalizeText(input);
  const knownSite = SITE_DIRECTORY.find((site) =>
    site.keys.some((key) => normalizeText(key) === normalized),
  );
  if (knownSite) return knownSite;

  if (/^[a-z0-9-]+\.[a-z]{2,}$/i.test(input)) {
    return {
      label: input,
      url: normalizeUrl(input),
    };
  }

  if (/^[a-z0-9-]+$/i.test(input)) {
    return {
      label: input,
      url: `https://www.${input}.com`,
    };
  }

  return null;
}

function splitTargets(rawList) {
  return String(rawList || "")
    .replace(/\s+and\s+/gi, ",")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function cleanNavigationSiteText(value) {
  return String(value || "")
    .replace(/\b(?:and\s+then|then|and)\s*$/i, "")
    .trim();
}

function splitFollowUpSegments(value) {
  return String(value || "")
    .split(/\s+(?:and\s+then|then)\s+/i)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function buildUnknownSiteMessage(siteText) {
  return `I couldn't tell which website "${siteText}" refers to. Say the site name or URL first, then tell me what to do there.`;
}

function findNavigationFollowUp(remainder) {
  let matchInfo = null;

  for (const candidate of NAVIGATION_FOLLOW_UP_PATTERNS) {
    const match = String(remainder || "").match(candidate.pattern);
    if (!match || typeof match.index !== "number") {
      continue;
    }

    if (!matchInfo || match.index < matchInfo.index) {
      matchInfo = {
        type: candidate.type,
        index: match.index,
        marker: match[0],
      };
    }
  }

  return matchInfo;
}

function buildDeterministicFollowUpSteps(site, followUpText) {
  const segments = splitFollowUpSegments(followUpText);
  const steps = [];

  for (const segment of segments) {
    let match = segment.match(
      /^(?:search(?:\s+up)?|look\s+up|look\s+for|look\s+at|find|browse|shop\s+for|check\s+out|go\s+to)\s+(.+)$/i,
    );
    if (match) {
      steps.push({
        action: "site-search",
        siteLabel: site.label,
        query: match[1].trim(),
        directUrl: site.searchUrl?.(match[1].trim()) || "",
      });
      continue;
    }

    match = segment.match(/^click(?:\s+on)?\s+(.+)$/i);
    if (match) {
      steps.push({ action: "click", target: match[1].trim() });
      continue;
    }

    match = segment.match(/^fill\s+(.+?)\s+with\s+(.+)$/i);
    if (match) {
      steps.push({
        action: "fill",
        field: match[1].trim(),
        value: match[2].trim(),
      });
      continue;
    }

    match = segment.match(/^search(?:\s+this)?\s+page\s+for\s+(.+)$/i);
    if (match) {
      steps.push({ action: "search-page", query: match[1].trim() });
      continue;
    }

    if (/^scroll\s+down$/i.test(segment)) {
      steps.push({ action: "scroll", direction: "down" });
      continue;
    }

    if (/^scroll\s+up$/i.test(segment)) {
      steps.push({ action: "scroll", direction: "up" });
      continue;
    }

    if (
      /^(?:summarize|summarise)(?:\s+(?:this\s+)?(?:page|webpage))?$/i.test(
        segment,
      )
    ) {
      steps.push({ action: "summarize" });
      continue;
    }

    if (/^find\s+the\s+contact\s+page$/i.test(segment)) {
      steps.push({ action: "find-contact" });
      continue;
    }

    if (/^copy\s+the\s+main\s+headline$/i.test(segment)) {
      steps.push({ action: "copy-headline" });
      continue;
    }

    if (/^go\s+back$/i.test(segment)) {
      steps.push({ action: "go-back" });
      continue;
    }

    if (/^go\s+forward$/i.test(segment)) {
      steps.push({ action: "go-forward" });
      continue;
    }

    return [];
  }

  return steps;
}

function planNavigationCommand(commandBody) {
  const openCommandMatch = commandBody.match(
    /^(?:open|go to|navigate to|launch|head to|head over to|take me to)\s+(.+)$/i,
  );
  if (!openCommandMatch) {
    return null;
  }

  const remainder = openCommandMatch[1].trim();
  const followUp = findNavigationFollowUp(remainder);
  const siteText = cleanNavigationSiteText(
    followUp ? remainder.slice(0, followUp.index) : remainder,
  );

  if (!siteText) {
    return { type: "message", message: buildUsageMessage() };
  }

  const site = resolveSite(siteText);
  if (!site) {
    return {
      type: "message",
      message: buildUnknownSiteMessage(siteText),
    };
  }

  const steps = [
    {
      action: "open-url",
      siteLabel: site.label,
      url: site.url,
    },
    { action: "wait-for-page" },
  ];

  if (!followUp) {
    return {
      type: "plan",
      plan: { kind: "open-site", siteLabel: site.label, steps },
    };
  }

  const followUpText = remainder.slice(followUp.index).trim();
  const followUpSteps = buildDeterministicFollowUpSteps(site, followUpText);
  if (!followUpSteps.length) {
    return null;
  }

  steps.push(...followUpSteps);
  return {
    type: "plan",
    plan: {
      kind: "deterministic-navigation-plan",
      siteLabel: site.label,
      steps,
    },
  };
}

function isContinuationCommand(type) {
  return new Set([
    "click",
    "fill",
    "scroll",
    "summarize",
    "search-page",
    "find-contact",
    "copy-headline",
    "go-back",
    "go-forward",
    "site-search",
    "close-browser",
  ]).has(type);
}

function parseCommand(command) {
  const trimmed = String(command || "").trim();
  if (!trimmed) return { type: "help" };

  const safetyMessage = getSafetyMessage(trimmed);
  if (safetyMessage) {
    return { type: "blocked", message: safetyMessage };
  }

  const continueInWorkspace =
    /\b(continue|same workspace|same tab|existing workspace|current workspace)\b/i.test(
      trimmed,
    );
  const commandBody = trimmed
    .replace(
      /^(?:continue(?:\s+in)?\s+(?:the\s+)?(?:same\s+workspace|same\s+tab|existing\s+workspace|current\s+workspace)\s+and\s+|continue\s+workspace\s+and\s+|continue\s+and\s+|continue\s+)/i,
      "",
    )
    .replace(/^(?:please\s+|can you\s+|could you\s+|would you\s+|can u\s+)/i, "")
    .trim();

  const openTabsMatch = commandBody.match(
    /^(?:open|launch)\s+(?:\d+\s+)?tabs?\s*:?\s*(.+)$/i,
  );
  if (openTabsMatch) {
    return { type: "open-tabs", targets: splitTargets(openTabsMatch[1]) };
  }

  if (/^(?:close browser|quit chrome|close chrome)$/i.test(commandBody)) {
    return { type: "close-browser" };
  }

  const navigationPlan = planNavigationCommand(commandBody);
  if (navigationPlan) {
    return navigationPlan;
  }

  const googleMatch = commandBody.match(/^google\s+(.+)$/i);
  if (googleMatch) {
    return { type: "google-search", query: googleMatch[1].trim() };
  }

  const searchPageMatch = commandBody.match(
    /^search(?:\s+this)?\s+page\s+for\s+(.+)$/i,
  );
  if (searchPageMatch) {
    return {
      type: "search-page",
      query: searchPageMatch[1].trim(),
      continueInWorkspace,
    };
  }

  if (/^(?:summarize|summarise)\s+(?:this\s+)?(?:page|webpage)$/i.test(commandBody)) {
    return { type: "summarize", continueInWorkspace };
  }

  const clickMatch = commandBody.match(/^click(?:\s+on)?\s+(.+)$/i);
  if (clickMatch) {
    return {
      type: "click",
      target: clickMatch[1].trim(),
      continueInWorkspace: true,
    };
  }

  const fillMatch = commandBody.match(/^fill\s+(.+?)\s+with\s+(.+)$/i);
  if (fillMatch) {
    return {
      type: "fill",
      field: fillMatch[1].trim(),
      value: fillMatch[2].trim(),
      continueInWorkspace: true,
    };
  }

  if (/^scroll\s+down$/i.test(commandBody)) {
    return { type: "scroll", direction: "down", continueInWorkspace: true };
  }

  if (/^scroll\s+up$/i.test(commandBody)) {
    return { type: "scroll", direction: "up", continueInWorkspace: true };
  }

  if (/^find\s+the\s+contact\s+page$/i.test(commandBody)) {
    return { type: "find-contact", continueInWorkspace: true };
  }

  if (/^copy\s+the\s+main\s+headline$/i.test(commandBody)) {
    return { type: "copy-headline", continueInWorkspace: true };
  }

  if (/^go\s+back$/i.test(commandBody)) {
    return { type: "go-back", continueInWorkspace: true };
  }

  if (/^go\s+forward$/i.test(commandBody)) {
    return { type: "go-forward", continueInWorkspace: true };
  }

  const searchCurrentSiteMatch = commandBody.match(
    /^search(?:\s+for|\s+up)?\s+(.+)$/i,
  );
  if (searchCurrentSiteMatch && continueInWorkspace) {
    return {
      type: "site-search",
      query: searchCurrentSiteMatch[1].trim(),
      continueInWorkspace: true,
    };
  }

  const findMeMatch = commandBody.match(/^(?:find me|look for)\s+(.+)$/i);
  if (findMeMatch) {
    return { type: "research", query: findMeMatch[1].trim() };
  }

  return { type: "help" };
}

export function createComputerControlPlan(command) {
  return parseCommand(command);
}

export function convertParsedComputerPlanToSteps(parsed) {
  if (!parsed || typeof parsed !== "object") {
    return {
      type: "message",
      message: buildUsageMessage(),
    };
  }

  if (parsed.type === "help") {
    return {
      type: "message",
      message: buildUsageMessage(),
    };
  }

  if (parsed.type === "blocked" || parsed.type === "message") {
    return {
      type: "message",
      message: String(parsed.message || buildUsageMessage()),
    };
  }

  if (parsed.type === "open-tabs") {
    const steps = parsed.targets
      .map((target) => resolveSite(target) || { label: target, url: normalizeUrl(target) })
      .map((site) => ({
        action: "open-url",
        siteLabel: site.label,
        url: site.url,
      }));

    return {
      type: "plan",
      plan: {
        kind: "open-tabs",
        steps,
      },
    };
  }

  if (parsed.type === "close-browser") {
    return {
      type: "message",
      message:
        'Close-browser is not handled by the extension yet. Close the workspace tab directly in Chrome.',
    };
  }

  if (parsed.type === "plan" && Array.isArray(parsed.plan?.steps)) {
    return {
      type: "plan",
      plan: parsed.plan,
    };
  }

  if (parsed.type === "google-search") {
    return {
      type: "plan",
      plan: {
        kind: "google-search",
        steps: [
          {
            action: "open-url",
            siteLabel: "Google",
            url: `https://www.google.com/search?q=${encodeURIComponent(parsed.query)}`,
          },
          { action: "wait-for-page" },
        ],
      },
    };
  }

  if (parsed.type === "research") {
    return {
      type: "plan",
      plan: {
        kind: "research",
        steps: [
          {
            action: "open-url",
            siteLabel: "Google",
            url: buildResearchUrl(parsed.query),
          },
          { action: "wait-for-page" },
        ],
      },
    };
  }

  const currentTabStepMap = {
    click: { action: "click", target: parsed.target },
    fill: { action: "fill", field: parsed.field, value: parsed.value },
    scroll: { action: "scroll", direction: parsed.direction },
    summarize: { action: "summarize" },
    "search-page": { action: "search-page", query: parsed.query },
    "find-contact": { action: "find-contact" },
    "copy-headline": { action: "copy-headline" },
    "go-back": { action: "go-back" },
    "go-forward": { action: "go-forward" },
    "site-search": { action: "site-search", query: parsed.query, siteLabel: "the site" },
  };

  if (currentTabStepMap[parsed.type]) {
    return {
      type: "plan",
      plan: {
        kind: "workspace-follow-up",
        steps: [currentTabStepMap[parsed.type]],
      },
    };
  }

  return {
    type: "message",
    message: buildUsageMessage(),
  };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Chrome automation request failed (${response.status}).`);
  }
  return response.json();
}

function getChromeAppPath() {
  const found = CHROME_APP_PATHS.find((candidate) => candidate && fs.existsSync(candidate));
  if (!found) {
    throw new Error("Computer Control could not find Google Chrome on this Mac.");
  }
  return found;
}

async function isChromeDebugReachable() {
  try {
    const response = await fetch(`${CHROME_DEBUG_BASE_URL}/json/version`, {
      method: "GET",
      signal: AbortSignal.timeout(1000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function launchAutomationChrome() {
  fs.mkdirSync(AUTOMATION_PROFILE_DIR, { recursive: true });
  await execFileAsync("open", [
    "-na",
    CHROME_APP_NAME,
    "--args",
    `--remote-debugging-port=${CHROME_DEBUG_PORT}`,
    `--user-data-dir=${AUTOMATION_PROFILE_DIR}`,
    "--no-first-run",
    "--no-default-browser-check",
  ]);
}

async function ensureAutomationChrome() {
  if (await isChromeDebugReachable()) {
    return;
  }

  getChromeAppPath();
  await launchAutomationChrome();

  const startedAt = Date.now();
  while (Date.now() - startedAt < CHROME_STARTUP_TIMEOUT_MS) {
    if (await isChromeDebugReachable()) {
      return;
    }
    await delay(250);
  }

  throw new Error(
    "Computer Control could not start the Chrome automation window.",
  );
}

async function listPageTargets() {
  await ensureAutomationChrome();
  const targets = await CDP.List({ host: CHROME_DEBUG_HOST, port: CHROME_DEBUG_PORT });
  return targets.filter((target) => target.type === "page");
}

async function getTargetDescriptor(targetId = browserState.workspaceTargetId) {
  if (!targetId) return null;
  const targets = await listPageTargets();
  const target = targets.find((item) => item.id === targetId);
  if (!target) {
    return null;
  }
  browserState.workspaceTargetId = target.id;
  return {
    targetId: target.id,
    url: target.url || "",
    title: target.title || "",
  };
}

async function activateTarget(targetId) {
  if (!targetId) return;
  await CDP.Activate({
    host: CHROME_DEBUG_HOST,
    port: CHROME_DEBUG_PORT,
    id: targetId,
  });
}

async function createWorkspaceTab(url = "about:blank") {
  await ensureAutomationChrome();
  const target = await CDP.New({
    host: CHROME_DEBUG_HOST,
    port: CHROME_DEBUG_PORT,
    url,
  });
  browserState.workspaceTargetId = target.id;
  await activateTarget(target.id);
  await waitForWorkspaceReady(target.id);
  return getTargetDescriptor(target.id);
}

async function closeAutomationChrome() {
  const targets = await listPageTargets();
  for (const target of targets) {
    await CDP.Close({
      host: CHROME_DEBUG_HOST,
      port: CHROME_DEBUG_PORT,
      id: target.id,
    }).catch(() => undefined);
  }
  browserState.workspaceTargetId = "";
  return "Closed the Chrome automation workspace.";
}

async function withTargetClient(targetId, callback) {
  const client = await CDP({
    host: CHROME_DEBUG_HOST,
    port: CHROME_DEBUG_PORT,
    target: targetId,
  });

  try {
    await client.Page.enable();
    await client.Runtime.enable();
    return await callback(client);
  } finally {
    await client.close().catch(() => undefined);
  }
}

async function evaluateOnTarget(targetId, expression) {
  return withTargetClient(targetId, async (client) => {
    const response = await client.Runtime.evaluate({
      expression,
      awaitPromise: true,
      returnByValue: true,
    });

    if (response?.exceptionDetails) {
      throw new Error("The page action failed.");
    }

    return response?.result?.value;
  });
}

async function waitForWorkspaceReady(
  targetId = browserState.workspaceTargetId,
  timeoutMs = PAGE_READY_TIMEOUT_MS,
) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const readyState = await evaluateOnTarget(
      targetId,
      "document.readyState",
    ).catch(() => "");

    if (readyState === "complete" || readyState === "interactive") {
      await delay(250);
      return getTargetDescriptor(targetId);
    }

    await delay(250);
  }

  return getTargetDescriptor(targetId);
}

async function ensureWorkspaceForCommand(parsed) {
  if (!browserState.workspaceTargetId) {
    throw new Error(
      'There is no active Computer Control workspace yet. Start with something like "Open YouTube then look up FlightReacts".',
    );
  }

  const descriptor = await getTargetDescriptor(browserState.workspaceTargetId);
  if (!descriptor) {
    throw new Error(
      'The last workspace tab is gone. Start a new task with something like "Open YouTube then look up FlightReacts".',
    );
  }

  await activateTarget(descriptor.targetId);

  if (!isContinuationCommand(parsed.type) && !parsed.continueInWorkspace) {
    return createWorkspaceTab(descriptor.url || "about:blank");
  }

  return descriptor;
}

async function openDirectUrl(url) {
  return createWorkspaceTab(url);
}

async function navigateWorkspaceTarget(targetId, url) {
  await withTargetClient(targetId, async (client) => {
    await client.Page.navigate({ url });
  });
  await delay(200);
  return waitForWorkspaceReady(targetId);
}

function javascriptResultError(payload, fallback) {
  if (payload?.error) {
    return new Error(payload.error);
  }
  return new Error(fallback);
}

function buildJavascriptEnvelope(action, data = {}) {
  return `
(() => {
  const action = ${JSON.stringify(action)};
  const data = ${JSON.stringify(data)};
  const normalize = (value) => String(value || "").toLowerCase().replace(/\\s+/g, " ").trim();
  const isVisible = (element) => {
    if (!(element instanceof Element)) return false;
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
  };
  const getText = (element) => String(element?.innerText || element?.textContent || "").replace(/\\s+/g, " ").trim();
  const getLabel = (element) => {
    const aria = element.getAttribute("aria-label");
    if (aria) return aria.trim();
    const placeholder = element.getAttribute("placeholder");
    if (placeholder) return placeholder.trim();
    const name = element.getAttribute("name");
    if (name) return name.trim();
    const id = element.id || "";
    if (id) {
      const label = document.querySelector('label[for="' + CSS.escape(id) + '"]');
      if (label) return getText(label);
    }
    const wrappingLabel = element.closest("label");
    return wrappingLabel ? getText(wrappingLabel) : "";
  };
  const scoreElement = (element, query) => {
    const needle = normalize(query);
    const fields = [
      getText(element),
      getLabel(element),
      element.getAttribute("aria-label") || "",
      element.getAttribute("placeholder") || "",
      element.getAttribute("name") || "",
      element.id || "",
      element.getAttribute("href") || "",
    ].map(normalize).filter(Boolean);
    let score = 0;
    for (const field of fields) {
      if (field === needle) score += 18;
      if (field.includes(needle)) score += 10;
      if (needle.includes(field) && field.length > 2) score += 4;
    }
    if (element.tagName?.toLowerCase() === "button") score += 2;
    if ((element.getAttribute("role") || "").toLowerCase() === "button") score += 1;
    return score;
  };
  const bestElement = (selector, query) => {
    const candidates = [...document.querySelectorAll(selector)]
      .filter(isVisible)
      .map((element) => ({ element, score: scoreElement(element, query) }))
      .sort((a, b) => b.score - a.score);
    return candidates.find((item) => item.score > 0)?.element || null;
  };
  const response = (payload) => ({ ok: true, ...payload, url: location.href, title: document.title });
  const failure = (message) => ({ ok: false, error: message, url: location.href, title: document.title });
  try {
    if (action === "click") {
      const target = bestElement('button, a[href], [role="button"], input[type="button"], input[type="submit"]', data.target);
      if (!target) return failure('I could not find anything to click for "' + data.target + '".');
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.click();
      return response({ message: 'Clicked "' + (getText(target) || getLabel(target) || data.target) + '".' });
    }
    if (action === "fill") {
      const field = bestElement("input, textarea, select", data.field);
      if (!field) return failure('I could not find a field for "' + data.field + '".');
      if ((field.getAttribute("type") || "").toLowerCase() === "password") return failure("I do not enter passwords.");
      field.scrollIntoView({ behavior: "smooth", block: "center" });
      field.focus();
      field.value = data.value;
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
      return response({ message: 'Filled "' + (getLabel(field) || field.name || field.id || data.field) + '".' });
    }
    if (action === "scroll") {
      window.scrollBy({ top: data.direction === "up" ? -window.innerHeight * 0.82 : window.innerHeight * 0.82, behavior: "smooth" });
      return response({ message: "Scrolled " + data.direction + "." });
    }
    if (action === "summarize") {
      const headline = [...document.querySelectorAll("h1, h2")].find((element) => isVisible(element) && getText(element));
      const paragraphs = [...document.querySelectorAll("p, li")]
        .filter(isVisible)
        .map((element) => getText(element))
        .filter((text) => text.length > 40)
        .slice(0, 3);
      const summary = [
        headline ? 'Headline: ' + getText(headline) : "",
        ...paragraphs.map((text, index) => 'Point ' + (index + 1) + ': ' + text),
      ].filter(Boolean).join("\\n");
      return response({ message: summary || "The page did not have enough visible text to summarize." });
    }
    if (action === "search-page") {
      const matches = [...document.querySelectorAll("main, article, section, p, li, h1, h2, h3")]
        .filter(isVisible)
        .map((element) => getText(element))
        .filter(Boolean)
        .filter((text) => normalize(text).includes(normalize(data.query)))
        .slice(0, 6);
      return response({
        message: matches.length
          ? 'Found ' + matches.length + ' match' + (matches.length === 1 ? '' : 'es') + ' for "' + data.query + '".\\n\\n' + matches.map((text) => '- ' + text).join("\\n")
          : 'No visible matches found for "' + data.query + '".',
      });
    }
    if (action === "find-contact") {
      const target = ["contact", "support", "help", "about"]
        .map((query) => bestElement('a[href], button, [role="button"]', query))
        .find(Boolean);
      if (!target) return failure("I could not find a visible contact or support link.");
      return response({ message: 'Found "' + (getText(target) || getLabel(target) || "contact") + '".' });
    }
    if (action === "copy-headline") {
      const headline = [...document.querySelectorAll("h1, h2")].find((element) => isVisible(element) && getText(element));
      if (!headline) return failure("I could not find a visible headline on this page.");
      const headlineText = getText(headline);
      return response({ message: 'Copied headline: ' + headlineText, text: headlineText });
    }
    if (action === "go-back") {
      history.back();
      return response({ message: "Went back one page." });
    }
    if (action === "go-forward") {
      history.forward();
      return response({ message: "Went forward one page." });
    }
    if (action === "site-search") {
      const selectors = [
        'input[type="search"]',
        'input[name*="search" i]',
        'input[placeholder*="search" i]',
        'input[aria-label*="search" i]',
        'input[name="q"]',
      ];
      const field = selectors.map((selector) => document.querySelector(selector)).find((element) => element && isVisible(element));
      if (!field) return failure("I could not find a visible search field on this page.");
      field.scrollIntoView({ behavior: "smooth", block: "center" });
      field.focus();
      field.value = data.query;
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
      const form = field.closest("form");
      if (form && typeof form.requestSubmit === "function") {
        form.requestSubmit();
      } else {
        field.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
        field.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", bubbles: true }));
      }
      return response({ message: 'Searched the current site for "' + data.query + '".' });
    }
    return failure("Unsupported browser action.");
  } catch (error) {
    return failure(error?.message || "The page action failed.");
  }
})()
`.trim();
}

async function executeJavascriptOnWorkspace(targetId, source) {
  const result = await evaluateOnTarget(targetId, source);
  if (result?.ok === false) {
    throw javascriptResultError(result, "The page action failed.");
  }
  return result;
}

async function openMultipleTabs(targets) {
  if (!targets.length) {
    throw new Error("I could not figure out which tabs to open.");
  }

  const opened = [];
  for (const target of targets) {
    const site = resolveSite(target);
    const descriptor = await createWorkspaceTab(site?.url || normalizeUrl(target));
    opened.push(descriptor.title || descriptor.url || target);
  }

  return `Opened ${opened.length} tabs in the Chrome automation window: ${opened.join(", ")}.`;
}

async function setMacClipboard(value) {
  await execFileAsync("osascript", [
    "-e",
    `set the clipboard to ${JSON.stringify(String(value || ""))}`,
  ]);
}

function buildResearchUrl(query) {
  if (/\b(flight|flights|airfare|plane ticket)\b/i.test(query)) {
    return `https://www.google.com/search?q=${encodeURIComponent(
      `${query} google flights`,
    )}`;
  }

  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function buildWorkspaceSummary(prefix, descriptor) {
  const pieces = [prefix];

  if (descriptor?.title) {
    pieces.push(`Tab: ${descriptor.title}`);
  }

  if (descriptor?.url) {
    pieces.push(`URL: ${descriptor.url}`);
  }

  return pieces.join("\n");
}

async function executePlannedSiteSearch(step, descriptor) {
  if (step.directUrl) {
    const freshDescriptor = await navigateWorkspaceTarget(
      descriptor.targetId,
      step.directUrl,
    );
    return {
      descriptor: freshDescriptor,
      message: `Opened ${step.siteLabel} in a new Chrome workspace tab and searched for "${step.query}".`,
    };
  }

  const searchResult = await executeJavascriptOnWorkspace(
    descriptor.targetId,
    buildJavascriptEnvelope("site-search", { query: step.query }),
  );
  await waitForWorkspaceReady(descriptor.targetId);
  const freshDescriptor = await getTargetDescriptor(descriptor.targetId);
  return {
    descriptor: freshDescriptor,
    message:
      searchResult.message ||
      `Opened ${step.siteLabel} in a new Chrome workspace tab and searched for "${step.query}".`,
  };
}

async function executePlannedClick(step, descriptor) {
  const clickResult = await executeJavascriptOnWorkspace(
    descriptor.targetId,
    buildJavascriptEnvelope("click", { target: step.target }),
  );
  await delay(700);
  const freshDescriptor = await getTargetDescriptor(descriptor.targetId);
  return { descriptor: freshDescriptor, message: clickResult.message };
}

function buildStepJavascriptAction(step) {
  switch (step.action) {
    case "fill":
      return { action: "fill", data: { field: step.field, value: step.value } };
    case "scroll":
      return {
        action: "scroll",
        data: { direction: step.direction === "up" ? "up" : "down" },
      };
    case "summarize":
      return { action: "summarize", data: {} };
    case "search-page":
      return { action: "search-page", data: { query: step.query } };
    case "find-contact":
      return { action: "find-contact", data: {} };
    case "copy-headline":
      return { action: "copy-headline", data: {} };
    case "go-back":
      return { action: "go-back", data: {} };
    case "go-forward":
      return { action: "go-forward", data: {} };
    default:
      return null;
  }
}

async function executePlannedWorkspaceAction(step, descriptor) {
  const stepConfig = buildStepJavascriptAction(step);
  if (!stepConfig) {
    throw new Error(`Unsupported planned browser action: ${step.action}`);
  }

  const result = await executeJavascriptOnWorkspace(
    descriptor.targetId,
    buildJavascriptEnvelope(stepConfig.action, stepConfig.data),
  );

  if (step.action === "copy-headline" && result?.text) {
    await setMacClipboard(result.text);
  }

  await delay(700);

  if (step.action === "go-back" || step.action === "go-forward") {
    await waitForWorkspaceReady(descriptor.targetId);
  }

  const freshDescriptor = await getTargetDescriptor(descriptor.targetId);
  return { descriptor: freshDescriptor, message: result.message };
}

async function executeCommandPlan(plan) {
  let descriptor = null;
  let message = "";

  for (const step of plan.steps) {
    if (step.action === "open-url") {
      descriptor = await openDirectUrl(step.url);
      message = `Opened ${step.siteLabel} in a new Chrome workspace tab.`;
      continue;
    }

    if (step.action === "wait-for-page") {
      if (descriptor) {
        descriptor = await waitForWorkspaceReady(descriptor.targetId);
      }
      continue;
    }

    if (step.action === "site-search") {
      const result = await executePlannedSiteSearch(step, descriptor);
      descriptor = result.descriptor;
      message = result.message;
      continue;
    }

    if (step.action === "click") {
      const result = await executePlannedClick(step, descriptor);
      descriptor = result.descriptor;
      message = result.message;
      continue;
    }

    if (
      [
        "fill",
        "scroll",
        "summarize",
        "search-page",
        "find-contact",
        "copy-headline",
        "go-back",
        "go-forward",
      ].includes(step.action)
    ) {
      const result = await executePlannedWorkspaceAction(step, descriptor);
      descriptor = result.descriptor;
      message = result.message;
    }
  }

  return buildWorkspaceSummary(message, descriptor);
}

async function runComputerControlCommand(command) {
  const parsed = parseCommand(command);

  if (parsed.type === "help") return buildUsageMessage();
  if (parsed.type === "blocked") return parsed.message;
  if (parsed.type === "message") return parsed.message;
  if (parsed.type === "open-tabs") return openMultipleTabs(parsed.targets);
  if (parsed.type === "close-browser") return closeAutomationChrome();
  if (parsed.type === "plan") return executeCommandPlan(parsed.plan);

  if (parsed.type === "google-search") {
    const descriptor = await openDirectUrl(
      `https://www.google.com/search?q=${encodeURIComponent(parsed.query)}`,
    );
    return buildWorkspaceSummary(
      `Opened a new Chrome workspace tab and searched Google for "${parsed.query}".`,
      descriptor,
    );
  }

  if (parsed.type === "research") {
    const descriptor = await openDirectUrl(buildResearchUrl(parsed.query));
    return buildWorkspaceSummary(
      `Opened a new Chrome workspace tab to research "${parsed.query}".`,
      descriptor,
    );
  }

  const workspace = await ensureWorkspaceForCommand(parsed);

  if (parsed.type === "click") {
    const result = await executeJavascriptOnWorkspace(
      workspace.targetId,
      buildJavascriptEnvelope("click", { target: parsed.target }),
    );
    await delay(700);
    return buildWorkspaceSummary(
      result.message,
      await getTargetDescriptor(workspace.targetId),
    );
  }

  if (parsed.type === "fill") {
    const result = await executeJavascriptOnWorkspace(
      workspace.targetId,
      buildJavascriptEnvelope("fill", {
        field: parsed.field,
        value: parsed.value,
      }),
    );
    return buildWorkspaceSummary(
      result.message,
      await getTargetDescriptor(workspace.targetId),
    );
  }

  if (parsed.type === "scroll") {
    const result = await executeJavascriptOnWorkspace(
      workspace.targetId,
      buildJavascriptEnvelope("scroll", { direction: parsed.direction }),
    );
    return buildWorkspaceSummary(
      result.message,
      await getTargetDescriptor(workspace.targetId),
    );
  }

  if (parsed.type === "summarize") {
    const result = await executeJavascriptOnWorkspace(
      workspace.targetId,
      buildJavascriptEnvelope("summarize"),
    );
    return buildWorkspaceSummary(
      result.message,
      await getTargetDescriptor(workspace.targetId),
    );
  }

  if (parsed.type === "search-page") {
    const result = await executeJavascriptOnWorkspace(
      workspace.targetId,
      buildJavascriptEnvelope("search-page", { query: parsed.query }),
    );
    return buildWorkspaceSummary(
      result.message,
      await getTargetDescriptor(workspace.targetId),
    );
  }

  if (parsed.type === "find-contact") {
    const result = await executeJavascriptOnWorkspace(
      workspace.targetId,
      buildJavascriptEnvelope("find-contact"),
    );
    return buildWorkspaceSummary(
      result.message,
      await getTargetDescriptor(workspace.targetId),
    );
  }

  if (parsed.type === "copy-headline") {
    const result = await executeJavascriptOnWorkspace(
      workspace.targetId,
      buildJavascriptEnvelope("copy-headline"),
    );
    if (result?.text) {
      await setMacClipboard(result.text);
    }
    return buildWorkspaceSummary(
      result.message,
      await getTargetDescriptor(workspace.targetId),
    );
  }

  if (parsed.type === "go-back") {
    const result = await executeJavascriptOnWorkspace(
      workspace.targetId,
      buildJavascriptEnvelope("go-back"),
    );
    await delay(700);
    await waitForWorkspaceReady(workspace.targetId);
    return buildWorkspaceSummary(
      result.message,
      await getTargetDescriptor(workspace.targetId),
    );
  }

  if (parsed.type === "go-forward") {
    const result = await executeJavascriptOnWorkspace(
      workspace.targetId,
      buildJavascriptEnvelope("go-forward"),
    );
    await delay(700);
    await waitForWorkspaceReady(workspace.targetId);
    return buildWorkspaceSummary(
      result.message,
      await getTargetDescriptor(workspace.targetId),
    );
  }

  if (parsed.type === "site-search") {
    const result = await executeJavascriptOnWorkspace(
      workspace.targetId,
      buildJavascriptEnvelope("site-search", { query: parsed.query }),
    );
    await delay(700);
    await waitForWorkspaceReady(workspace.targetId);
    return buildWorkspaceSummary(
      result.message,
      await getTargetDescriptor(workspace.targetId),
    );
  }

  return buildUsageMessage();
}

export function handleComputerControlCommand(command) {
  const run = () => runComputerControlCommand(command);
  const resultPromise = computerControlQueue.then(run, run);

  computerControlQueue = resultPromise.then(
    () => undefined,
    () => undefined,
  );

  return resultPromise;
}

export function handleComputerControlPlan(plan) {
  const run = () => executeCommandPlan(plan);
  const resultPromise = computerControlQueue.then(run, run);

  computerControlQueue = resultPromise.then(
    () => undefined,
    () => undefined,
  );

  return resultPromise;
}
