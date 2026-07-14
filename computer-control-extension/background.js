const DEFAULT_BACKEND_URL = "http://127.0.0.1:5050";
const STORAGE_KEYS = [
  "workspaceTabId",
  "workspaceTabTitle",
  "workspaceTabWindowId",
  "conductorStatus",
  "conductorMemory",
];
const POLL_INTERVAL_MS = 1500;

let isPolling = false;
let pollingStarted = false;

async function getStoredWorkspace() {
  return chrome.storage.local.get(STORAGE_KEYS);
}

async function setStoredWorkspace(tab) {
  await chrome.storage.local.set({
    workspaceTabId: tab?.id || null,
    workspaceTabTitle: tab?.title || "",
    workspaceTabWindowId: tab?.windowId || null,
  });
}

async function clearStoredWorkspace() {
  await chrome.storage.local.remove([
    "workspaceTabId",
    "workspaceTabTitle",
    "workspaceTabWindowId",
  ]);
}

async function setConductorStatus(message) {
  await chrome.storage.local.set({
    conductorStatus: String(message || "").trim() || "Conductor is ready.",
  });
}

async function setConductorMemory(memory = []) {
  await chrome.storage.local.set({
    conductorMemory: Array.isArray(memory) ? memory.slice(-12) : [],
  });
}

async function syncConductorSessionState(session) {
  await setConductorMemory(session?.memory || []);
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    throw new Error("Open a normal Chrome tab first.");
  }
  return tab;
}

async function apiFetch(path, options = {}) {
  const response = await fetch(`${DEFAULT_BACKEND_URL}${path}`, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.detail || "Conductor could not reach the backend.");
  }
  return data;
}

async function ensureSharedSession(sessionId = "") {
  const data = await apiFetch("/computer/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
  });
  return data.session;
}

async function getActiveSharedSession() {
  const data = await apiFetch("/computer/session/active");
  return data.session || null;
}

async function queueSharedTask(
  sessionId,
  command,
  source = "extension",
  context = [],
) {
  const data = await apiFetch(`/computer/session/${sessionId}/command`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command, source, context }),
  });
  return data.task;
}

async function claimSharedTask(sessionId) {
  const data = await apiFetch(`/computer/session/${sessionId}/next-task`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return data.task || null;
}

async function saveSharedTaskResult(sessionId, taskId, result, error = "") {
  await apiFetch(`/computer/session/${sessionId}/task/${taskId}/result`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ result, error }),
  });
}

function waitForTabComplete(tabId) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(handleUpdated);
      reject(new Error("The page took too long to load."));
    }, 20000);

    function handleUpdated(updatedTabId, changeInfo, tab) {
      if (updatedTabId !== tabId) return;
      if (changeInfo.status !== "complete") return;
      clearTimeout(timeoutId);
      chrome.tabs.onUpdated.removeListener(handleUpdated);
      resolve(tab);
    }

    chrome.tabs.onUpdated.addListener(handleUpdated);
  });
}

async function ensureWorkspaceTab() {
  const activeTab = await getActiveTab();
  const stored = await getStoredWorkspace();

  if (stored.workspaceTabId) {
    try {
      const tab = await chrome.tabs.get(stored.workspaceTabId);
      if (tab?.id) {
        await chrome.tabs.update(tab.id, { active: true });
        return tab;
      }
    } catch {
      await clearStoredWorkspace();
    }
  }

  await setStoredWorkspace(activeTab);
  return activeTab;
}

async function createWorkspaceTab(url, sourceTab) {
  const createdTab = await chrome.tabs.create({
    url,
    active: true,
    index: typeof sourceTab?.index === "number" ? sourceTab.index + 1 : undefined,
    windowId: sourceTab?.windowId,
  });
  await waitForTabComplete(createdTab.id);
  await setStoredWorkspace(createdTab);
  return createdTab;
}

async function openSidePanelForTab(tabId) {
  if (!chrome.sidePanel?.setOptions) return;

  try {
    await chrome.sidePanel.setOptions({
      tabId,
      path: "sidepanel.html",
      enabled: true,
    });
    if (chrome.sidePanel.open) {
      await chrome.sidePanel.open({ tabId });
    }
  } catch {
    // Best effort. The popup still works even if Chrome denies auto-open.
  }
}

async function sendWorkspaceAction(tabId, step) {
  const response = await chrome.tabs.sendMessage(tabId, {
    type: "computer-control-action",
    step,
  });

  if (!response?.ok) {
    throw new Error(response?.error || "The page action failed.");
  }

  return response;
}

