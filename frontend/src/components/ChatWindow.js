import Message from "./Message";

function ChatWindow({ messages }) {
  return (
    <div className="chat-window">
      {messages.map((m, i) => (
        <Message key={i} role={m.role} content={m.content} />
      ))}
    </div>
  );
}

export default ChatWindow;
