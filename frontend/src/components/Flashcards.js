import { useMemo, useState } from "react";

const MODES = ["flashcards", "learn", "write", "test", "match"];

const modeLabel = {
  flashcards: "Flashcards",
  learn: "Learn",
  write: "Write",
  test: "Test",
  match: "Match",
};

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function createCard(term = "", definition = "") {
  return {
    id: uid(),
    term,
    definition,
    star: false,
    familiarity: 0,
  };
}

function normalizeCard(card, index) {
  if (!card) return createCard();

  const term =
    typeof card.term === "string"
      ? card.term
      : typeof card.question === "string"
      ? card.question
      : "";

  const definition =
    typeof card.definition === "string"
      ? card.definition
      : typeof card.answer === "string"
      ? card.answer
      : "";

  return {
    id: card.id || `${uid()}-${index}`,
    term,
    definition,
    star: Boolean(card.star),
    familiarity: Number.isFinite(card.familiarity) ? card.familiarity : 0,
  };
}

function parseCards(text) {
  const lines = String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const parsed = [];
  let current = { term: "", definition: "" };

  for (const line of lines) {
    if (/^[-_*=\s]{3,}$/.test(line)) {
      continue;
    }

    const cleaned = line
      .replace(/^(?:flash\s*card|flashcard|card)\s*\d+\s*[:.)-]?\s*/i, "")
      .trim();

    if (!cleaned) {
      continue;
    }

    if (/^(?:flash\s*card|flashcard|card)\s*\d+\s*[:.)-]?\s*$/i.test(line)) {
      continue;
    }

    const questionMatch = cleaned.match(
      /^(?:\d+\s*[).:-]\s*)?(?:q(?:uestion)?|term)\s*:\s*(.+)$/i,
    );
    const answerMatch = cleaned.match(
      /^(?:\d+\s*[).:-]\s*)?(?:a(?:nswer)?|definition)\s*:\s*(.+)$/i,
    );

    if (questionMatch) {
      if (current.term || current.definition) {
        parsed.push(createCard(current.term, current.definition));
      }
      current = {
        term: questionMatch[1].trim(),
        definition: "",
      };
      continue;
    }

    if (answerMatch) {
      current.definition = answerMatch[1].trim();
      continue;
    }

    if (cleaned.includes("::")) {
      const [term, ...rest] = cleaned.split("::");
      const definition = rest.join("::").trim();
      if (term.trim() && definition) {
        if (current.term || current.definition) {
          parsed.push(createCard(current.term, current.definition));
          current = { term: "", definition: "" };
        }
        parsed.push(createCard(term.trim(), definition));
        continue;
      }
    }

    if (cleaned.includes("\t")) {
      const [term, ...rest] = cleaned.split("\t");
      const definition = rest.join(" ").trim();
      if (term.trim() && definition) {
        if (current.term || current.definition) {
          parsed.push(createCard(current.term, current.definition));
          current = { term: "", definition: "" };
        }
        parsed.push(createCard(term.trim(), definition));
        continue;
      }
    }

    if (current.definition) {
      current.definition = `${current.definition} ${cleaned}`.trim();
    } else if (current.term) {
      current.term = `${current.term} ${cleaned}`.trim();
    }
  }

  if (current.term || current.definition) {
    parsed.push(createCard(current.term, current.definition));
  }

  return parsed.filter((card) => card.term.trim() && card.definition.trim());
}

function buildTestQuestions(cards, promptSide) {
  const source = shuffle(cards).slice(0, Math.min(cards.length, 12));

  return source.map((card, i) => {
    const prompt = promptSide === "term" ? card.term : card.definition;
    const answer = promptSide === "term" ? card.definition : card.term;

    if (i % 3 === 0) {
      const distractors = shuffle(
        cards
          .filter((c) => c.id !== card.id)
          .map((c) => (promptSide === "term" ? c.definition : c.term)),
      ).slice(0, 3);

      return {
        id: uid(),
        type: "multiple",
        prompt,
        answer,
        options: shuffle([answer, ...distractors]),
      };
    }

    if (i % 3 === 1) {
      const wrong = cards.find((c) => c.id !== card.id);
      const useCorrect = Math.random() > 0.5 || !wrong;

      return {
        id: uid(),
        type: "truefalse",
        prompt,
        statement: useCorrect
          ? answer
          : promptSide === "term"
          ? wrong.definition
          : wrong.term,
        answer: useCorrect ? "True" : "False",
      };
    }

    return {
      id: uid(),
      type: "written",
      prompt,
      answer,
    };
  });
}