async function executeStep(step, context) {
  if (step.action === "open-url") {
    if (!context.workspaceTab?.id || context.shouldOpenFreshTab) {
      const freshTab = await createWorkspaceTab(step.url, context.sourceTab);
      context.workspaceTab = freshTab;
      context.shouldOpenFreshTab = false;
      await openSidePanelForTab(freshTab.id);
      return `Opened ${step.siteLabel || "the site"} in a new tab.`;
    }

    const updatedTab = await chrome.tabs.update(context.workspaceTab.id, {
      url: step.url,
      active: true,
    });
    await waitForTabComplete(updatedTab.id);
    context.workspaceTab = updatedTab;
    await setStoredWorkspace(updatedTab);
    await openSidePanelForTab(updatedTab.id);
    return `Opened ${step.siteLabel || "the site"} in the workspace tab.`;
  }

  if (step.action === "wait-for-page") {
    if (context.workspaceTab?.id) {
      await waitForTabComplete(context.workspaceTab.id).catch(() => undefined);
      await openSidePanelForTab(context.workspaceTab.id);
    }
    return "Page loaded.";
  }

  if (step.action === "go-back") {
    await chrome.tabs.goBack(context.workspaceTab.id);
    return "Went back one page.";
  }

  if (step.action === "go-forward") {
    await chrome.tabs.goForward(context.workspaceTab.id);
    return "Went forward one page.";
  }

  const result = await sendWorkspaceAction(context.workspaceTab.id, step);
  const freshTab = await chrome.tabs.get(context.workspaceTab.id);
  context.workspaceTab = freshTab;
  await setStoredWorkspace(freshTab);
  await openSidePanelForTab(freshTab.id);
  return result.message || "Step completed.";
}

async function executePlan(plan) {
  const sourceTab = await getActiveTab();
  const context = {
    sourceTab,
    workspaceTab: await ensureWorkspaceTab(),
    shouldOpenFreshTab: Array.isArray(plan?.steps)
      ? plan.steps.some((step) => step?.action === "open-url")
      : false,
  };
  const messages = [];

  for (const step of plan.steps || []) {
    const stepMessage = await executeStep(step, context);
    if (stepMessage && step.action !== "wait-for-page") {
      messages.push(stepMessage);
      await setConductorStatus(stepMessage);
    }
  }

  if (context.workspaceTab?.id) {
    await setStoredWorkspace(context.workspaceTab);
  }

  return messages[messages.length - 1] || "Done.";
}

async function fetchPlan(message, history = []) {
  return apiFetch("/computer/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, mode: "computer", history }),
  });
}

async function runQueuedTask(task, session) {
  await setConductorStatus(`Planning: ${task.command}`);
  await syncConductorSessionState(session);

  const planResponse = await fetchPlan(
    task.command,
    Array.isArray(task.context) && task.context.length
      ? task.context
      : session?.memory || [],
  );

  if (planResponse.type === "message") {
    await setConductorStatus(planResponse.message);
    await saveSharedTaskResult(session.id, task.id, planResponse.message, "");
    return planResponse.message;
  }

  await setConductorStatus("Executing browser steps in Chrome...");
  const result = await executePlan(planResponse.plan);
  await setConductorStatus(result);
  await saveSharedTaskResult(session.id, task.id, result, "");
  return result;
}

async function pollSharedComputerTasks() {
  if (isPolling) return;
  isPolling = true;

  try {
    const session = await getActiveSharedSession();
    if (!session?.id) return;
    await syncConductorSessionState(session);

    const task = await claimSharedTask(session.id);
    if (!task?.id) return;

    try {
      await setConductorStatus(`Working on: ${task.command}`);
      await runQueuedTask(task, session);
    } catch (error) {
      const message =
        error?.message || "Conductor could not complete that browser task.";
      await setConductorStatus(message);
      await saveSharedTaskResult(session.id, task.id, "", message);
    }
  } catch {
    // Keep polling quietly until the backend is ready.
  } finally {
    isPolling = false;
  }
}

function startPollingLoop() {
  if (pollingStarted) return;
  pollingStarted = true;
  pollSharedComputerTasks();
  setInterval(pollSharedComputerTasks, POLL_INTERVAL_MS);
}

async function waitForSharedTask(sessionId, taskId) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 90 * 1000) {
    const data = await apiFetch(`/computer/session/${sessionId}/task/${taskId}`);
    const status = String(data?.task?.status || "").trim();

    if (status === "completed") {
      return data.task.result || "Conductor finished the browser task.";
    }

    if (status === "failed") {
      throw new Error(
        data.task.error || "Conductor could not complete that browser task.",
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 1200));
  }

  throw new Error("The shared Computer Control task is still running.");
}

chrome.runtime.onInstalled.addListener(() => {
  startPollingLoop();
});

chrome.runtime.onStartup.addListener(() => {
  startPollingLoop();
});

startPollingLoop();
setConductorStatus("Conductor is ready.").catch(() => undefined);

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request?.type !== "run-task") {
    return false;
  }

  (async () => {
    try {
      const activeSession = await getActiveSharedSession();
      const session = await ensureSharedSession(activeSession?.id || "");
      await syncConductorSessionState(session);
      await setConductorStatus(`Queued from Conductor: ${request.message}`);

      const task = await queueSharedTask(
        session.id,
        request.message,
        "extension",
        session.memory || [],
      );
      const message = await waitForSharedTask(session.id, task.id);
      await setConductorStatus(message);
      sendResponse({ ok: true, message });
    } catch (error) {
      const message = error?.message || "The task could not be completed.";
      await setConductorStatus(message);
      sendResponse({
        ok: false,
        error: message,
      });
    }
  })();

  return true;
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const stored = await getStoredWorkspace();
  if (stored.workspaceTabId === tabId) {
    await clearStoredWorkspace();
  }
});
