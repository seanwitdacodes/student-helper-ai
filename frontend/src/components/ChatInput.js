import { useRef, useState } from "react";

function ChatInput({ mode, assistant, contextStats, onAssistantChange, onSend, onSendImage }) {
  const [text, setText] = useState("");
  const [image, setImage] = useState(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const send = () => {
    if (!text.trim() && !image) return;

    if (image) {
      onSendImage(text, image);
      setImage(null);
    } else {
      onSend(text);
    }

    setText("");
  };

  return (
    <div className="chat-input-shell">
      <div className="chat-input">
        <div className="input-main">
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={
              image
                ? "Ask about the image..."
                : mode === "Math"
                ? "Snap or upload a problem, then ask..."
                : mode === "Tutor"
                ? "Paste notes, ask why, or request a step-by-step lesson..."
                : mode === "Research"
                ? "Ask for a comparison, report, or structured findings..."
                : mode === "Automation"
                ? "Describe the workflow, recurrence, or task flow you want..."
                : "Ask a question, describe a feature, or paste notes..."
            }
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send();
              }
            }}
          />

          {image && (
            <div className="image-preview">
              <div className="image-meta">
                <span>{image.name || "Image selected"}</span>
                <button type="button" className="clear-image" onClick={() => setImage(null)}>
                  Remove
                </button>
              </div>
            </div>
          )}

          <div className="input-toolbar">
            <div className="input-actions">
              <button
                type="button"
                className="composer-icon-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Upload image"
              >
                +
              </button>
              <button
                type="button"
                className="upload-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Upload image"
              >
                Upload
              </button>
              <button
                type="button"
                className="upload-btn camera-btn"
                onClick={() => cameraInputRef.current?.click()}
                title="Use camera"
              >
                Camera
              </button>
              <select
                className="composer-select"
                value={assistant?.model || "max"}
                onChange={(event) => onAssistantChange?.({ model: event.target.value })}
              >
                <option value="max">Local Max</option>
                <option value="fast">Local Fast</option>
                <option value="builder">Builder</option>
              </select>
              <select
                className="composer-select"
                value={assistant?.reasoning || "deep"}
                onChange={(event) => onAssistantChange?.({ reasoning: event.target.value })}
              >
                <option value="fast">Fast</option>
                <option value="balanced">Balanced</option>
                <option value="deep">Deep</option>
              </select>
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

            <div className="input-submit-group">
              <span className="input-context-pill">
                {contextStats?.used || 0}/{contextStats?.budget || 0}
              </span>
              <button type="button" className="send-btn send-arrow-btn" onClick={send}>
                ->
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChatInput;
