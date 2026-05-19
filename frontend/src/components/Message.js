function renderLine(line, index) {
  if (/^\*\*.+\*\*$/.test(line)) {
    return (
      <div key={`${line}-${index}`} className="message-heading">
        {line.replace(/^\*\*|\*\*$/g, "")}
      </div>
    );
  }

  if (/^\d+\.\s+/.test(line)) {
    const [, number, text] = line.match(/^(\d+)\.\s+(.*)$/) || [];
    return (
      <div key={`${line}-${index}`} className="message-numbered">
        <span>{number}</span>
        <p>{text || "\u00A0"}</p>
      </div>
    );
  }

  if (line.startsWith("- ")) {
    return (
      <div key={`${line}-${index}`} className="message-bullet">
        {line.replace(/^- /, "")}
      </div>
    );
  }

  return <p key={`${line}-${index}`}>{line || "\u00A0"}</p>;
}

function Message({ role, content, isStreaming = false }) {
  const blocks = String(content || "")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line, index, items) => line || items[index - 1]);

  return (
    <div className={`message ${role} ${isStreaming ? "streaming" : ""}`}>
      <div className="message-content">{blocks.map((line, index) => renderLine(line, index))}</div>
    </div>
  );
}

export default Message;
