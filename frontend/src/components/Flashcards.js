import { useMemo } from "react";

function Flashcards({ state, onChange }) {
  const {
    notes,
    rawCards,
    cards,
    mode,
    index,
    isFlipped,
    showAnswer,
    userAnswer,
    score,
    attempts,
    count,
  } = state;

  const update = (patch) => onChange({ ...state, ...patch });

  const generate = async () => {
    const res = await fetch("http://localhost:5050/flashcards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes, count }),
    });
    const data = await res.json();
    const parsed = parseCards(data.cards || "");
    update({
      rawCards: data.cards || "",
      cards: parsed,
      index: 0,
      isFlipped: false,
      showAnswer: false,
      userAnswer: "",
      score: 0,
      attempts: 0,
    });
  };

  const parseCards = (text) => {
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const parsed = [];
    let current = { question: "", answer: "" };

    for (const line of lines) {
      if (line.toLowerCase().startsWith("q:")) {
        if (current.question || current.answer) parsed.push(current);
        current = { question: line.slice(2).trim(), answer: "" };
        continue;
      }
      if (line.toLowerCase().startsWith("a:")) {
        current.answer = line.slice(2).trim();
        continue;
      }
      if (current.answer) {
        current.answer += ` ${line}`;
      } else if (current.question) {
        current.question += ` ${line}`;
      }
    }

    if (current.question || current.answer) parsed.push(current);

    return parsed.filter((c) => c.question && c.answer);
  };

  const current = cards[index];

  const progressText = cards.length
    ? `${index + 1} / ${cards.length}`
    : "0 / 0";

  const options = useMemo(() => {
    if (!current) return [];
    const answers = cards
      .filter((_, i) => i !== index)
      .map((c) => c.answer);
    const picks = answers.slice(0, 3);
    const all = [current.answer, ...picks];
    return all.sort(() => Math.random() - 0.5);
  }, [cards, current, index]);

  const submitAnswer = (choice) => {
    if (!current || showAnswer) return;
    const isCorrect =
      (choice || userAnswer).trim().toLowerCase() ===
      current.answer.trim().toLowerCase();
    update({
      showAnswer: true,
      attempts: attempts + 1,
      score: isCorrect ? score + 1 : score,
    });
  };

  const nextCard = () => {
    if (!cards.length) return;
    update({
      index: (index + 1) % cards.length,
      isFlipped: false,
      showAnswer: false,
      userAnswer: "",
    });
  };

  const prevCard = () => {
    if (!cards.length) return;
    update({
      index: (index - 1 + cards.length) % cards.length,
      isFlipped: false,
      showAnswer: false,
      userAnswer: "",
    });
  };

  const shuffleCards = () => {
    if (!cards.length) return;
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    update({
      cards: shuffled,
      index: 0,
      isFlipped: false,
      showAnswer: false,
      userAnswer: "",
      score: 0,
      attempts: 0,
    });
  };

  return (
    <div className="tool flashcards">
      <div className="tool-header">
        <div>
          <div className="tool-eyebrow">Flashcards</div>
          <h3>Quizlet-style Study Deck</h3>
        </div>
        <div className="mode-tabs">
          <button
            className={mode === "learn" ? "active" : ""}
            onClick={() => update({ mode: "learn" })}
          >
            Learn
          </button>
          <button
            className={mode === "test" ? "active" : ""}
            onClick={() => update({ mode: "test" })}
          >
            Test
          </button>
        </div>
      </div>

      <div className="tool-grid">
        <div className="tool-panel">
          <textarea
            placeholder="Paste notes here..."
            value={notes}
            onChange={(e) => update({ notes: e.target.value })}
          />
          <div className="tool-row">
            <label className="field">
              Cards
              <input
                type="number"
                min="6"
                max="50"
                value={count}
                onChange={(e) =>
                  update({ count: Math.max(6, Number(e.target.value) || 6) })
                }
              />
            </label>
            <button onClick={generate}>Generate Deck</button>
          </div>
          {rawCards && (
            <details className="raw-output">
              <summary>Raw AI output</summary>
              <pre>{rawCards}</pre>
            </details>
          )}
        </div>

        <div className="tool-panel">
          <div className="deck-header">
            <div>
              <div className="deck-title">Study Deck</div>
              <div className="deck-meta">{progressText}</div>
            </div>
            <div className="deck-meta">
              Score: {score} / {attempts}
            </div>
          </div>

          {!cards.length && (
            <div className="empty-state">
              Generate a deck to start studying.
            </div>
          )}

          {cards.length > 0 && mode === "learn" && current && (
            <>
              <button
                className={`flashcard ${isFlipped ? "flipped" : ""}`}
                onClick={() => update({ isFlipped: !isFlipped })}
              >
                <div className="flashcard-face front">
                  <div className="flashcard-label">Question</div>
                  <div className="flashcard-text">{current.question}</div>
                </div>
                <div className="flashcard-face back">
                  <div className="flashcard-label">Answer</div>
                  <div className="flashcard-text">{current.answer}</div>
                </div>
              </button>
              <div className="deck-controls">
                <button onClick={prevCard}>Previous</button>
                <button onClick={() => update({ isFlipped: !isFlipped })}>Flip</button>
                <button onClick={nextCard}>Next</button>
                <button onClick={shuffleCards}>Shuffle</button>
              </div>
            </>
          )}

          {cards.length > 0 && mode === "test" && current && (
            <div className="quiz">
              <div className="quiz-question">{current.question}</div>
              {options.length >= 4 ? (
                <div className="quiz-options">
                  {options.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => submitAnswer(opt)}
                      disabled={showAnswer}
                      className={
                        showAnswer && opt === current.answer ? "correct" : ""
                      }
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="quiz-input">
                  <input
                    type="text"
                    placeholder="Type your answer..."
                    value={userAnswer}
                    onChange={(e) => update({ userAnswer: e.target.value })}
                    disabled={showAnswer}
                  />
                  <button onClick={() => submitAnswer()}>Check</button>
                </div>
              )}
              {showAnswer && (
                <div className="quiz-feedback">
                  Answer: {current.answer}
                </div>
              )}
              <div className="deck-controls">
                <button onClick={prevCard}>Previous</button>
                <button onClick={nextCard}>Next</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Flashcards;