function buildMatchRound(sourceCards) {
  const source = shuffle(sourceCards).slice(0, Math.min(6, sourceCards.length));

  if (!source.length) {
    return {
      matchTokens: [],
      matchSelected: [],
      matchMatched: [],
      matchStartedAt: 0,
      matchFinishedAt: 0,
      matchMoves: 0,
    };
  }

  const tokens = shuffle(
    source.flatMap((card) => [
      {
        id: `${card.id}-term`,
        pairId: card.id,
        side: "term",
        label: card.term,
      },
      {
        id: `${card.id}-definition`,
        pairId: card.id,
        side: "definition",
        label: card.definition,
      },
    ]),
  );

  return {
    matchTokens: tokens,
    matchSelected: [],
    matchMatched: [],
    matchStartedAt: Date.now(),
    matchFinishedAt: 0,
    matchMoves: 0,
  };
}

function checkResponse(expected, actual) {
  if (!actual || !String(actual).trim()) return false;
  const normExpected = normalizeText(expected);
  const normActual = normalizeText(actual);
  return normExpected === normActual || normExpected.includes(normActual);
}

function Flashcards({ state, onChange }) {
  const update = (patch) => onChange({ ...state, ...patch });

  const cards = useMemo(
    () => (state.cards || []).map(normalizeCard).filter((c) => c.term && c.definition),
    [state.cards],
  );

  const mode = MODES.includes(state.mode)
    ? state.mode
    : state.mode === "learn" || state.mode === "test"
    ? state.mode
    : "flashcards";

  const promptSide = state.promptSide === "definition" ? "definition" : "term";
  const starredOnly = Boolean(state.starredOnly);
  const filteredCards = useMemo(
    () => (starredOnly ? cards.filter((c) => c.star) : cards),
    [cards, starredOnly],
  );

  const studyIndex = Number.isFinite(state.studyIndex)
    ? state.studyIndex
    : Number.isFinite(state.index)
    ? state.index
    : 0;

  const safeIndex = filteredCards.length
    ? Math.min(Math.max(studyIndex, 0), filteredCards.length - 1)
    : 0;

  const current = filteredCards[safeIndex] || null;
  const isFlipped = Boolean(state.isFlipped);

  const [isGenerating, setIsGenerating] = useState(false);

  const testQuestions = useMemo(
    () => (Array.isArray(state.testQuestions) ? state.testQuestions : []),
    [state.testQuestions],
  );
  const testAnswers = useMemo(
    () =>
      state.testAnswers && typeof state.testAnswers === "object"
        ? state.testAnswers
        : {},
    [state.testAnswers],
  );
  const testSubmitted = Boolean(state.testSubmitted);

  const matchTokens = useMemo(
    () => (Array.isArray(state.matchTokens) ? state.matchTokens : []),
    [state.matchTokens],
  );
  const matchSelected = useMemo(
    () => (Array.isArray(state.matchSelected) ? state.matchSelected : []),
    [state.matchSelected],
  );
  const matchMatched = useMemo(
    () => (Array.isArray(state.matchMatched) ? state.matchMatched : []),
    [state.matchMatched],
  );

  const totalMastered = cards.filter((c) => c.familiarity >= 2).length;

  const setCards = (nextCards, extra = {}) => {
    update({ cards: nextCards, ...extra });
  };

  const moveTo = (next) => {
    if (!filteredCards.length) {
      update({ studyIndex: 0, index: 0, isFlipped: false });
      return;
    }

    const clamped = (next + filteredCards.length) % filteredCards.length;
    update({
      studyIndex: clamped,
      index: clamped,
      isFlipped: false,
      learnFeedback: "",
      writeFeedback: "",
      writeInput: "",
    });
  };

  const addCard = () => {
    setCards([...cards, createCard("", "")]);
  };

  const duplicateCard = (id) => {
    const source = cards.find((card) => card.id === id);
    if (!source) return;

    const duplicated = createCard(source.term, source.definition);
    duplicated.star = source.star;

    setCards([...cards, duplicated]);
  };

  const updateCard = (id, patch) => {
    setCards(cards.map((card) => (card.id === id ? { ...card, ...patch } : card)));
  };

  const deleteCard = (id) => {
    const nextCards = cards.filter((card) => card.id !== id);
    setCards(nextCards);
  };

  const moveCard = (id, direction) => {
    const index = cards.findIndex((card) => card.id === id);
    if (index < 0) return;

    const target = index + direction;
    if (target < 0 || target >= cards.length) return;

    const next = [...cards];
    [next[index], next[target]] = [next[target], next[index]];
    setCards(next);
  };

  const sortCards = () => {
    setCards(
      [...cards].sort((a, b) => a.term.localeCompare(b.term, undefined, { sensitivity: "base" })),
      { studyIndex: 0, index: 0, isFlipped: false },
    );
  };

  const shuffleCards = () => {
    setCards(shuffle(cards), { studyIndex: 0, index: 0, isFlipped: false });
  };

  const resetProgress = () => {
    setCards(
      cards.map((card) => ({ ...card, familiarity: 0 })),
      {
        studyIndex: 0,
        index: 0,
        isFlipped: false,
        writeInput: "",
        writeFeedback: "",
        learnFeedback: "",
        stats: { correct: 0, attempts: 0, streak: 0, bestStreak: 0 },
        testSubmitted: false,
        testAnswers: {},
      },
    );
  };

  const importDeck = () => {
    const parsed = parseCards(state.importText || "");
    if (!parsed.length) return;

    setCards(parsed, {
      studyIndex: 0,
      index: 0,
      isFlipped: false,
      importText: "",
    });
  };

  const exportDeck = () => {
    const text = cards.map((card) => `Q: ${card.term}\nA: ${card.definition}`).join("\n\n");
    update({ exportText: text });
  };

  const generateDeck = async () => {
    if (!String(state.notes || "").trim()) return;

    setIsGenerating(true);

    try {
      const res = await fetch("http://localhost:5050/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: state.notes, count: state.count || 12 }),
      });

      const data = await res.json();
      const parsed = parseCards(data.cards || "");

      setCards(parsed, {
        rawCards: data.cards || "",
        studyIndex: 0,
        index: 0,
        isFlipped: false,
        writeInput: "",
        writeFeedback: "",
        learnFeedback: "",
      });
    } catch {
      update({ rawCards: "⚠️ Could not generate flashcards. Make sure backend is running." });
    } finally {
      setIsGenerating(false);
    }
  };

  const setFamiliarity = (delta) => {
    if (!current) return;

    setCards(
      cards.map((card) =>
        card.id === current.id
          ? { ...card, familiarity: Math.max(0, Math.min(3, (card.familiarity || 0) + delta)) }
          : card,
      ),
    );
  };

  const learnOptions = useMemo(() => {
    if (!current) return [];

    const correct = promptSide === "term" ? current.definition : current.term;
    const distractors = shuffle(
      filteredCards
        .filter((card) => card.id !== current.id)
        .map((card) => (promptSide === "term" ? card.definition : card.term)),
    ).slice(0, 3);

    return shuffle([correct, ...distractors]);
  }, [current, filteredCards, promptSide]);

  const registerScore = (isCorrect) => {
    const stats = state.stats || { correct: 0, attempts: 0, streak: 0, bestStreak: 0 };
    const nextStreak = isCorrect ? (stats.streak || 0) + 1 : 0;

    return {
      correct: (stats.correct || 0) + (isCorrect ? 1 : 0),
      attempts: (stats.attempts || 0) + 1,
      streak: nextStreak,
      bestStreak: Math.max(stats.bestStreak || 0, nextStreak),
    };
  };

  const answerLearn = (choice) => {
    if (!current) return;

    const expected = promptSide === "term" ? current.definition : current.term;
    const isCorrect = checkResponse(expected, choice);
    const nextCards = cards.map((card) =>
      card.id === current.id
        ? { ...card, familiarity: Math.max(0, Math.min(3, (card.familiarity || 0) + (isCorrect ? 1 : -1))) }
        : card,
    );

    update({
      cards: nextCards,
      stats: registerScore(isCorrect),
      learnFeedback: isCorrect ? "Correct" : `Correct answer: ${expected}`,
    });
  };

  const answerWrite = () => {
    if (!current) return;

    const expected = promptSide === "term" ? current.definition : current.term;
    const isCorrect = checkResponse(expected, state.writeInput || "");
    const nextCards = cards.map((card) =>
      card.id === current.id
        ? { ...card, familiarity: Math.max(0, Math.min(3, (card.familiarity || 0) + (isCorrect ? 1 : -1))) }
        : card,
    );

    update({
      cards: nextCards,
      stats: registerScore(isCorrect),
      writeFeedback: isCorrect ? "Correct" : `Expected: ${expected}`,
    });
  };

  const startTest = () => {
    if (!filteredCards.length) return;

    update({
      testQuestions: buildTestQuestions(filteredCards, promptSide),
      testAnswers: {},
      testSubmitted: false,
    });
  };

  const setTestAnswer = (questionId, value) => {
    update({
      testAnswers: {
        ...testAnswers,
        [questionId]: value,
      },
    });
  };

  const questionCorrect = (question, answer) => {
    if (question.type === "written") {
      return checkResponse(question.answer, answer);
    }
    return String(answer || "").trim() === String(question.answer || "").trim();
  };

  const testScore = useMemo(() => {
    if (!testQuestions.length) return 0;

    return testQuestions.reduce(
      (sum, q) => sum + (questionCorrect(q, testAnswers[q.id]) ? 1 : 0),
      0,
    );
  }, [testAnswers, testQuestions]);

  const startMatchRound = () => {
    if (!filteredCards.length) return;
    update(buildMatchRound(filteredCards));
  };

  const chooseMatchToken = (token) => {
    if (!token) return;
    if (matchMatched.includes(token.pairId)) return;

    if (matchSelected.length === 0) {
      update({ matchSelected: [token.id] });
      return;
    }

    const firstTokenId = matchSelected[0];
    if (firstTokenId === token.id) {
      update({ matchSelected: [] });
      return;
    }

    const first = matchTokens.find((t) => t.id === firstTokenId);
    if (!first) {
      update({ matchSelected: [token.id] });
      return;
    }

    const isMatch = first.pairId === token.pairId && first.side !== token.side;

    if (isMatch) {
      const nextMatched = [...matchMatched, token.pairId];
      const done = nextMatched.length === matchTokens.length / 2;
      const finishTime = done ? Date.now() : 0;
      const elapsed = done ? finishTime - (state.matchStartedAt || Date.now()) : 0;
      const currentBest = state.bestMatchMs || 0;

      update({
        matchMatched: nextMatched,
        matchSelected: [],
        matchMoves: (state.matchMoves || 0) + 1,
        matchFinishedAt: finishTime,
        bestMatchMs: done
          ? currentBest === 0
            ? elapsed
            : Math.min(currentBest, elapsed)
          : currentBest,
        stats: registerScore(true),
      });

      return;
    }

    update({
      matchSelected: [token.id],
      matchMoves: (state.matchMoves || 0) + 1,
      stats: registerScore(false),
    });
  };

  const stats = state.stats || { correct: 0, attempts: 0, streak: 0, bestStreak: 0 };

  const accuracy = stats.attempts ? Math.round((stats.correct / stats.attempts) * 100) : 0;

  const progressText = filteredCards.length
    ? `${safeIndex + 1} / ${filteredCards.length}`
    : "0 / 0";

  const prompt = current
    ? promptSide === "term"
      ? current.term
      : current.definition
    : "";

  const answer = current
    ? promptSide === "term"
      ? current.definition
      : current.term
    : "";

  return (
    <div className="tool flashcards quizlet-style">
      <div className="tool-header">
        <div>
          <div className="tool-eyebrow">Flashcards</div>
          <h3>Student Helper Deck Studio</h3>
        </div>
        <div className="stats-pills">
          <span>{cards.length} cards</span>
          <span>{totalMastered} mastered</span>
          <span>{accuracy}% accuracy</span>
        </div>
      </div>

      <div className="tool-grid flashcards-grid">
        <div className="tool-panel deck-builder">
          <div className="deck-form">
            <label>
              Deck title
              <input
                type="text"
                placeholder="Biology Unit 4"
                value={state.deckTitle || ""}
                onChange={(e) => update({ deckTitle: e.target.value })}
              />
            </label>
            <label>
              Description
              <textarea
                className="small-textarea"
                placeholder="What this set covers"
                value={state.deckDescription || ""}
                onChange={(e) => update({ deckDescription: e.target.value })}
              />
            </label>
          </div>

          <div className="deck-toolbar">
            <button onClick={addCard}>Add card</button>
            <button onClick={shuffleCards} className="quiet-btn">
              Shuffle
            </button>
            <button onClick={sortCards} className="quiet-btn">
              Sort A-Z
            </button>
            <button onClick={resetProgress} className="quiet-btn danger">
              Reset progress
            </button>
          </div>

          <div className="cards-editor">
            {cards.map((card, idx) => (
              <div key={card.id} className="card-row">
                <div className="row-head">
                  <span>#{idx + 1}</span>
                  <div className="row-actions">
                    <button
                      className={`icon-btn ${card.star ? "is-starred" : ""}`}
                      onClick={() => updateCard(card.id, { star: !card.star })}
                      title="Star"
                    >
                      ★
                    </button>
                    <button className="icon-btn" onClick={() => moveCard(card.id, -1)} title="Move up">
                      ↑
                    </button>
                    <button className="icon-btn" onClick={() => moveCard(card.id, 1)} title="Move down">
                      ↓
                    </button>
                    <button className="icon-btn" onClick={() => duplicateCard(card.id)} title="Duplicate">
                      ⧉
                    </button>
                    <button className="icon-btn danger" onClick={() => deleteCard(card.id)} title="Delete">
                      ✕
                    </button>
                  </div>
                </div>
                <div className="row-fields">
                  <input
                    type="text"
                    placeholder="Term"
                    value={card.term}
                    onChange={(e) => updateCard(card.id, { term: e.target.value })}
                  />
                  <textarea
                    placeholder="Definition"
                    value={card.definition}
                    onChange={(e) => updateCard(card.id, { definition: e.target.value })}
                  />
                </div>
              </div>
            ))}

            {!cards.length && (
              <div className="empty-state">Start by adding cards manually or generating from your notes.</div>
            )}
          </div>

          <div className="generator-panel">
            <h4>Generate with Student Helper AI</h4>
            <textarea
              placeholder="Paste your class notes or textbook passage"
              value={state.notes || ""}
              onChange={(e) => update({ notes: e.target.value })}
            />
            <div className="tool-row">
              <label className="field">
                Cards
                <input
                  type="number"
                  min="6"
                  max="50"
                  value={state.count || 12}
                  onChange={(e) =>
                    update({ count: Math.min(50, Math.max(6, Number(e.target.value) || 6)) })
                  }
                />
              </label>
              <button onClick={generateDeck} disabled={isGenerating || !String(state.notes || "").trim()}>
                {isGenerating ? "Generating..." : "Generate deck"}
              </button>
            </div>
            {state.rawCards && (
              <details className="raw-output">
                <summary>Raw AI output</summary>
                <pre>{state.rawCards}</pre>
              </details>
            )}
          </div>

          <div className="io-panel">
            <label>
              Import text (supports `Q:/A:`, `term::definition`, or tab-separated)
              <textarea
                className="small-textarea"
                placeholder="Q: mitochondria\nA: powerhouse of the cell"
                value={state.importText || ""}
                onChange={(e) => update({ importText: e.target.value })}
              />
            </label>
            <div className="tool-row">
              <button onClick={importDeck} className="quiet-btn">
                Import
              </button>
              <button onClick={exportDeck} className="quiet-btn">
                Export
              </button>
            </div>
            {state.exportText && <textarea className="small-textarea" readOnly value={state.exportText} />}
          </div>
        </div>

        <div className="tool-panel study-panel">
          <div className="deck-header">
            <div>
              <div className="deck-title">{state.deckTitle || "Untitled deck"}</div>
              <div className="deck-meta">{progressText}</div>
            </div>
            <div className="deck-meta">{modeLabel[mode]}</div>
          </div>

          <div className="study-controls-top">
            <div className="mode-tabs">
              {MODES.map((m) => (
                <button
                  key={m}
                  className={mode === m ? "active" : ""}
                  onClick={() => {
                    const basePatch = {
                      mode: m,
                      testSubmitted: false,
                      learnFeedback: "",
                      writeFeedback: "",
                    };

                    if (m === "match" && matchTokens.length === 0 && filteredCards.length > 0) {
                      update({
                        ...basePatch,
                        ...buildMatchRound(filteredCards),
                      });
                      return;
                    }

                    update({
                      ...basePatch,
                    });
                  }}
                >
                  {modeLabel[m]}
                </button>
              ))}
            </div>

            <div className="toggles">
              <label>
                <input
                  type="checkbox"
                  checked={promptSide === "definition"}
                  onChange={(e) =>
                    update({
                      promptSide: e.target.checked ? "definition" : "term",
                      isFlipped: false,
                    })
                  }
                />
                Definition first
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={starredOnly}
                  onChange={(e) => update({ starredOnly: e.target.checked, studyIndex: 0, index: 0 })}
                />
                Starred only
              </label>
            </div>
          </div>

          {!filteredCards.length && (
            <div className="empty-state">No cards to study in this filter. Add cards or disable starred-only mode.</div>
          )}

          {filteredCards.length > 0 && mode === "flashcards" && current && (
            <>
              <button
                className={`flashcard ${isFlipped ? "flipped" : ""}`}
                onClick={() => update({ isFlipped: !isFlipped })}
              >
                <div className="flashcard-face front">
                  <div className="flashcard-label">Prompt</div>
                  <div className="flashcard-text">{prompt}</div>
                </div>
                <div className="flashcard-face back">
                  <div className="flashcard-label">Answer</div>
                  <div className="flashcard-text">{answer}</div>
                </div>
              </button>

              <div className="learning-actions">
                <button onClick={() => setFamiliarity(-1)} className="quiet-btn danger">
                  Still learning
                </button>
                <button onClick={() => setFamiliarity(1)} className="quiet-btn success">
                  Know it
                </button>
              </div>

              <div className="deck-controls">
                <button onClick={() => moveTo(safeIndex - 1)}>Previous</button>
                <button onClick={() => update({ isFlipped: !isFlipped })}>Flip</button>
                <button onClick={() => moveTo(safeIndex + 1)}>Next</button>
              </div>
            </>
          )}

          {filteredCards.length > 0 && mode === "learn" && current && (
            <div className="quiz">
              <div className="quiz-question">{prompt}</div>
              <div className="quiz-options">
                {learnOptions.map((option) => (
                  <button key={option} onClick={() => answerLearn(option)}>
                    {option}
                  </button>
                ))}
              </div>
              {state.learnFeedback && <div className="quiz-feedback">{state.learnFeedback}</div>}
              <div className="deck-controls">
                <button onClick={() => moveTo(safeIndex - 1)}>Previous</button>
                <button onClick={() => moveTo(safeIndex + 1)}>Next</button>
              </div>
            </div>
          )}

          {filteredCards.length > 0 && mode === "write" && current && (
            <div className="quiz">
              <div className="quiz-question">{prompt}</div>
              <div className="quiz-input">
                <input
                  type="text"
                  placeholder="Type your answer"
                  value={state.writeInput || ""}
                  onChange={(e) => update({ writeInput: e.target.value, writeFeedback: "" })}
                />
                <button onClick={answerWrite}>Check</button>
              </div>
              {state.writeFeedback && <div className="quiz-feedback">{state.writeFeedback}</div>}
              <div className="deck-controls">
                <button onClick={() => moveTo(safeIndex - 1)}>Previous</button>
                <button onClick={() => moveTo(safeIndex + 1)}>Next</button>
              </div>
            </div>
          )}

          {filteredCards.length > 0 && mode === "test" && (
            <div className="test-panel">
              <div className="tool-row">
                <button onClick={startTest}>Generate test</button>
                {testQuestions.length > 0 && (
                  <button className="quiet-btn" onClick={() => update({ testSubmitted: true })}>
                    Grade test
                  </button>
                )}
              </div>

              {testSubmitted && testQuestions.length > 0 && (
                <div className="test-score">
                  Score: {testScore} / {testQuestions.length}
                </div>
              )}

              <div className="test-questions">
                {testQuestions.map((q, idx) => (
                  <div className="test-question" key={q.id}>
                    <div className="q-title">{idx + 1}. {q.prompt}</div>

                    {q.type === "multiple" && (
                      <div className="quiz-options">
                        {q.options.map((opt) => (
                          <button
                            key={opt}
                            onClick={() => setTestAnswer(q.id, opt)}
                            className={testAnswers[q.id] === opt ? "selected" : ""}
                            disabled={testSubmitted}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    )}

                    {q.type === "truefalse" && (
                      <>
                        <div className="tf-statement">{q.statement}</div>
                        <div className="quiz-options two-col">
                          {["True", "False"].map((opt) => (
                            <button
                              key={opt}
                              onClick={() => setTestAnswer(q.id, opt)}
                              className={testAnswers[q.id] === opt ? "selected" : ""}
                              disabled={testSubmitted}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      </>
                    )}

                    {q.type === "written" && (
                      <div className="quiz-input">
                        <input
                          type="text"
                          value={testAnswers[q.id] || ""}
                          onChange={(e) => setTestAnswer(q.id, e.target.value)}
                          disabled={testSubmitted}
                          placeholder="Type your answer"
                        />
                      </div>
                    )}

                    {testSubmitted && (
                      <div className={`quiz-feedback ${questionCorrect(q, testAnswers[q.id]) ? "ok" : "bad"}`}>
                        {questionCorrect(q, testAnswers[q.id]) ? "Correct" : `Correct answer: ${q.answer}`}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {filteredCards.length > 0 && mode === "match" && (
            <div className="match-panel">
              <div className="match-top">
                <div>Moves: {state.matchMoves || 0}</div>
                <div>
                  Best time:{" "}
                  {state.bestMatchMs ? `${(state.bestMatchMs / 1000).toFixed(1)}s` : "-"}
                </div>
                <button className="quiet-btn" onClick={startMatchRound}>
                  New round
                </button>
              </div>

              <div className="match-grid">
                {matchTokens.map((token) => {
                  const isMatched = matchMatched.includes(token.pairId);
                  const isSelected = matchSelected.includes(token.id);

                  return (
                    <button
                      key={token.id}
                      className={`match-token ${isMatched ? "matched" : ""} ${isSelected ? "selected" : ""}`}
                      disabled={isMatched}
                      onClick={() => chooseMatchToken(token)}
                    >
                      {token.label}
                    </button>
                  );
                })}
              </div>

              {state.matchFinishedAt > 0 && (
                <div className="quiz-feedback ok">
                  Completed in {((state.matchFinishedAt - state.matchStartedAt) / 1000).toFixed(1)}s
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Flashcards;
