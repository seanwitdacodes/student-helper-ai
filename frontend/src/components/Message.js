function Message({ role, content }) {
  return (
    <div className={`message ${role}`}>
      <pre>{content}</pre>
    </div>
  );
}

export default Message;
