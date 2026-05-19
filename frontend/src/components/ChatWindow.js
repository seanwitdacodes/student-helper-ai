import Message from "./Message";

const PROMPTS = {
  Answer: [
    "Summarize these notes in plain language.",
    "Give me the shortest correct answer, then one key insight.",
  ],
  Tutor: [
    "Teach me photosynthesis step by step.",
    "Explain this chemistry idea like I'm learning it for the first time.",
  ],
  Build: [
    "Turn the Claude Max feature list into a roadmap for Student Helper.",
    "Redesign this app so it feels like a polished desktop AI workspace.",
    "Map capabilities, prompt routing, and UI states for a Max-style assistant.",
  ],
  Research: [
    "Compare the feature gaps between this app and Claude Max.",
    "Draft a research memo on which capabilities are already live versus missing.",
  ],
  Automation: [
    "Design recurring workflows this AI should handle for students.",
    "Turn these product goals into automation-ready task flows.",
  ],
};

const LEGACY_WELCOME_MESSAGES = new Set([
  "Flashcards workspace ready. Generate a deck or build one from scratch.",
  "Slides workspace ready. Draft your deck, theme it, and present it.",
  "Math Mode is ready. Upload a problem or type one to get a step-by-step solution.",
  "Tutor Mode is ready. Ask anything and I’ll explain it step by step.",
  "Answer Mode is ready. Ask a question for a direct response.",
]);

function ChatWindow({
  messages,
  mode,
  projectName,
  assistant,
  contextStats,
  capabilities,
  onUsePrompt,
  onDismissIntegrationHint,
}) {
  const suggestions = PROMPTS[mode] || PROMPTS.Build;
  const hasUserMessages = messages.some((message) => message.role === "user");
  const visibleMessages = hasUserMessages
    ? messages.filter(
        (message, index) =>
          !(index === 0 && message.role === "assistant" && LEGACY_WELCOME_MESSAGES.has(String(message.content || ""))),
      )
    : [];

  return (
    <div className={`chat-window ${!hasUserMessages ? "is-empty" : ""}`}>
      {!hasUserMessages && (
        <div className="chat-welcome-shell">
          <div className="chat-welcome-hero">
            <div className="welcome-orb" aria-hidden="true">
              &lt;/&gt;
            </div>
            <h2>Let&apos;s build</h2>
            <div className="welcome-project">{projectName}</div>
            <p className="welcome-copy">
              Give your assistant deeper reasoning, cleaner desktop UI, multimodal uploads,
              research-style outputs, and richer workflow surfacing from one place.
            </p>
            <div className="welcome-pills">
              <span>{assistant?.model === "fast" ? "Local Fast" : assistant?.model === "builder" ? "Builder" : "Local Max"}</span>
              <span>{assistant?.reasoning || "deep"} reasoning</span>
              <span>
                {contextStats?.used || 0}/{contextStats?.budget || 0} tokens
              </span>
            </div>
          </div>

          {assistant?.showIntegrationHint && (
            <div className="plugin-banner">
              <div>
                <strong>Use a plugin-style workspace flow for this prompt</strong>
                <span>Surface integrations, automations, and coding tools directly inside the shell.</span>
              </div>
              <div className="plugin-banner-actions">
                <button type="button" className="quiet-btn">
                  Enabled
                </button>
                <button type="button" className="banner-close" onClick={onDismissIntegrationHint}>
                  x
                </button>
              </div>
            </div>
          )}

          <div className="capability-grid">
            {capabilities.map((capability) => (
              <div key={capability.title} className="capability-card">
                <div className="capability-title">{capability.title}</div>
                <p>{capability.detail}</p>
                <div className="capability-tags">
                  {capability.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="chat-welcome-card">
            <div className="tool-eyebrow">Try prompts like these</div>
            <div className="welcome-prompt-list">
              {suggestions.map((prompt) => (
                <button key={prompt} className="welcome-prompt" onClick={() => onUsePrompt?.(prompt)}>
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {visibleMessages.map((message, index) => (
        <Message
          key={message.id || `${message.role}-${index}`}
          role={message.role}
          content={message.content}
          isStreaming={Boolean(message.isStreaming)}
        />
      ))}
    </div>
  );
}

export default ChatWindow;
