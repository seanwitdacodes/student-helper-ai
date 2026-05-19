import { useEffect, useMemo, useRef, useState } from "react";

const API_BASE = "http://localhost:5050";

const THEMES = {
  aurora: {
    label: "Aurora",
    surface: "linear-gradient(145deg, rgba(11, 17, 32, 0.95), rgba(21, 44, 68, 0.95))",
    accent: "#38bdf8",
    accentSoft: "rgba(56, 189, 248, 0.18)",
  },
  sunrise: {
    label: "Sunrise",
    surface: "linear-gradient(145deg, rgba(53, 26, 14, 0.96), rgba(96, 45, 16, 0.96))",
    accent: "#fb923c",
    accentSoft: "rgba(251, 146, 60, 0.2)",
  },
  graphite: {
    label: "Graphite",
    surface: "linear-gradient(145deg, rgba(17, 24, 39, 0.98), rgba(45, 55, 72, 0.98))",
    accent: "#e5e7eb",
    accentSoft: "rgba(229, 231, 235, 0.14)",
  },
  campus: {
    label: "Campus",
    surface: "linear-gradient(145deg, rgba(10, 37, 34, 0.96), rgba(18, 81, 69, 0.96))",
    accent: "#34d399",
    accentSoft: "rgba(52, 211, 153, 0.16)",
  },
};

function blankSlide(index) {
  return {
    title: `Slide ${index + 1}`,
    subtitle: "",
    bullets: ["Point one", "Point two", "Point three"],
    speakerNotes: "",
    layout: "title-bullets",
  };
}

