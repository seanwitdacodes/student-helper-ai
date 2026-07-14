function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function isVisible(element) {
  if (!(element instanceof Element)) return false;
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    rect.width > 0 &&
    rect.height > 0
  );
}

function getElementText(element) {
  return String(element?.innerText || element?.textContent || "")
    .replace(/\s+/g, " ")
    .trim();
}

function getAssociatedLabel(element) {
  if (!(element instanceof Element)) return "";

  const aria = element.getAttribute("aria-label");
  if (aria) return aria.trim();

  const placeholder = element.getAttribute("placeholder");
  if (placeholder) return placeholder.trim();

  const name = element.getAttribute("name");
  if (name) return name.trim();

  const id = element.getAttribute("id");
  if (id) {
    const externalLabel = document.querySelector(`label[for="${CSS.escape(id)}"]`);
    if (externalLabel) {
      return getElementText(externalLabel);
    }
  }

  const parentLabel = element.closest("label");
  return parentLabel ? getElementText(parentLabel) : "";
}

function scoreElement(element, query) {
  const needle = normalizeText(query);
  const candidates = [
    getElementText(element),
    getAssociatedLabel(element),
    element.getAttribute("aria-label") || "",
    element.getAttribute("placeholder") || "",
    element.getAttribute("name") || "",
    element.getAttribute("id") || "",
    element.getAttribute("href") || "",
  ]
    .map(normalizeText)
    .filter(Boolean);

  let score = 0;
  for (const value of candidates) {
    if (value === needle) score += 20;
    if (value.includes(needle)) score += 10;
    if (needle.includes(value) && value.length > 2) score += 4;
  }

  if (element.tagName.toLowerCase() === "button") score += 2;
  if ((element.getAttribute("role") || "").toLowerCase() === "button") score += 1;
  return score;
}

function findBestElement(selector, query) {
  return [...document.querySelectorAll(selector)]
    .filter(isVisible)
    .map((element) => ({ element, score: scoreElement(element, query) }))
    .sort((left, right) => right.score - left.score)
    .find((item) => item.score > 0)?.element || null;
}

function createResult(message, extra = {}) {
  return {
    ok: true,
    message,
    title: document.title,
    url: location.href,
    ...extra,
  };
}

function createError(message) {
  return {
    ok: false,
    error: message,
    title: document.title,
    url: location.href,
  };
}

function summarizePage() {
  const headline = [...document.querySelectorAll("h1, h2")]
    .find((element) => isVisible(element) && getElementText(element));
  const details = [...document.querySelectorAll("p, li")]
    .filter((element) => isVisible(element) && getElementText(element).length > 40)
    .map((element) => getElementText(element))
    .slice(0, 4);

  const parts = [];
  if (headline) {
    parts.push(`Headline: ${getElementText(headline)}`);
  }
  details.forEach((text, index) => {
    parts.push(`Point ${index + 1}: ${text}`);
  });

  return parts.join("\n") || "The page did not have enough visible text to summarize.";
}

function findContactLink() {
  const keywords = ["contact", "support", "help", "about"];
  for (const keyword of keywords) {
    const match = findBestElement("a[href], button, [role='button']", keyword);
    if (match) {
      return match;
    }
  }
  return null;
}

function findSearchField() {
  const selectors = [
    'input[type="search"]',
    'input[name*="search" i]',
    'input[placeholder*="search" i]',
    'input[aria-label*="search" i]',
    'input[name="q"]',
  ];

  return selectors
    .map((selector) => document.querySelector(selector))
    .find((element) => element && isVisible(element));
}

function fillField(fieldName, value) {
  const field = findBestElement("input, textarea, select", fieldName);
  if (!field) {
    throw new Error(`I could not find a field for "${fieldName}".`);
  }

  if ((field.getAttribute("type") || "").toLowerCase() === "password") {
    throw new Error("I do not enter passwords.");
  }

  field.scrollIntoView({ behavior: "smooth", block: "center" });
  field.focus();
  field.value = value;
  field.dispatchEvent(new Event("input", { bubbles: true }));
  field.dispatchEvent(new Event("change", { bubbles: true }));
  return `Filled "${getAssociatedLabel(field) || field.name || field.id || fieldName}".`;
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request?.type !== "computer-control-action") {
    return false;
  }

  try {
    const step = request.step || {};

    if (step.action === "click") {
      const target = findBestElement(
        'button, a[href], [role="button"], input[type="button"], input[type="submit"]',
        step.target,
      );
      if (!target) {
        throw new Error(`I could not find anything to click for "${step.target}".`);
      }
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.click();
      sendResponse(createResult(`Clicked "${getElementText(target) || getAssociatedLabel(target) || step.target}".`));
      return true;
    }

    if (step.action === "fill") {
      sendResponse(createResult(fillField(step.field, step.value)));
      return true;
    }

    if (step.action === "scroll") {
      const offset = step.direction === "up" ? -window.innerHeight * 0.85 : window.innerHeight * 0.85;
      window.scrollBy({ top: offset, behavior: "smooth" });
      sendResponse(createResult(`Scrolled ${step.direction === "up" ? "up" : "down"}.`));
      return true;
    }

    if (step.action === "summarize") {
      sendResponse(createResult(summarizePage()));
      return true;
    }

    if (step.action === "search-page") {
      const query = normalizeText(step.query);
      const matches = [...document.querySelectorAll("main, article, section, p, li, h1, h2, h3")]
        .filter(isVisible)
        .map((element) => getElementText(element))
        .filter(Boolean)
        .filter((text) => normalizeText(text).includes(query))
        .slice(0, 6);

      sendResponse(
        createResult(
          matches.length
            ? `Found ${matches.length} match${matches.length === 1 ? "" : "es"} for "${step.query}".\n\n${matches.map((text) => `- ${text}`).join("\n")}`
            : `No visible matches found for "${step.query}".`,
        ),
      );
      return true;
    }

    if (step.action === "find-contact") {
      const target = findContactLink();
      if (!target) {
        throw new Error("I could not find a visible contact or support link.");
      }
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      sendResponse(createResult(`Found "${getElementText(target) || getAssociatedLabel(target) || "contact"}".`));
      return true;
    }

    if (step.action === "copy-headline") {
      const headline = [...document.querySelectorAll("h1, h2")]
        .find((element) => isVisible(element) && getElementText(element));
      if (!headline) {
        throw new Error("I could not find a visible headline on this page.");
      }
      const text = getElementText(headline);
      navigator.clipboard.writeText(text).catch(() => undefined);
      sendResponse(createResult(`Copied headline: ${text}`));
      return true;
    }

    if (step.action === "site-search") {
      const field = findSearchField();
      if (!field) {
        throw new Error("I could not find a visible search field on this page.");
      }
      field.scrollIntoView({ behavior: "smooth", block: "center" });
      field.focus();
      field.value = step.query;
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
      const form = field.closest("form");
      if (form && typeof form.requestSubmit === "function") {
        form.requestSubmit();
      } else {
        field.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
        field.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", bubbles: true }));
      }
      sendResponse(createResult(`Searched the current site for "${step.query}".`));
      return true;
    }

    sendResponse(createError("Unsupported browser action."));
  } catch (error) {
    sendResponse(createError(error?.message || "The page action failed."));
  }

  return true;
});
