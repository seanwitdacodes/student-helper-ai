import { useRef, useState } from "react";

function ChatInput({ onSend, onSendImage }) {
  const [text, setText] = useState("");
  const [image, setImage] = useState(null);
  const fileInputRef = useRef(null);

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
      {/* PLUS BUTTON */}
      <button
        className="upload-btn"
        onClick={() => fileInputRef.current.click()}
        title="Upload image"
      >
        +
      </button>

      {/* HIDDEN FILE INPUT */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => setImage(e.target.files[0])}
      />

      {/* TEXT INPUT */}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={
          image ? "Ask about the uploaded image…" : "Type your question…"
        }
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
          }
        }}
      />

      {/* SEND BUTTON */}
      <button className="send-btn" onClick={send}>
        Send
      </button>
    </div>
  );
}

export default ChatInput;
