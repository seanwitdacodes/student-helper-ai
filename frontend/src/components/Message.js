import { memo, useMemo, useState } from "react";
import MarkdownIt from "markdown-it";
import Prism from "prismjs";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-css";
import "prismjs/components/prism-diff";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-json";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-python";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-yaml";

function normalizeLanguage(language) {
  const value = String(language || "text").toLowerCase();

  if (value === "js") return "javascript";
  if (value === "ts") return "typescript";
  if (value === "sh" || value === "shell" || value === "zsh") return "bash";
  if (value === "html") return "markup";
  if (value === "md") return "markdown";
  if (value === "yml") return "yaml";
  return value;
}

function addClassToToken(token, className) {
  const existing = token.attrGet("class");
  token.attrSet("class", existing ? `${existing} ${className}` : className);
}

function createMarkdownRenderer() {
  const md = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: true,
    breaks: false,
  });

  const defaultParagraphOpen =
    md.renderer.rules.paragraph_open ||
    ((tokens, idx, options, env, self) =>
      self.renderToken(tokens, idx, options));
  md.renderer.rules.paragraph_open = (tokens, idx, options, env, self) => {
    addClassToToken(tokens[idx], "message-block message-paragraph");
    return defaultParagraphOpen(tokens, idx, options, env, self);
  };

  const defaultBulletListOpen =
    md.renderer.rules.bullet_list_open ||
    ((tokens, idx, options, env, self) =>
      self.renderToken(tokens, idx, options));
  md.renderer.rules.bullet_list_open = (tokens, idx, options, env, self) => {
    addClassToToken(tokens[idx], "message-block message-list");
    return defaultBulletListOpen(tokens, idx, options, env, self);
  };

  const defaultOrderedListOpen =
    md.renderer.rules.ordered_list_open ||
    ((tokens, idx, options, env, self) =>
      self.renderToken(tokens, idx, options));
  md.renderer.rules.ordered_list_open = (tokens, idx, options, env, self) => {
    addClassToToken(tokens[idx], "message-block message-list message-list-ordered");
    return defaultOrderedListOpen(tokens, idx, options, env, self);
  };

  const defaultBlockquoteOpen =
    md.renderer.rules.blockquote_open ||
    ((tokens, idx, options, env, self) =>
      self.renderToken(tokens, idx, options));
  md.renderer.rules.blockquote_open = (tokens, idx, options, env, self) => {
    addClassToToken(tokens[idx], "message-block message-quote");
    return defaultBlockquoteOpen(tokens, idx, options, env, self);
  };

  const defaultHeadingOpen =
    md.renderer.rules.heading_open ||
    ((tokens, idx, options, env, self) =>
      self.renderToken(tokens, idx, options));
  md.renderer.rules.heading_open = (tokens, idx, options, env, self) => {
    const level = tokens[idx].tag;
    addClassToToken(tokens[idx], `message-block message-heading message-heading-${level}`);
    return defaultHeadingOpen(tokens, idx, options, env, self);
  };

  md.renderer.rules.hr = () => '<hr class="message-divider" />';

  const defaultLinkOpen =
    md.renderer.rules.link_open ||
    ((tokens, idx, options, env, self) =>
      self.renderToken(tokens, idx, options));
  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    addClassToToken(tokens[idx], "message-link");
    tokens[idx].attrSet("target", "_blank");
    tokens[idx].attrSet("rel", "noreferrer");
    return defaultLinkOpen(tokens, idx, options, env, self);
  };

  md.renderer.rules.table_open = () =>
    '<div class="message-table-wrap"><table class="message-table">';
  md.renderer.rules.table_close = () => "</table></div>";

  const defaultTheadOpen =
    md.renderer.rules.thead_open ||
    ((tokens, idx, options, env, self) =>
      self.renderToken(tokens, idx, options));
  md.renderer.rules.thead_open = (tokens, idx, options, env, self) => {
    addClassToToken(tokens[idx], "message-table-head");
    return defaultTheadOpen(tokens, idx, options, env, self);
  };

  const defaultThOpen =
    md.renderer.rules.th_open ||
    ((tokens, idx, options, env, self) =>
      self.renderToken(tokens, idx, options));
  md.renderer.rules.th_open = (tokens, idx, options, env, self) => {
    addClassToToken(tokens[idx], "message-table-cell");
    return defaultThOpen(tokens, idx, options, env, self);
  };

  const defaultTdOpen =
    md.renderer.rules.td_open ||
    ((tokens, idx, options, env, self) =>
      self.renderToken(tokens, idx, options));
  md.renderer.rules.td_open = (tokens, idx, options, env, self) => {
    addClassToToken(tokens[idx], "message-table-cell");
    return defaultTdOpen(tokens, idx, options, env, self);
  };

  md.renderer.rules.code_inline = (tokens, idx) =>
    `<code class="message-inline-code">${md.utils.escapeHtml(tokens[idx].content)}</code>`;

  md.renderer.rules.fence = (tokens, idx) => {
    const token = tokens[idx];
    const normalizedLanguage = normalizeLanguage(token.info.trim().split(/\s+/)[0]);
    const grammar =
      Prism.languages[normalizedLanguage] ||
      Prism.languages.markup ||
      Prism.languages.clike;
    const highlighted = token.content
      ? Prism.highlight(token.content, grammar, normalizedLanguage)
      : md.utils.escapeHtml(token.content);

    return `
      <div class="message-code-block">
        <div class="code-block-header">
          <span class="code-block-language">${md.utils.escapeHtml(normalizedLanguage)}</span>
          <button type="button" class="code-block-copy" data-copy-code>Copy</button>
        </div>
        <pre><code class="language-${md.utils.escapeHtml(normalizedLanguage)}">${highlighted}</code></pre>
      </div>
    `;
  };

  md.renderer.rules.code_block = (tokens, idx) =>
    md.renderer.rules.fence(tokens, idx);

  return md;
}

