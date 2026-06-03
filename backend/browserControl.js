import { chromium } from "playwright";

const PLAYWRIGHT_HEADLESS =
  String(process.env.PLAYWRIGHT_HEADLESS || "false").toLowerCase() === "true";
const NAVIGATION_TIMEOUT_MS = 25 * 1000;

const SITE_DIRECTORY = [
  {
    keys: ["google", "google search"],
    label: "Google",
    url: "https://www.google.com",
    searchUrl: (query) =>
      `https://www.google.com/search?q=${encodeURIComponent(query)}`,
  },
  {
    keys: ["youtube"],
    label: "YouTube",
    url: "https://www.youtube.com",
    searchUrl: (query) =>
      `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
  },
  {
    keys: ["gmail", "google mail"],
    label: "Gmail",
    url: "https://mail.google.com",
  },
  {
    keys: ["google docs", "docs", "google documents"],
    label: "Google Docs",
    url: "https://docs.google.com/document/u/0/",
  },
  {
    keys: ["espn"],
    label: "ESPN",
    url: "https://www.espn.com",
  },
  {
    keys: ["amazon"],
    label: "Amazon",
    url: "https://www.amazon.com",
    searchUrl: (query) =>
      `https://www.amazon.com/s?k=${encodeURIComponent(query)}`,
  },
];

const SAFETY_RULES = [
  {
    pattern: /\b(sign in|signin|log in|login|password|passcode|otp|2fa|verification code)\b/i,
    message:
      "Computer Control will not enter passwords or sign in for you. I can open the site, but you should handle credentials yourself.",
  },
  {
    pattern: /\b(buy|purchase|checkout|place order|pay now|confirm purchase|order now)\b/i,
    message:
      "Computer Control will not make purchases. I can open the site or search for an item, but checkout stays blocked.",
  },
  {
    pattern: /\b(submit|send|post)\b.*\b(form|application|email|message)\b/i,
    message:
      "Computer Control will not submit forms or send messages automatically. Open the page first, then confirm explicitly before any submission flow gets added.",
  },
];

const browserState = {
  browser: null,
  context: null,
  launchPromise: null,
};

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^\w\s.:/-]/g, " ")
    .replace(/\s+/g, " ");
}

