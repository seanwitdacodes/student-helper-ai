import { useRef, useState } from "react";

function ChatInput({ mode, onSend, onSendImage }) {
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
    <div className="chat-input">
      <div className="input-actions">
        <button
          className="upload-btn"
          onClick={() => fileInputRef.current.click()}
          title="Upload image"
        >
          Upload
        </button>
        <button
          className="upload-btn camera-btn"
          onClick={() => cameraInputRef.current.click()}
          title="Use camera"
        >
          Camera
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => setImage(e.target.files[0])}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: "none" }}
          onChange={(e) => setImage(e.target.files[0])}
        />
      </div>

      <div className="input-main">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            image
              ? "Ask about the image…"
              : mode === "Math"
              ? "Snap or upload a problem, then ask…"
              : "Type your question…"
          }
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        {image && (
          <div className="image-preview">
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
      </div>

      {/* SEND BUTTON */}
      <button className="send-btn" onClick={send}>
        Send
      </button>
    </div>
  );
}

export default ChatInput;
