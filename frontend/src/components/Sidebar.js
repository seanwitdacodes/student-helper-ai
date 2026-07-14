import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import BrandMark from "./BrandMark";

const REGULAR_MODE = "regular";
const COMPUTER_MODE = "computer";

function SidebarGlyph({ name }) {
  if (name === "plus") {
    return (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path
          d="M10 4.2v11.6M4.2 10h11.6"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (name === "computer") {
    return (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <rect
          x="3.2"
          y="4"
          width="13.6"
          height="9.2"
          rx="2.2"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M7 16h6M8.2 13.6l-.8 2.4m5.4-2.4.8 2.4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (name === "history") {
    return (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path
          d="M10 5.2a4.8 4.8 0 1 1-4.1 2.3M6 5H3.8v2.2"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M10 7.3v3.3l2 1.3"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (name === "chat") {
    return (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path
          d="M4.4 6.1a2.1 2.1 0 0 1 2.1-2.1h7a2.1 2.1 0 0 1 2.1 2.1v5.2a2.1 2.1 0 0 1-2.1 2.1H9l-3.8 2.6v-2.6H6.5a2.1 2.1 0 0 1-2.1-2.1V6.1Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (name === "collapse") {
    return (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path
          d="M13 4.5 7.5 10 13 15.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (name === "delete") {
    return (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path
          d="M6.3 6.3 13.7 13.7M13.7 6.3l-7.4 7.4"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (name === "close") {
    return (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path
          d="M6 6 14 14M14 6l-8 8"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return null;
}

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
  if (!latest) {
    return conversation.mode === COMPUTER_MODE
      ? "Ready for browser control."
      : "Ready for a new chat.";
  }

  return latest
    .replace(/```[\s\S]*?```/g, "[code]")
    .replace(/\s+/g, " ")
    .slice(0, 88);
}

function getHistoryLabel(timestamp) {
  const updatedAt = new Date(Number(timestamp || 0));
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfToday.getDate() - 1);
  const startOfWeekWindow = new Date(startOfToday);
  startOfWeekWindow.setDate(startOfToday.getDate() - 7);

  if (updatedAt >= startOfToday) return "Today";
  if (updatedAt >= startOfYesterday) return "Yesterday";
  if (updatedAt >= startOfWeekWindow) return "Previous 7 Days";
  return "Older";
}

function getConversationBadge(conversation) {
  if (conversation.mode === COMPUTER_MODE) {
    return "O";
  }

  const title = String(conversation.title || "New chat").trim();
  return (title[0] || "C").toUpperCase();
}

function HistoryDialog({
  activeId,
  historyGroups,
  isOpen,
  onClose,
  onDeleteConversation,
  onSelectConversation,
}) {
  if (!isOpen) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      <button
        type="button"
        className="history-modal-backdrop"
        aria-label="Close history"
        onClick={onClose}
      />

      <div
        className="history-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-modal-title"
      >
        <div className="history-modal-header">
          <div className="history-modal-copy">
            <div className="history-modal-kicker">History</div>
            <h2 id="history-modal-title">Recent chats</h2>
            <p>Pick up an earlier conversation from the center panel.</p>
          </div>

          <button
            type="button"
            className="history-modal-close"
            onClick={onClose}
            aria-label="Close history"
          >
            <SidebarGlyph name="close" />
          </button>
        </div>

        <div className="history-modal-body">
          {historyGroups.length === 0 ? (
            <div className="sidebar-empty-state">
              No recent chats yet. Your completed conversations will show up
              here.
            </div>
          ) : (
            <div className="sidebar-history-groups">
              {historyGroups.map(([label, items]) => (
                <div key={label} className="history-group">
                  <div className="history-group-label">{label}</div>
                  <div className="history-group-items">
                    {items.map((conversation) => (
                      <div
                        key={conversation.id}
                        className={`history-item ${conversation.id === activeId ? "is-active" : ""}`}
                      >
                        <button
                          type="button"
                          className="history-item-select"
                          title={conversation.title || "New chat"}
                          onClick={() => {
                            onSelectConversation(conversation.id);
                            onClose();
                          }}
                        >
                          <span
                            className={`history-item-avatar ${conversation.mode === REGULAR_MODE ? "is-regular" : "is-computer"}`}
                            aria-hidden="true"
                          >
                            {getConversationBadge(conversation)}
                          </span>

                          <span className="history-item-main">
                            <span className="history-item-title">
                              {conversation.title || "New chat"}
                            </span>
                            <span className="history-item-preview">
                              {getPreviewText(conversation)}
                            </span>
                          </span>

                          <span className="history-item-meta">
                            <span className="history-item-time">
                              {formatRelativeTime(conversation.updatedAt)}
                            </span>
                            <span
                              className={`history-item-mode ${conversation.mode === REGULAR_MODE ? "is-regular" : "is-computer"}`}
                            >
                              {conversation.mode === REGULAR_MODE
                                ? "Chat"
                                : "PC"}
                            </span>
                          </span>
                        </button>

                        <button
                          type="button"
                          className="history-item-delete"
                          aria-label={`Delete ${conversation.title || "chat"}`}
                          title={`Delete ${conversation.title || "chat"}`}
                          onClick={() => onDeleteConversation(conversation.id)}
                        >
                          <SidebarGlyph name="delete" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}

function Sidebar({
  mode,
  conversations,
  activeId,
  isMobile = false,
  isVisible = true,
  onToggleSidebar,
  onOpenRegularMode,
  onOpenComputerMode,
  onSelectConversation,
  onDeleteConversation,
}) {
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const isCollapsed = !isMobile && !isVisible;
  const historyGroups = useMemo(() => {
    const groups = {
      Today: [],
      Yesterday: [],
      "Previous 7 Days": [],
      Older: [],
    };

    conversations
      .filter((conversation) =>
        (conversation.messages || []).some((message) =>
          String(message?.content || "").trim(),
        ),
      )
      .forEach((conversation) => {
        const label = getHistoryLabel(conversation.updatedAt);
        groups[label].push(conversation);
      });

    return Object.entries(groups).filter(([, items]) => items.length > 0);
  }, [conversations]);

  useEffect(() => {
    if (!isHistoryDialogOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsHistoryDialogOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isHistoryDialogOpen]);

  return (
    <aside
      className={`sidebar ${isMobile ? "is-mobile" : "is-desktop"} ${isVisible ? "is-visible" : ""} ${isCollapsed ? "is-collapsed" : ""}`}
    >
      <div className="sidebar-panel">
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <BrandMark className="sidebar-brand-mark" />
            <div className="sidebar-brand-copy">
              <div className="sidebar-brand-title">Operator AI</div>
              <div className="sidebar-brand-subtitle">
                Private workspace assistant
              </div>
            </div>
          </div>

          <button
            type="button"
            className="sidebar-toggle-btn"
            onClick={onToggleSidebar}
            aria-label={
              isMobile
                ? "Close sidebar"
                : isCollapsed
                  ? "Expand sidebar"
                  : "Collapse sidebar"
            }
            title={
              isMobile
                ? "Close sidebar"
                : isCollapsed
                  ? "Expand sidebar"
                  : "Collapse sidebar"
            }
          >
            <SidebarGlyph name="collapse" />
          </button>
        </div>

        <div className="sidebar-action-stack">
          <button
            type="button"
            className="sidebar-action-btn is-primary"
            onClick={() => {
              setIsHistoryDialogOpen(false);
              onOpenRegularMode();
            }}
            title="New Chat"
          >
            <span className="sidebar-action-icon">
              <SidebarGlyph name="plus" />
            </span>
            <span className="sidebar-action-copy">
              <strong>New Chat</strong>
              <small>Start a fresh conversation</small>
            </span>
          </button>

          <button
            type="button"
            className={`sidebar-action-btn ${isHistoryDialogOpen ? "is-selected" : ""}`}
            onClick={() => {
              setIsHistoryDialogOpen(true);
              if (isMobile && isVisible) {
                onToggleSidebar?.();
              }
            }}
            title="History"
          >
            <span className="sidebar-action-icon">
              <SidebarGlyph name="history" />
            </span>
            <span className="sidebar-action-copy">
              <strong>History</strong>
              <small>Open your recent chats</small>
            </span>
          </button>

          <button
            type="button"
            className={`sidebar-action-btn ${mode === REGULAR_MODE ? "is-selected" : ""}`}
            onClick={() => {
              setIsHistoryDialogOpen(false);
              onOpenRegularMode();
            }}
            title="Chat Mode"
          >
            <span className="sidebar-action-icon">
              <SidebarGlyph name="chat" />
            </span>
            <span className="sidebar-action-copy">
              <strong>Chat Mode</strong>
              <small>Regular AI chat</small>
            </span>
          </button>

          <button
            type="button"
            className={`sidebar-action-btn ${mode === COMPUTER_MODE ? "is-selected" : ""}`}
            onClick={() => {
              setIsHistoryDialogOpen(false);
              onOpenComputerMode();
            }}
            title="Computer Control"
          >
            <span className="sidebar-action-icon">
              <SidebarGlyph name="computer" />
            </span>
            <span className="sidebar-action-copy">
              <strong>Computer Control</strong>
              <small>Recommended through the Conductor Chrome extension</small>
            </span>
          </button>
        </div>
      </div>

      <HistoryDialog
        activeId={activeId}
        historyGroups={historyGroups}
        isOpen={isHistoryDialogOpen}
        onClose={() => setIsHistoryDialogOpen(false)}
        onDeleteConversation={onDeleteConversation}
        onSelectConversation={onSelectConversation}
      />
    </aside>
  );
}

export default Sidebar;