const markdownRenderer = createMarkdownRenderer();

function UserMessageContent({ content }) {
  const paragraphs = String(content || "")
    .replace(/\r/g, "")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    return (
      <p className="message-block message-paragraph message-plain">
        {String(content || "")}
      </p>
    );
  }

  return paragraphs.map((paragraph, index) => (
    <p key={index} className="message-block message-paragraph message-plain">
      {paragraph}
    </p>
  ));
}

function AssistantMessageContent({ content }) {
  const html = useMemo(
    () => markdownRenderer.render(String(content || "")),
    [content],
  );

  const handleClick = async (event) => {
    const copyTrigger = event.target.closest("[data-copy-code]");
    if (!copyTrigger) return;

    const code = copyTrigger
      .closest(".message-code-block")
      ?.querySelector("code")?.innerText;
    if (!code) return;

    const pendingTimer = Number(copyTrigger.dataset.copyTimer || 0);
    if (pendingTimer) {
      window.clearTimeout(pendingTimer);
    }

    try {
      await navigator.clipboard.writeText(code);
      copyTrigger.textContent = "Copied";
    } catch {
      copyTrigger.textContent = "Failed";
    }

    const resetTimer = window.setTimeout(() => {
      copyTrigger.textContent = "Copy";
      delete copyTrigger.dataset.copyTimer;
    }, 1200);

    copyTrigger.dataset.copyTimer = String(resetTimer);
  };

  return (
    <div
      className="message-markdown"
      onClick={handleClick}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

const Message = memo(function Message({ role, content, isStreaming = false }) {
  const [copied, setCopied] = useState(false);
  const isAssistant = role === "assistant";
  const author = isAssistant ? "Operator AI" : "You";

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
              <button
                type="button"
                className="message-copy-btn"
                onClick={copyMessage}
              >
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
              ) : isAssistant ? (
                <AssistantMessageContent content={content} />
              ) : (
                <UserMessageContent content={content} />
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
});

export default Message;