function formatList(values) {
  if (values.length <= 1) return values[0] || "";
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

function looksLikeUrl(value) {
  return /^https?:\/\//i.test(value) || /^www\./i.test(value);
}

function normalizeUrl(value) {
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
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
  if (knownSite) {
    return knownSite;
  }

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

function splitTabTargets(rawList) {
  return String(rawList || "")
    .replace(/\s+and\s+/gi, ",")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getSafetyMessage(command) {
  const trimmedCommand = String(command || "").trim();

  for (const rule of SAFETY_RULES) {
    if (rule.pattern.test(trimmedCommand)) {
      return rule.message;
    }
  }

  return "";
}

function buildUsageMessage() {
  return [
    "Computer Control is command-based right now.",
    'Try commands like "Open YouTube", "Search AP Calculus derivative rules", "Open Google and search AP Calculus derivative rules", "Open 3 tabs: Gmail, Google Docs, and ESPN", or "Close browser".',
  ].join(" ");
}

function parseCommand(command) {
  const trimmed = String(command || "").trim();
  if (!trimmed) {
    return { type: "help" };
  }

  const safetyMessage = getSafetyMessage(trimmed);
  if (safetyMessage) {
    return { type: "blocked", message: safetyMessage };
  }

  const closeMatch = trimmed.match(/^(?:close|quit|exit)\s+(?:the\s+)?browser\s*$/i);
  if (closeMatch) {
    return { type: "close-browser" };
  }

  const multiTabMatch = trimmed.match(
    /^(?:open|launch)\s+(?:\d+\s+)?tabs?\s*:?\s*(.+)$/i,
  );
  if (multiTabMatch) {
    return {
      type: "open-tabs",
      targets: splitTabTargets(multiTabMatch[1]),
    };
  }

  const openAndSearchMatch = trimmed.match(
    /^(?:open|go to)\s+(.+?)\s+and\s+search\s+(.+)$/i,
  );
  if (openAndSearchMatch) {
    return {
      type: "open-and-search",
      site: openAndSearchMatch[1].trim(),
      query: openAndSearchMatch[2].trim(),
    };
  }

  const searchMatch = trimmed.match(/^search\s+(.+)$/i);
  if (searchMatch) {
    return {
      type: "search",
      query: searchMatch[1].trim(),
    };
  }

  const openMatch = trimmed.match(/^(?:open|go to)\s+(.+)$/i);
  if (openMatch) {
    const rawTarget = openMatch[1].trim();
    const splitTargets = splitTabTargets(rawTarget);

    if (splitTargets.length > 1) {
      return {
        type: "open-tabs",
        targets: splitTargets,
      };
    }

    return {
      type: "open-site",
      site: rawTarget,
    };
  }

  return { type: "help" };
}

function resetBrowserState() {
  browserState.browser = null;
  browserState.context = null;
  browserState.launchPromise = null;
}

async function ensureBrowserSession() {
  if (browserState.browser && browserState.context) {
    return browserState;
  }

  if (browserState.launchPromise) {
    await browserState.launchPromise;
    return browserState;
  }

  browserState.launchPromise = (async () => {
    const browser = await chromium.launch({
      headless: PLAYWRIGHT_HEADLESS,
      args: PLAYWRIGHT_HEADLESS ? [] : ["--start-maximized"],
    });

    browser.on("disconnected", () => {
      resetBrowserState();
    });

    const context = await browser.newContext({
      viewport: PLAYWRIGHT_HEADLESS ? { width: 1440, height: 960 } : null,
    });

    browserState.browser = browser;
    browserState.context = context;
  })();

  try {
    await browserState.launchPromise;
  } finally {
    browserState.launchPromise = null;
  }

  return browserState;
}

async function openPage(url) {
  const { context } = await ensureBrowserSession();
  const page = await context.newPage();
  await page.goto(url, {
    timeout: NAVIGATION_TIMEOUT_MS,
    waitUntil: "domcontentloaded",
  });
  return page;
}

async function handleOpenSite(siteInput) {
  const site = resolveSite(siteInput);
  if (!site) {
    throw new Error(
      `I couldn't figure out which site "${siteInput}" refers to. Try a full URL like https://example.com or a common site name like YouTube or Amazon.`,
    );
  }

  await openPage(site.url);
  return `Opened ${site.label} in a new Chromium tab.`;
}

async function handleSearch(query) {
  await openPage(
    `https://www.google.com/search?q=${encodeURIComponent(query)}`,
  );
  return `Opened Google and searched for "${query}".`;
}

async function handleOpenAndSearch(siteInput, query) {
  const site = resolveSite(siteInput);
  if (!site) {
    throw new Error(
      `I couldn't figure out which site "${siteInput}" refers to. Try a full URL or a common site name like Google, YouTube, or Amazon.`,
    );
  }

  const targetUrl = site.searchUrl
    ? site.searchUrl(query)
    : `https://www.google.com/search?q=${encodeURIComponent(`${site.label} ${query}`)}`;

  await openPage(targetUrl);

  if (site.searchUrl) {
    return `Opened ${site.label} and searched for "${query}".`;
  }

  return `Opened a search for "${query}" related to ${site.label}. ${site.label} does not have a built-in search template yet, so I used Google.`;
}

async function handleOpenTabs(targets) {
  if (!targets.length) {
    throw new Error(
      'I need at least one site name after "open tabs". Example: "Open 3 tabs: Gmail, Google Docs, and ESPN".',
    );
  }

  const resolvedTargets = targets.map((target) => {
    const site = resolveSite(target);
    if (!site) {
      throw new Error(
        `I couldn't figure out which site "${target}" refers to. Try a full URL or a clearer site name.`,
      );
    }
    return site;
  });

  for (const site of resolvedTargets) {
    await openPage(site.url);
  }

  return `Opened ${resolvedTargets.length} tabs: ${formatList(
    resolvedTargets.map((site) => site.label),
  )}.`;
}

async function handleCloseBrowser() {
  if (!browserState.browser) {
    return "No Chromium browser window is open right now.";
  }

  await browserState.browser.close();
  resetBrowserState();
  return "Closed the Chromium browser window.";
}

export async function handleComputerControlCommand(command) {
  const parsedCommand = parseCommand(command);

  switch (parsedCommand.type) {
    case "blocked":
      return parsedCommand.message;
    case "close-browser":
      return handleCloseBrowser();
    case "search":
      return handleSearch(parsedCommand.query);
    case "open-site":
      return handleOpenSite(parsedCommand.site);
    case "open-and-search":
      return handleOpenAndSearch(parsedCommand.site, parsedCommand.query);
    case "open-tabs":
      return handleOpenTabs(parsedCommand.targets);
    case "help":
    default:
      return buildUsageMessage();
  }
}
