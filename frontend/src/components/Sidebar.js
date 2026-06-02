import { useMemo, useState } from "react";
import BrandMark from "./BrandMark";

const REGULAR_MODE = "regular";
const COMPUTER_MODE = "computer";

const MAIN_ITEMS = [
  {
    id: "chat",
    label: "Chat",
    note: "Simple private AI chat",
    mode: REGULAR_MODE,
    icon: "C",
  },
  {
    id: "computer",
    label: "Computer Control",
    note: "Browser and desktop help",
    mode: COMPUTER_MODE,
    icon: "O",
  },
];

function formatRelativeTime(timestamp) {
  const diff = Math.max(0, Date.now() - Number(timestamp || 0));
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < hour) {
    return `${Math.max(1, Math.round(diff / minute))}m`;
  }

  if (diff < day) {
    return `${Math.max(1, Math.round(diff / hour))}h`;
  }

  return `${Math.max(1, Math.round(diff / day))}d`;
}

function getPreviewText(conversation) {
  const stableMessage = [...(conversation.messages || [])]
    .reverse()
    .find(
      (message) =>
        !message?.isStreaming && String(message?.content || "").trim(),
    );
  const latest = String(stableMessage?.content || "").trim();
  if (latest) {
    return latest
      .replace(/```[\s\S]*?```/g, "[code]")
      .replace(/\s+/g, " ")
      .slice(0, 90);
  }

  if (conversation.mode === COMPUTER_MODE) {
    return "Ready for browser and desktop tasks.";
  }

  return "Ready for a new chat.";
}

function Sidebar({
  mode,
  conversations,
  activeId,
  collapsed = false,
  isOpen = false,
  onToggleCollapse,
  onOpenRegularMode,
  onOpenComputerMode,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
}) {
  const [showAllThreads, setShowAllThreads] = useState(false);
  const activeMode = mode === COMPUTER_MODE ? COMPUTER_MODE : REGULAR_MODE;

  const visibleConversations = useMemo(
    () => (showAllThreads ? conversations : conversations.slice(0, 8)),
    [conversations, showAllThreads],
  );

  return (
    <aside
      className={`sidebar ${collapsed ? "is-collapsed" : ""} ${isOpen ? "is-open" : ""}`}
    >
      <div className="sidebar-top">
        <div className="sidebar-brand-block">
          <BrandMark />
          {!collapsed && (
            <div className="sidebar-brand-copy">
              <div className="sidebar-brand-title">Operator AI</div>
              <div className="sidebar-brand-subtitle">
                Simple local AI with just two modes.
              </div>
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

      <button
        className="new-chat-btn"
        onClick={onNewConversation}
        title="New chat"
      >
        <span className="sidebar-nav-icon" aria-hidden="true">
          +
        </span>
        {!collapsed && <span>New chat</span>}
      </button>

      {!collapsed && (
        <div className="sidebar-section-head">
          <div className="section-label">Modes</div>
        </div>
      )}

      <div className="sidebar-nav">
        {MAIN_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            title={item.label}
            className={`sidebar-nav-item ${item.mode === activeMode ? "active" : ""}`}
            onClick={() => {
              if (item.mode === REGULAR_MODE) {
                onOpenRegularMode();
                return;
              }

              onOpenComputerMode();
            }}
          >
            <span className="sidebar-nav-icon" aria-hidden="true">
              {item.icon}
            </span>
            {!collapsed && (
              <span className="sidebar-nav-copy">
                <strong>{item.label}</strong>
                <span className="sidebar-nav-note">{item.note}</span>
              </span>
            )}
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
              if (
                window.confirm(`Delete "${conversation.title || "New chat"}"?`)
              ) {
                onDeleteConversation(conversation.id);
              }
            }}
          >
            <div className="chat-item-top">
              {!collapsed ? (
                <>
                  <div className="chat-title">
                    {conversation.title || "New chat"}
                  </div>
                  <span className="chat-time">
                    {formatRelativeTime(conversation.updatedAt)}
                  </span>
                </>
              ) : (
                <div className="chat-thread-index">
                  {(conversation.title || "New chat").slice(0, 1)}
                </div>
              )}
            </div>
            {!collapsed && (
              <div className="chat-preview">{getPreviewText(conversation)}</div>
            )}
          </button>
        ))}
      </div>

      {conversations.length > 8 && !collapsed && (
        <button
          className="sidebar-show-more"
          onClick={() => setShowAllThreads((current) => !current)}
        >
          {showAllThreads ? "Show less" : "Show more"}
        </button>
      )}
    </aside>
  );
}

export default Sidebar;
