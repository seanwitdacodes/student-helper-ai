import { useMemo, useState } from "react";

const MODE_META = {
  Answer: "Fast direct responses",
  Tutor: "Explain ideas step by step",
  Build: "Product, UI, and coding workflows",
  Research: "Compare options and draft reports",
  Automation: "Design recurring task flows",
  Math: "Camera solver with worked steps",
};

const NAV_ITEMS = [
  { id: "new", label: "New chat", kind: "action" },
  { id: "research", label: "Search", kind: "mode", mode: "Research" },
  { id: "build", label: "Plugins", kind: "mode", mode: "Build" },
  { id: "automation", label: "Automations", kind: "mode", mode: "Automation" },
];

function getTrialDaysLeft(trialEndsAt) {
  const remainingMs = Number(trialEndsAt || 0) - Date.now();
  if (remainingMs <= 0) return 0;
  return Math.max(1, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
}

function formatRelativeTime(timestamp) {
  const diff = Math.max(0, Date.now() - Number(timestamp || 0));
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < hour) {
    const minutes = Math.max(1, Math.round(diff / minute));
    return `${minutes}m`;
  }

  if (diff < day) {
    const hours = Math.max(1, Math.round(diff / hour));
    return `${hours}h`;
  }

  const days = Math.max(1, Math.round(diff / day));
  return `${days}d`;
}

function Sidebar({
  mode,
  activeView,
  account,
  setMode,
  conversations,
  activeId,
  onOpenBilling,
  onSelectConversation,
  onNewConversation,
  onOpenTool,
  onDeleteConversation,
}) {
  const [showAllThreads, setShowAllThreads] = useState(false);
  const modes = ["Build", "Research", "Tutor", "Automation", "Math"];
  const trialDaysLeft = account?.tier === "trial" ? getTrialDaysLeft(account?.trialEndsAt) : 0;
  const planTitle = account?.tier === "pro" ? "Max unlocked" : account?.tier === "trial" ? "Free trial" : "Upgrade";
  const planSummary =
    account?.tier === "pro"
      ? "Full workspace"
      : account?.tier === "trial"
      ? trialDaysLeft > 0
        ? `${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left`
        : "Ends today"
      : "Starter";

  const visibleConversations = useMemo(
    () => (showAllThreads ? conversations : conversations.slice(0, 5)),
    [conversations, showAllThreads],
  );

  return (
    <aside className="sidebar">
      <div className="sidebar-topbar">
        <div className="window-controls" aria-hidden="true">
          <span className="window-dot red" />
          <span className="window-dot yellow" />
          <span className="window-dot green" />
        </div>
        <button className="sidebar-update-btn" onClick={onOpenBilling}>
          Update
        </button>
      </div>

      <div className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`sidebar-nav-item ${item.mode === mode && activeView === "chat" ? "active" : ""}`}
            onClick={() => {
              if (item.kind === "action") {
                onNewConversation();
                return;
              }
              setMode(item.mode);
            }}
          >
            <span className="sidebar-nav-icon" aria-hidden="true">
              {item.id === "new" ? "+" : item.id === "research" ? "?" : item.id === "build" ? "<>" : "@"}
            </span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      <div className="sidebar-section-head">
        <div className="section-label">Workspaces</div>
      </div>
      <div className="mode-list sidebar-mode-list">
        {modes.map((item) => (
          <button
            key={item}
            className={mode === item && activeView === "chat" ? "active" : ""}
            onClick={() => setMode(item)}
          >
            <strong>{item}</strong>
            <span>{MODE_META[item]}</span>
          </button>
        ))}
      </div>

      <div className="sidebar-section-head">
        <div className="section-label">Study Tools</div>
      </div>
      <div className="tool-list">
        <button className={activeView === "flashcards" ? "active" : ""} onClick={() => onOpenTool("flashcards")}>
          <strong>Flashcards</strong>
          <span>Study sets and drills</span>
        </button>
        <button className={activeView === "slides" ? "active" : ""} onClick={() => onOpenTool("slides")}>
          <strong>Slides</strong>
          <span>Decks, themes, and notes</span>
        </button>
      </div>

      <div className="sidebar-section-head threads-head">
        <div className="section-label">Threads</div>
      </div>

      <div className="sidebar-project-card">
        <div className="sidebar-project-icon" aria-hidden="true">
          /&gt;
        </div>
        <div>
          <div className="sidebar-project-title">student-helper</div>
          <div className="sidebar-project-subtitle">Persistent local workspace</div>
        </div>
      </div>

      <div className="chat-list">
        {visibleConversations.map((conversation) => (
          <button
            key={conversation.id}
            className={`chat-item ${conversation.id === activeId ? "active" : ""}`}
            onClick={() => onSelectConversation(conversation.id)}
            onContextMenu={(event) => {
              event.preventDefault();
              if (window.confirm(`Delete "${conversation.title || "New chat"}"?`)) {
                onDeleteConversation(conversation.id);
              }
            }}
          >
            <div className="chat-item-top">
              <div className="chat-title">{conversation.title || "New chat"}</div>
              <span className="chat-time">{formatRelativeTime(conversation.updatedAt)}</span>
            </div>
            <div className="chat-preview">
              {(conversation.messages?.[conversation.messages.length - 1]?.content ||
                MODE_META[conversation.mode] ||
                "A fresh thread is ready.")
                .slice(0, 90)
                .replace(/\s+/g, " ")}
            </div>
          </button>
        ))}
      </div>

      {conversations.length > 5 && (
        <button className="sidebar-show-more" onClick={() => setShowAllThreads((current) => !current)}>
          {showAllThreads ? "Show less" : "Show more"}
        </button>
      )}

      <button className="sidebar-plan-button" onClick={onOpenBilling}>
        <span>{planTitle}</span>
        <strong>{planSummary}</strong>
      </button>

      <button className="sidebar-settings-btn" onClick={onOpenBilling}>
        Settings
      </button>
    </aside>
  );
}

export default Sidebar;