function Slides({ state, onChange, plan = "free", onOpenBilling }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const canvasRef = useRef(null);
  const hasFullAccess = plan !== "free";
  const availableThemes = hasFullAccess
    ? Object.entries(THEMES)
    : Object.entries(THEMES).filter(([key]) => ["aurora", "sunrise"].includes(key));
  const maxSlideCount = hasFullAccess ? 12 : 6;
  const maxCanvasItems = hasFullAccess ? 12 : 3;

  const slides = useMemo(
    () =>
      Array.isArray(state.slides) && state.slides.length > 0
        ? state.slides
        : [blankSlide(0)],
    [state.slides],
  );
  const activeIndex = Math.min(Math.max(state.activeIndex || 0, 0), slides.length - 1);
  const activeSlide = slides[activeIndex];
  const resolvedThemeKey =
    !hasFullAccess && !availableThemes.some(([key]) => key === state.theme) ? "aurora" : state.theme;
  const theme = THEMES[resolvedThemeKey] || THEMES.aurora;

  useEffect(() => {
    const handleFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handleFullscreen);
    return () => document.removeEventListener("fullscreenchange", handleFullscreen);
  }, []);

  const outlineText = useMemo(
    () =>
      slides
        .map(
          (slide, index) =>
            `Slide ${index + 1}: ${slide.title}\n${slide.subtitle ? `${slide.subtitle}\n` : ""}${slide.bullets
              .map((bullet) => `- ${bullet}`)
              .join("\n")}`,
        )
        .join("\n\n"),
    [slides],
  );

  const update = (patch) => onChange({ ...state, ...patch });

  const updateSlide = (patch) => {
    update({
      slides: slides.map((slide, index) =>
        index === activeIndex ? { ...slide, ...patch } : slide,
      ),
    });
  };

  const generate = async () => {
    if (!String(state.notes || "").trim()) return;

    setIsGenerating(true);

    try {
      const res = await fetch(`${API_BASE}/slides`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: state.notes,
          slideCount: Math.min(maxSlideCount, state.slideCount || 6),
          tier: plan,
        }),
      });

      const data = await res.json();
      const deck = data.deck || {};

      update({
        rawSlides: data.slides || "",
        title: deck.title || state.title,
        subtitle: deck.subtitle || state.subtitle,
        theme: deck.theme || state.theme,
        slides: Array.isArray(deck.slides) && deck.slides.length > 0 ? deck.slides : slides,
        activeIndex: 0,
        outlineText:
          Array.isArray(deck.slides) && deck.slides.length > 0
            ? deck.slides
                .map(
                  (slide, index) =>
                    `Slide ${index + 1}: ${slide.title}\n${(slide.bullets || [])
                      .map((bullet) => `- ${bullet}`)
                      .join("\n")}`,
                )
                .join("\n\n")
            : outlineText,
      });
    } catch {
      update({
        rawSlides: "Could not generate slides. Make sure the backend and local model are running.",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleFullscreen = async () => {
    if (!canvasRef.current) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen?.();
      return;
    }
    await canvasRef.current.requestFullscreen?.();
  };

  return (
    <div className="tool slides-tool">
      <div className="tool-header">
        <div>
          <div className="tool-eyebrow">Slides</div>
          <h3>Google Slides-style deck builder</h3>
        </div>
        <div className="stats-pills">
          <span>{slides.length} slides</span>
          <span>{THEMES[state.theme]?.label || "Aurora"} theme</span>
          <span>{state.canvasItems?.length || 0} canvas notes</span>
        </div>
      </div>

      <div className="slides-layout">
        <div className="slides-sidebar">
          <div className="tool-panel">
            {!hasFullAccess && (
              <div className="plan-callout">
                <strong>Free plan</strong>
                <span>
                  Includes core slide editing. Start a free trial or unlock the full version for
                  every theme, up to 12 AI slides, and a bigger canvas workspace.
                </span>
                <button className="quiet-btn" onClick={() => onOpenBilling?.()}>
                  See plans
                </button>
              </div>
            )}

            <label className="stack-field">
              <span>Presentation title</span>
              <input
                type="text"
                value={state.title || ""}
                onChange={(event) => update({ title: event.target.value })}
              />
            </label>
            <label className="stack-field">
              <span>Subtitle</span>
              <input
                type="text"
                value={state.subtitle || ""}
                onChange={(event) => update({ subtitle: event.target.value })}
              />
            </label>

            <div className="theme-grid">
              {Object.entries(THEMES).map(([key, value]) => {
                const locked = !availableThemes.some(([allowedKey]) => allowedKey === key);
                return (
                  <button
                    key={key}
                    className={`theme-swatch ${state.theme === key ? "active" : ""} ${locked ? "locked" : ""}`}
                    style={{ background: value.surface, borderColor: value.accent }}
                    onClick={() => {
                      if (locked) {
                        onOpenBilling?.();
                        return;
                      }
                      update({ theme: key });
                    }}
                  >
                    {value.label}
                    {locked ? " Full" : ""}
                  </button>
                );
              })}
            </div>

            <label className="stack-field">
              <span>Notes to turn into slides</span>
              <textarea
                value={state.notes || ""}
                placeholder="Paste lecture notes, an essay outline, or talking points."
                onChange={(event) => update({ notes: event.target.value })}
              />
            </label>

            <div className="tool-row">
              <label className="field">
                Slide count
                <input
                  type="number"
                  min="3"
                  max={maxSlideCount}
                  value={state.slideCount || 6}
                  onChange={(event) =>
                    update({
                      slideCount: Math.min(maxSlideCount, Math.max(3, Number(event.target.value) || 6)),
                    })
                  }
                />
              </label>
              <button onClick={generate} disabled={isGenerating || !String(state.notes || "").trim()}>
                {isGenerating ? "Generating..." : "Generate deck"}
              </button>
            </div>
            <div className="deck-meta">
              {hasFullAccess
                ? "Full access can generate up to 12 slides and unlock every presentation theme."
                : "Free can generate up to 6 slides and includes the starter themes."}
            </div>

            {state.rawSlides && (
              <details className="raw-output">
                <summary>Raw AI output</summary>
                <pre>{state.rawSlides}</pre>
              </details>
            )}
          </div>

          <div className="tool-panel">
            <div className="deck-header">
              <div>
                <div className="deck-title">Canvas notes</div>
                <div className="deck-meta">Brainstorm like a storyboard before presenting.</div>
              </div>
              <button
                className="quiet-btn"
                onClick={() => {
                  if ((state.canvasItems || []).length >= maxCanvasItems) {
                    onOpenBilling?.();
                    return;
                  }
                  update({
                    canvasItems: [
                      ...(state.canvasItems || []),
                      { id: `${Date.now()}`, title: "New card", body: "Type an idea here" },
                    ],
                  });
                }}
              >
                Add note
              </button>
            </div>
            <div className="deck-meta">
              {hasFullAccess
                ? "Full access supports larger planning boards."
                : "Free canvas includes up to 3 planning notes."}
            </div>

            <div className="canvas-card-list">
              {(state.canvasItems || []).map((item) => (
                <div key={item.id} className="canvas-card">
                  <input
                    type="text"
                    value={item.title}
                    onChange={(event) =>
                      update({
                        canvasItems: (state.canvasItems || []).map((current) =>
                          current.id === item.id
                            ? { ...current, title: event.target.value }
                            : current,
                        ),
                      })
                    }
                  />
                  <textarea
                    className="small-textarea"
                    value={item.body}
                    onChange={(event) =>
                      update({
                        canvasItems: (state.canvasItems || []).map((current) =>
                          current.id === item.id
                            ? { ...current, body: event.target.value }
                            : current,
                        ),
                      })
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="slides-main">
          <div className="slide-toolbar">
            <button onClick={() => update({ slides: [...slides, blankSlide(slides.length)], activeIndex: slides.length })}>
              New slide
            </button>
            <button
              onClick={() =>
                update({
                  slides: [
                    ...slides.slice(0, activeIndex + 1),
                    { ...activeSlide },
                    ...slides.slice(activeIndex + 1),
                  ],
                  activeIndex: activeIndex + 1,
                })
              }
            >
              Duplicate
            </button>
            <button
              className="quiet-btn danger"
              onClick={() => {
                if (slides.length === 1) return;
                update({
                  slides: slides.filter((_, index) => index !== activeIndex),
                  activeIndex: Math.max(0, activeIndex - 1),
                });
              }}
            >
              Delete
            </button>
            <button className="quiet-btn" onClick={toggleFullscreen}>
              {isFullscreen ? "Exit fullscreen" : "Present"}
            </button>
          </div>

          <div className="slides-editor-shell">
            <div className="slide-list">
              {slides.map((slide, index) => (
                <button
                  key={`${slide.title}-${index}`}
                  className={index === activeIndex ? "active" : ""}
                  onClick={() => update({ activeIndex: index })}
                >
                  <div className="thumb-index">{index + 1}</div>
                  <div className="thumb-title">{slide.title || `Slide ${index + 1}`}</div>
                  <div className="thumb-subtitle">{slide.layout}</div>
                </button>
              ))}
            </div>

            <div className="slide-stage">
              <div
                className={`slide-canvas layout-${activeSlide.layout}`}
                ref={canvasRef}
                style={{
                  background: theme.surface,
                  boxShadow: `0 24px 60px ${theme.accentSoft}`,
                  borderColor: theme.accentSoft,
                }}
              >
                <div className="slide-accent" style={{ background: theme.accent }} />
                <div className="slide-preview-meta">
                  <span>{state.title}</span>
                  <span>{activeIndex + 1}/{slides.length}</span>
                </div>
                <div className="slide-preview-body">
                  <h2 style={{ color: theme.accent }}>{activeSlide.title}</h2>
                  {activeSlide.subtitle && <p className="slide-preview-subtitle">{activeSlide.subtitle}</p>}
                  <ul>
                    {(activeSlide.bullets || []).map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="slide-form-grid">
                <label className="stack-field">
                  <span>Slide title</span>
                  <input
                    type="text"
                    value={activeSlide.title || ""}
                    onChange={(event) => updateSlide({ title: event.target.value })}
                  />
                </label>
                <label className="stack-field">
                  <span>Subtitle</span>
                  <input
                    type="text"
                    value={activeSlide.subtitle || ""}
                    onChange={(event) => updateSlide({ subtitle: event.target.value })}
                  />
                </label>
                <label className="stack-field">
                  <span>Layout</span>
                  <select
                    value={activeSlide.layout || "title-bullets"}
                    onChange={(event) => updateSlide({ layout: event.target.value })}
                  >
                    <option value="title-bullets">Title + bullets</option>
                    <option value="split">Split content</option>
                    <option value="quote">Quote</option>
                    <option value="timeline">Timeline</option>
                  </select>
                </label>
                <label className="stack-field full-span">
                  <span>Bullets</span>
                  <textarea
                    value={(activeSlide.bullets || []).join("\n")}
                    onChange={(event) =>
                      updateSlide({
                        bullets: event.target.value
                          .split("\n")
                          .map((line) => line.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </label>
                <label className="stack-field full-span">
                  <span>Speaker notes</span>
                  <textarea
                    className="small-textarea"
                    value={activeSlide.speakerNotes || ""}
                    onChange={(event) => updateSlide({ speakerNotes: event.target.value })}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="slides-inspector">
          <div className="tool-panel">
            <div className="deck-title">Presenter notes</div>
            <p className="deck-meta">
              Rehearse from this panel while the slide preview stays clean.
            </p>
            <div className="presenter-note-card">
              {activeSlide.speakerNotes || "Add speaker notes for this slide."}
            </div>
          </div>

          <div className="tool-panel">
            <div className="deck-title">Outline export</div>
            <textarea
              className="small-textarea"
              value={state.outlineText || outlineText}
              onChange={(event) => update({ outlineText: event.target.value })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Slides;
