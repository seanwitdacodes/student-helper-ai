import { useEffect, useRef, useState } from "react";

function ChatInput({ mode, centered = false, onSend, onSendImage }) {
  const [text, setText] = useState("");
  const [image, setImage] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "0px";
    element.style.height = `${Math.min(element.scrollHeight, centered ? 196 : 240)}px`;
  }, [centered, text]);

  const send = () => {
    if (!text.trim() && !image) return;

    if (image) {
      onSendImage(text, image);
      setImage(null);
    } else {
      onSend(text);
    }

    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = centered ? "132px" : "120px";
    }
  };

  return (
    <div
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
        const file = [...(event.dataTransfer?.files || [])].find((item) => item.type.startsWith("image/"));
        if (file) {
          setImage(file);
        }
      }}
    >
      <div className={`chat-input ${centered ? "is-minimal" : ""}`}>
        <div className="input-main">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={
              image
                ? "Ask about the image..."
                : mode === "Math"
                ? "Snap or upload a problem, then ask..."
                : mode === "Control"
                ? "Tell Helper AI what to do on your computer..."
                : mode === "Tutor"
                ? "Paste notes, ask why, or request a step-by-step lesson..."
                : mode === "Research"
                ? "Ask for a comparison, report, or structured findings..."
                : mode === "Automation"
                ? "Describe the workflow, recurrence, or task flow you want..."
                : "Ask a question, describe a feature, or paste notes..."
            }
            onPaste={(event) => {
              const file = [...(event.clipboardData?.files || [])].find((item) => item.type.startsWith("image/"));
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
          />

          {image && (
            <div className="image-preview composer-image-pill">
              <div className="image-meta">
                <span>{image.name || "Image selected"}</span>
                <button type="button" className="clear-image" onClick={() => setImage(null)}>
                  Remove
                </button>
              </div>
            </div>
          )}

          <div className={`input-toolbar ${centered ? "is-minimal" : ""}`}>
            <div className="composer-attachments">
              <button
                type="button"
                className="composer-attach-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Upload image"
                aria-label="Upload image"
              >
                +
              </button>
              {!centered && (
                <>
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
                  <span className="composer-enter-hint">Enter to send</span>
                </>
              )}
            </div>

            <div className="input-submit-group">
              <button
                type="button"
                className="send-btn send-arrow-btn"
                onClick={send}
                disabled={!text.trim() && !image}
              >
                Send
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
    </div>
  );
}

export default ChatInput;
