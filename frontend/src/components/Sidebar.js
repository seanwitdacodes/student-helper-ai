function Sidebar({
  mode,
  setMode,
  conversations,
  activeId,
  onSelectConversation,
  onNewConversation,
  onOpenTool,
  onDeleteConversation,
}) {
  const modes = ["Answer", "Tutor", "Math"];

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div>
          <div className="brand-label">Student Helper</div>
          <h2>Study Studio</h2>
        </div>
        <button className="new-chat-btn" onClick={onNewConversation}>
          New Chat
        </button>
      </div>

      <div className="section-label">Modes</div>
      <div className="mode-list">
        {modes.map((m) => (
          <button
            key={m}
            className={mode === m ? "active" : ""}
            onClick={() => {
              setMode(m);
            }}
          >
            {m} Mode
          </button>
        ))}
      </div>

      <div className="section-label">Recent Chats</div>
      <div className="chat-list">
        {conversations.map((c) => (
          <button
            key={c.id}
            className={`chat-item ${c.id === activeId ? "active" : ""}`}
            onClick={() => onSelectConversation(c.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              if (window.confirm(`Delete "${c.title || "New Chat"}"?`)) {
                onDeleteConversation(c.id);
              }
            }}
          >
            <div className="chat-title">{c.title || "New Chat"}</div>
            <div className="chat-preview">
              {(c.messages?.[c.messages.length - 1]?.content || "")
                .slice(0, 60)
                .replace(/\s+/g, " ")}
            </div>
          </button>
        ))}
      </div>

      <div className="section-label">Tools</div>
      <div className="tool-list">
        <button onClick={() => onOpenTool("flashcards")}>Flashcards</button>
        <button onClick={() => onOpenTool("slides")}>Slides</button>
      </div>
    </div>
  );
}

export default Sidebar;
