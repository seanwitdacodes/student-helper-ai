import { useEffect, useMemo, useRef, useState } from "react";

function Slides({ state, onChange }) {
  const { notes, rawSlides, slides, activeIndex } = state;
  const update = (patch) => onChange({ ...state, ...patch });
  const canvasRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handler = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const generate = async () => {
    const res = await fetch("http://localhost:5050/slides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    const data = await res.json();
    const parsed = parseSlides(data.slides || "");
    if (parsed.length) {
      update({ rawSlides: data.slides || "", slides: parsed, activeIndex: 0 });
    } else {
      update({ rawSlides: data.slides || "" });
    }
  };

  const parseSlides = (text) => {
    const lines = text.split("\n");
    const parsed = [];
    let current = null;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const slideMatch = trimmed.match(/^slide\s*\d+\s*:\s*(.+)$/i);
      if (slideMatch) {
        if (current) parsed.push(current);
        current = { title: slideMatch[1], bullets: [] };
        continue;
      }
      if (trimmed.startsWith("-") || trimmed.startsWith("•")) {
        if (!current) current = { title: "Untitled", bullets: [] };
        current.bullets.push(trimmed.replace(/^[-•]\s*/, ""));
        continue;
      }
      if (current) {
        current.bullets.push(trimmed);
      }
    }

    if (current) parsed.push(current);
    return parsed;
  };

  const activeSlide = slides[activeIndex];

  const updateSlide = (changes) => {
    update({
      slides: slides.map((s, i) =>
        i === activeIndex ? { ...s, ...changes } : s,
      ),
    });
  };

  const slideTitles = useMemo(
    () => slides.map((s, i) => s.title || `Slide ${i + 1}`),
    [slides],
  );

  const toggleFullscreen = () => {
    if (!canvasRef.current) return;
    if (!document.fullscreenElement) {
      canvasRef.current.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  return (
    <div className="tool slides">
      <div className="tool-header">
        <div>
          <div className="tool-eyebrow">Slides</div>
          <h3>Google Slides-style Editor</h3>
        </div>
        <div className="slide-toolbar">
          <button
            onClick={() =>
              update({
                slides: [
                  ...slides,
                  { title: `Slide ${slides.length + 1}`, bullets: ["New point"] },
                ],
              })
            }
          >
            New Slide
          </button>
          <button
            onClick={() =>
              update({
                slides: [
                  ...slides.slice(0, activeIndex + 1),
                  { ...activeSlide },
                  ...slides.slice(activeIndex + 1),
                ],
              })
            }
          >
            Duplicate
          </button>
          <button
            onClick={() => {
              if (slides.length === 1) return;
              update({
                slides: slides.filter((_, i) => i !== activeIndex),
                activeIndex: Math.max(0, activeIndex - 1),
              });
            }}
          >
            Delete
          </button>
          <button onClick={toggleFullscreen}>
            {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          </button>
        </div>
      </div>

      <div className="tool-grid slides-grid">
        <div className="tool-panel">
          <textarea
            placeholder="Paste notes here..."
            value={notes}
            onChange={(e) => update({ notes: e.target.value })}
          />
          <button onClick={generate}>Generate Slides</button>
          {rawSlides && (
            <details className="raw-output">
              <summary>Raw AI output</summary>
              <pre>{rawSlides}</pre>
            </details>
          )}
        </div>

        <div className="slides-editor">
          <div className="slide-list">
            {slideTitles.map((title, i) => (
              <button
                key={`${title}-${i}`}
                className={i === activeIndex ? "active" : ""}
                onClick={() => update({ activeIndex: i })}
              >
                <div className="thumb-index">{i + 1}</div>
                <div className="thumb-title">{title}</div>
              </button>
            ))}
          </div>

          <div className="slide-canvas" ref={canvasRef}>
            <input
              className="slide-title"
              value={activeSlide?.title || ""}
              onChange={(e) => updateSlide({ title: e.target.value })}
            />
            <textarea
              className="slide-body"
              value={(activeSlide?.bullets || []).join("\n")}
              onChange={(e) =>
                updateSlide({
                  bullets: e.target.value
                    .split("\n")
                    .map((line) => line.trim())
                    .filter(Boolean),
                })
              }
              placeholder="Add bullet points here..."
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Slides;
