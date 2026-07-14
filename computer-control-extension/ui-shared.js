const STATUS_KEYS = [
  "conductorStatus",
  "workspaceTabId",
  "workspaceTabTitle",
  "conductorMemory",
];

export function initializeConductorUi({
  defaultStatus = "Ready.",
  defaultPlaceholder = "Open YouTube then search Dhar Mann",
} = {}) {
  const taskInput = document.querySelector("#taskInput");
  const runButton = document.querySelector("#runButton");
  const reuseButton = document.querySelector("#reuseButton");
  const statusOutput = document.querySelector("#statusOutput");
  const workspaceState = document.querySelector("#workspaceState");
  const clearStatusButton = document.querySelector("#clearStatusButton");
  const memoryOutput = document.querySelector("#memoryOutput");

  if (taskInput) {
    taskInput.placeholder = defaultPlaceholder;
  }

  function setStatus(message) {
    if (statusOutput) {
      statusOutput.textContent = String(message || "").trim() || defaultStatus;
    }
  }

  function setMemory(memory) {
    if (!memoryOutput) return;
    const items = Array.isArray(memory) ? memory.slice(-10) : [];
    memoryOutput.innerHTML = "";

    if (!items.length) {
      const emptyState = document.createElement("div");
      emptyState.className = "chat-empty";
      emptyState.textContent = "No shared session memory yet.";
      memoryOutput.appendChild(emptyState);
      return;
    }

    for (const item of items) {
      const bubble = document.createElement("div");
      const role =
        item.role === "assistant"
          ? "Assistant"
          : item.role === "system"
            ? "System"
            : "User";

      bubble.className = `chat-bubble is-${item.role === "assistant" ? "assistant" : item.role === "system" ? "system" : "user"}`;

      const roleLabel = document.createElement("div");
      roleLabel.className = "chat-role";
      roleLabel.textContent = role;

      const text = document.createElement("div");
      text.className = "chat-text";
      text.textContent = String(item.content || "").trim();

      bubble.appendChild(roleLabel);
      bubble.appendChild(text);
      memoryOutput.appendChild(bubble);
    }

    memoryOutput.scrollTop = memoryOutput.scrollHeight;
  }

  async function refreshState() {
    const stored = await chrome.storage.local.get(STATUS_KEYS);

    if (workspaceState) {
      workspaceState.textContent = stored.workspaceTabTitle
        ? `Workspace: ${stored.workspaceTabTitle}`
        : stored.workspaceTabId
          ? `Workspace tab #${stored.workspaceTabId}`
          : "No workspace yet";
    }

    setStatus(stored.conductorStatus || defaultStatus);
    setMemory(stored.conductorMemory || []);
  }

  async function runTask({ continueWorkspace = false } = {}) {
    const message = taskInput?.value.trim();
    if (!message) {
      setStatus("Type a task first.");
      return;
    }

    if (runButton) runButton.disabled = true;
    if (reuseButton) reuseButton.disabled = true;
    setStatus("Sending the task to Conductor...");

    try {
      const response = await chrome.runtime.sendMessage({
        type: "run-task",
        message,
        continueWorkspace,
      });

      if (!response?.ok) {
        throw new Error(response?.error || "The task could not be completed.");
      }

      if (taskInput) taskInput.value = "";
      await refreshState();
    } catch (error) {
      setStatus(error?.message || "The task could not be completed.");
    } finally {
      if (runButton) runButton.disabled = false;
      if (reuseButton) reuseButton.disabled = false;
    }
  }

  runButton?.addEventListener("click", () => runTask());
  reuseButton?.addEventListener("click", () =>
    runTask({ continueWorkspace: true }),
  );
  clearStatusButton?.addEventListener("click", async () => {
    await chrome.storage.local.set({ conductorStatus: defaultStatus });
    await refreshState();
  });

  taskInput?.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      runTask();
    }
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    if (STATUS_KEYS.some((key) => key in changes)) {
      refreshState();
    }
  });

  refreshState();
}
