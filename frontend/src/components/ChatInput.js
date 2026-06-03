import { useEffect, useRef, useState } from "react";

const MODE_OPTIONS = [
  { value: "regular", label: "Search" },
  { value: "computer", label: "Computer Mode" },
];

const MODEL_OPTIONS = ["Balanced", "Fast", "Deep"];

function ChevronIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="m6 8 4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlusIcon() {
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

function MicIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M10 3.8a2.6 2.6 0 0 1 2.6 2.6v3.8a2.6 2.6 0 1 1-5.2 0V6.4A2.6 2.6 0 0 1 10 3.8Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M5.8 9.8a4.2 4.2 0 0 0 8.4 0M10 14v2.2M7.8 16.2h4.4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="m4 10 11.5-5-3.6 5 3.6 5L4 10Zm0 0h7.8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChatInput({
  mode,
  centered = false,
  onSend,
  onSendImage,
  onSwitchMode,
  seedText = "",
  seedVersion = 0,
  onDraftChange,
}) {
  const [text, setText] = useState("");
  const [image, setImage] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [selectedModel, setSelectedModel] = useState("Balanced");
  const shellRef = useRef(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "0px";
    const maxHeight = centered ? 160 : 220;
    element.style.height = `${Math.min(element.scrollHeight, maxHeight)}px`;
  }, [centered, text]);

  useEffect(() => {
    setText(seedText || "");
    if (seedText && textareaRef.current) {
      textareaRef.current.focus();
      const nextPosition = seedText.length;
      textareaRef.current.setSelectionRange(nextPosition, nextPosition);
    }
  }, [seedText, seedVersion]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!shellRef.current?.contains(event.target)) {
        setShowModeMenu(false);
        setShowModelMenu(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const updateText = (nextValue) => {
    setText(nextValue);
    onDraftChange?.(nextValue);
  };

  const send = () => {
    if (!text.trim() && !image) return;

    if (image) {
      onSendImage(text, image);
      setImage(null);
    } else {
      onSend(text);
    }

    updateText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = centered ? "48px" : "54px";
    }
  };

  const placeholder = image
    ? "Ask about the image..."
    : centered
      ? "Type @ for connectors and sources"
      : mode === "computer"
      ? "Tell Operator AI what to do on your computer..."
      : "Ask Operator AI anything...";

  const activeModeLabel =
    MODE_OPTIONS.find((item) => item.value === mode)?.label || "Search";

  return (
    <div
      ref={shellRef}
      className={`chat-input-shell ${centered ? "is-centered" : ""} ${isDragging ? "is-dragging" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsDragging(false);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        const file = [...(event.dataTransfer?.files || [])].find((item) =>
          item.type.startsWith("image/"),
        );
        if (file) {
          setImage(file);
        }
      }}
    >
      <div className={`chat-input ${centered ? "is-centered" : ""}`}>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(event) => updateText(event.target.value)}
          placeholder={placeholder}
          onPaste={(event) => {
            const file = [...(event.clipboardData?.files || [])].find((item) =>
              item.type.startsWith("image/"),
            );
            if (file) {
              event.preventDefault();
              setImage(file);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              send();
            }
          }}
          aria-label="Message input"
        />

        {image && (
          <div className="composer-image-pill">
            <div className="image-meta">
              <span>{image.name || "Image selected"}</span>
              <button
                type="button"
                className="clear-image"
                onClick={() => setImage(null)}
              >
                Remove
              </button>
            </div>
          </div>
        )}

        <div className="composer-toolbar">
          <div className="composer-left-controls">
            <button
              type="button"
              className="composer-icon-btn"
              onClick={() => fileInputRef.current?.click()}
              title="Upload image"
              aria-label="Upload image"
            >
              <PlusIcon />
            </button>

            <div className="composer-menu-wrap">
              <button
                type="button"
                className="composer-pill-btn"
                onClick={() => {
                  setShowModeMenu((current) => !current);
                  setShowModelMenu(false);
                }}
                aria-label="Choose mode"
              >
                <span>{activeModeLabel}</span>
                <ChevronIcon />
              </button>

              {showModeMenu && (
                <div className="composer-menu" role="menu">
                  {MODE_OPTIONS.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      className={`composer-menu-item ${mode === item.value ? "is-active" : ""}`}
                      onClick={() => {
                        onSwitchMode?.(item.value);
                        setShowModeMenu(false);
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="composer-right-controls">
            <div className="composer-menu-wrap">
              <button
                type="button"
                className="composer-text-btn"
                onClick={() => {
                  setShowModelMenu((current) => !current);
                  setShowModeMenu(false);
                }}
                aria-label="Choose model style"
              >
                <span>{selectedModel}</span>
                <ChevronIcon />
              </button>

              {showModelMenu && (
                <div className="composer-menu composer-menu-right" role="menu">
                  {MODEL_OPTIONS.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className={`composer-menu-item ${selectedModel === item ? "is-active" : ""}`}
                      onClick={() => {
                        setSelectedModel(item);
                        setShowModelMenu(false);
                      }}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              className="composer-icon-btn is-muted"
              aria-label="Microphone"
            >
              <MicIcon />
            </button>

            <button
              type="button"
              className="composer-send-btn"
              onClick={send}
              disabled={!text.trim() && !image}
              aria-label="Send message"
            >
              <SendIcon />
            </button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => setImage(event.target.files?.[0] || null)}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(event) => setImage(event.target.files?.[0] || null)}
        />
      </div>
    </div>
  );
}

export default ChatInput;
