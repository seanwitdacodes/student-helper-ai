import { useMemo, useState } from "react";

const NAV_ITEMS = [
  { id: "home", label: "Home", kind: "chat" },
  { id: "control", label: "Control Computer Mode", kind: "chat", mode: "Control" },
  { id: "math", label: "Math Solver", kind: "chat", mode: "Math" },
  { id: "flashcards", label: "Flashcards", kind: "view", view: "flashcards" },
  { id: "slides", label: "Slides", kind: "view", view: "slides" },
  { id: "update", label: "Update Version", kind: "view", view: "update" },
];

const MODE_PREVIEW = {
  Build: "A new chat is ready.",
  Control: "Control Computer Mode is ready.",
  Math: "Math Solver is ready.",
  Tutor: "Tutor Mode is ready.",
  Research: "Research Mode is ready.",
  Automation: "Automation Mode is ready.",
};

function getPlanLabel(tier) {
  if (tier === "pro") return "Full Version";
  if (tier === "trial") return "Free Trial";
  return "Free Plan";
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

function getPreviewText(conversation) {
  const latest = String(conversation.messages?.[conversation.messages.length - 1]?.content || "").trim();
  if (latest) {
    return latest
      .replace(/```[\s\S]*?```/g, "[code]")
      .replace(/\s+/g, " ")
      .slice(0, 90);
  }

  return MODE_PREVIEW[conversation.mode] || "A fresh thread is ready.";
}

function Sidebar({
  mode,
  activeView,
  account,
  conversations,
  activeId,
  collapsed = false,
  isOpen = false,
  onToggleCollapse,
  onOpenHome,
  onOpenControlMode,
  onOpenMathMode,
  onSelectConversation,
  onNewConversation,
  onOpenTool,
  onDeleteConversation,
}) {
  const [showAllThreads, setShowAllThreads] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const normalizedSearch = searchTerm.trim().toLowerCase();

  const visibleConversations = useMemo(
    () =>
      (showAllThreads ? conversations : conversations.slice(0, 12)).filter((conversation) => {
        if (!normalizedSearch) return true;
        const haystack = [
          conversation.title,
          getPreviewText(conversation),
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalizedSearch);
      }),
    [conversations, normalizedSearch, showAllThreads],
  );
  const planLabel = getPlanLabel(account?.tier);

  return (
    <aside className={`sidebar ${collapsed ? "is-collapsed" : ""} ${isOpen ? "is-open" : ""}`}>
      <div className="sidebar-top">
        <div className="sidebar-brand-block">
          <div className="brand-mark" aria-hidden="true">
            H
          </div>
          {!collapsed && (
            <div className="sidebar-brand-copy">
              <div className="sidebar-brand-title">Helper AI</div>
              <div className="sidebar-brand-subtitle">Calm, fast AI chat</div>
            </div>
          )}
        </div>
        <button
          type="button"
          className="sidebar-collapse-btn"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? ">>" : "<<"}
        </button>
      </div>

      <button className="new-chat-btn" onClick={onNewConversation} title="New chat">
        <span className="sidebar-nav-icon" aria-hidden="true">
          +
        </span>
        {!collapsed && <span>New chat</span>}
      </button>

      {!collapsed && (
        <label className="sidebar-search">
          <span className="section-label">Search</span>
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search chats"
            aria-label="Search chats"
          />
        </label>
      )}

      {!collapsed && (
        <div className="sidebar-section-head">
          <div className="section-label">Menu</div>
        </div>
      )}

      <div className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            title={item.label}
            className={`sidebar-nav-item ${
              (item.id === "home" && activeView === "chat" && mode !== "Control" && mode !== "Math") ||
              (item.mode === mode && activeView === "chat") ||
              (item.view === activeView)
                ? "active"
                : ""
            }`}
            onClick={() => {
              if (item.id === "home") {
                onOpenHome();
                return;
              }

              if (item.mode === "Control") {
                onOpenControlMode();
                return;
              }

              if (item.mode === "Math") {
                onOpenMathMode();
                return;
              }

              if (item.view) {
                onOpenTool(item.view);
              }
            }}
          >
            <span className="sidebar-nav-icon" aria-hidden="true">
              {item.id === "home"
                ? ">"
                : item.id === "control"
                ? "C"
                : item.id === "math"
                ? "M"
                : item.id === "flashcards"
                ? "F"
                : item.id === "slides"
                ? "S"
                : "U"}
            </span>
            {!collapsed && <span>{item.label}</span>}
          </button>
        ))}
      </div>

      {!collapsed && (
        <div className="sidebar-section-head threads-head">
          <div className="section-label">Recent chats</div>
        </div>
      )}

      <div className="chat-list">
        {visibleConversations.map((conversation) => (
          <button
            key={conversation.id}
            type="button"
            className={`chat-item ${conversation.id === activeId ? "active" : ""}`}
            title={conversation.title || "New chat"}
            onClick={() => onSelectConversation(conversation.id)}
            onContextMenu={(event) => {
              event.preventDefault();
              if (window.confirm(`Delete "${conversation.title || "New chat"}"?`)) {
                onDeleteConversation(conversation.id);
              }
            }}
          >
            <div className="chat-item-top">
              {!collapsed && (
                <>
                  <div className="chat-title">{conversation.title || "New chat"}</div>
                  <span className="chat-time">{formatRelativeTime(conversation.updatedAt)}</span>
                </>
              )}
              {collapsed && <div className="chat-thread-index">{(conversation.title || "New chat").slice(0, 1)}</div>}
            </div>
            {!collapsed && <div className="chat-preview">{getPreviewText(conversation)}</div>}
          </button>
        ))}
      </div>

      {conversations.length > 12 && !collapsed && (
        <button className="sidebar-show-more" onClick={() => setShowAllThreads((current) => !current)}>
          {showAllThreads ? "Show less" : "Show more"}
        </button>
      )}

      <div className="sidebar-footer">
        {!collapsed && (
          <div className="sidebar-plan-summary">
            <div className="section-label">Account</div>
            <strong>{planLabel}</strong>
          </div>
        )}
        <button type="button" className="sidebar-footer-btn" onClick={() => onOpenTool("update")} title="Update Version">
          <span className="sidebar-nav-icon" aria-hidden="true">
            U
          </span>
          {!collapsed && <span>Update Version</span>}
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
