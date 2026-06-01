import { Fragment, memo, useMemo, useState } from "react";
import Prism from "prismjs";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-css";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-json";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-python";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-typescript";

function renderInline(text) {
  const source = String(text || "");
  const tokens = [];
  const pattern = /(`[^`]+`)|(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))|(https?:\/\/[^\s]+)/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(source))) {
    if (match.index > lastIndex) {
      tokens.push(source.slice(lastIndex, match.index));
    }

    if (match[1]) {
      tokens.push(
        <code key={`${match.index}-code`} className="message-inline-code">
          {match[1].slice(1, -1)}
        </code>,
      );
    } else if (match[2]) {
      tokens.push(
        <a
          key={`${match.index}-link`}
          className="message-link"
          href={match[4]}
          target="_blank"
          rel="noreferrer"
        >
          {match[3]}
        </a>,
      );
    } else if (match[5]) {
      tokens.push(
        <a
          key={`${match.index}-url`}
          className="message-link"
          href={match[5]}
          target="_blank"
          rel="noreferrer"
        >
          {match[5]}
        </a>,
      );
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < source.length) {
    tokens.push(source.slice(lastIndex));
  }

  return tokens.length ? tokens.map((token, index) => <Fragment key={index}>{token}</Fragment>) : source;
}

function parseMessageBlocks(content) {
  const lines = String(content || "").replace(/\r/g, "").split("\n");
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.trimStart().startsWith("```")) {
      const language = line.trim().slice(3).trim() || "text";
      const codeLines = [];
      index += 1;

      while (index < lines.length && !lines[index].trimStart().startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }

      if (index < lines.length) {
        index += 1;
      }

      blocks.push({
        type: "code",
        language,
        value: codeLines.join("\n"),
      });
      continue;
    }

    if (/^#{1,6}\s+/.test(line)) {
      const [, hashes, text] = line.match(/^(#{1,6})\s+(.*)$/) || [];
      blocks.push({
        type: "heading",
        level: Math.min(4, hashes?.length || 1),
        text,
      });
      index += 1;
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const quoteLines = [];

      while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^\s*>\s?/, ""));
        index += 1;
      }

      blocks.push({
        type: "quote",
        value: quoteLines.join(" "),
      });
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];

      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*[-*]\s+/, ""));
        index += 1;
      }

      blocks.push({
        type: "unordered-list",
        items,
      });
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];

      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*\d+\.\s+/, ""));
        index += 1;
      }

      blocks.push({
        type: "ordered-list",
        items,
      });
      continue;
    }

    const paragraphLines = [];

    while (
      index < lines.length &&
      lines[index].trim() &&
      !lines[index].trimStart().startsWith("```") &&
      !/^#{1,6}\s+/.test(lines[index]) &&
      !/^\s*>\s?/.test(lines[index]) &&
      !/^\s*[-*]\s+/.test(lines[index]) &&
      !/^\s*\d+\.\s+/.test(lines[index])
    ) {
      paragraphLines.push(lines[index]);
      index += 1;
    }

    blocks.push({
      type: "paragraph",
      value: paragraphLines.join(" "),
    });
  }

  return blocks;
}

function normalizeLanguage(language) {
  const value = String(language || "text").toLowerCase();

  if (value === "js") return "javascript";
  if (value === "ts") return "typescript";
  if (value === "sh" || value === "shell" || value === "zsh") return "bash";
  if (value === "html") return "markup";
  if (value === "md") return "markdown";
  return value;
}

function CodeBlock({ language, value }) {
  const [copied, setCopied] = useState(false);
  const normalizedLanguage = normalizeLanguage(language);
  const highlighted = useMemo(() => {
    const grammar = Prism.languages[normalizedLanguage] || Prism.languages.markup || Prism.languages.clike;
    return Prism.highlight(value, grammar, normalizedLanguage);
  }, [normalizedLanguage, value]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="message-code-block">
      <div className="code-block-header">
        <span className="code-block-language">{normalizedLanguage}</span>
        <button type="button" className="code-block-copy" onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre>
        <code dangerouslySetInnerHTML={{ __html: highlighted }} />
      </pre>
    </div>
  );
}

const Message = memo(function Message({ role, content, isStreaming = false }) {
  const blocks = useMemo(() => (isStreaming ? [] : parseMessageBlocks(content)), [content, isStreaming]);
  const [copied, setCopied] = useState(false);
  const isAssistant = role === "assistant";
  const author = isAssistant ? "Operator" : "You";

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(String(content || ""));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <article className={`message ${role} ${isStreaming ? "streaming" : ""}`}>
      <div className="message-row">
        {isAssistant && (
          <div className="message-avatar" aria-hidden="true">
            OP
          </div>
        )}

        <div className="message-stack">
          <div className="message-meta">
            <span className="message-author">{author}</span>
            <div className="message-toolbar">
              <button type="button" className="message-copy-btn" onClick={copyMessage}>
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>

          <div className="message-surface">
            <div className="message-content">
              {isStreaming ? (
                <p className="message-block message-paragraph message-streaming-text">
                  {String(content || "Thinking...")}
                </p>
              ) : (
                blocks.map((block, index) => {
                  if (block.type === "heading") {
                    const Tag = `h${block.level}`;
                    return (
                      <Tag key={index} className={`message-block message-heading-h${block.level}`}>
                        {renderInline(block.text)}
                      </Tag>
                    );
                  }

                  if (block.type === "quote") {
                    return (
                      <blockquote key={index} className="message-block message-quote">
                        {renderInline(block.value)}
                      </blockquote>
                    );
                  }

                  if (block.type === "unordered-list") {
                    return (
                      <ul key={index} className="message-block message-list">
                        {block.items.map((item, itemIndex) => (
                          <li key={itemIndex}>{renderInline(item)}</li>
                        ))}
                      </ul>
                    );
                  }

                  if (block.type === "ordered-list") {
                    return (
                      <ol key={index} className="message-block message-list message-list-ordered">
                        {block.items.map((item, itemIndex) => (
                          <li key={itemIndex}>{renderInline(item)}</li>
                        ))}
                      </ol>
                    );
                  }

                  if (block.type === "code") {
                    return <CodeBlock key={index} language={block.language} value={block.value} />;
                  }

                  return (
                    <p key={index} className="message-block message-paragraph">
                      {renderInline(block.value)}
                    </p>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
});

export default Message;
