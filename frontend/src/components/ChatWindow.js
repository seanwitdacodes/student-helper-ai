import { useEffect, useMemo, useRef } from "react";
import Message from "./Message";

const LEGACY_WELCOME_MESSAGES = new Set([
  "Math Mode is ready. Upload a problem or type one to get a step-by-step solution.",
  "Tutor Mode is ready. Ask anything and I’ll explain it step by step.",
  "Answer Mode is ready. Ask a question for a direct response.",
  "Control Computer Mode is ready.",
  "Computer Control is ready.",
]);

function ChatWindow({ messages }) {
  const viewportRef = useRef(null);
  const bottomAnchorRef = useRef(null);
  const shouldStickToBottomRef = useRef(true);

  const visibleMessages = useMemo(
    () =>
      messages.filter(
        (message, index) =>
          !(
            index === 0 &&
            message.role === "assistant" &&
            LEGACY_WELCOME_MESSAGES.has(String(message.content || ""))
          ),
      ),
    [messages],
  );
  const showWelcome = visibleMessages.length === 0;

  useEffect(() => {
    if (showWelcome) return;
    if (
      !shouldStickToBottomRef.current &&
      !visibleMessages[visibleMessages.length - 1]?.isStreaming
    )
      return;
    bottomAnchorRef.current?.scrollIntoView({ block: "end" });
  }, [showWelcome, visibleMessages]);

  return (
    <div className={`chat-window ${showWelcome ? "is-empty" : ""}`}>
      <div
        ref={viewportRef}
        className="thread-viewport"
        onScroll={(event) => {
          const element = event.currentTarget;
          const distanceFromBottom =
            element.scrollHeight - element.scrollTop - element.clientHeight;
          shouldStickToBottomRef.current = distanceFromBottom < 96;
        }}
      >
        {showWelcome && <div className="thread-empty-state" />}

        {!showWelcome && (
          <div className="thread-stack">
            {visibleMessages.map((message, index) => (
              <Message
                key={message.id || `${message.role}-${index}`}
                role={message.role}
                content={message.content}
                isStreaming={Boolean(message.isStreaming)}
              />
            ))}
            <div
              ref={bottomAnchorRef}
              className="thread-bottom-anchor"
              aria-hidden="true"
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default ChatWindow;
