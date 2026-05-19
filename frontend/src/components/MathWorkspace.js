import { useEffect, useMemo, useRef, useState } from "react";

const QUICK_PROMPTS = [
  "Solve this algebra problem and explain every step.",
  "Check whether my answer is correct and show the verification.",
  "Explain this geometry problem like I am learning it for the first time.",
];

function MathWorkspace({ state, onChange, onSolve, plan = "free", onOpenBilling }) {
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const uploadRef = useRef(null);
  const cameraRef = useRef(null);
  const hasFullAccess = plan !== "free";

  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl("");
      return undefined;
    }

    const url = URL.createObjectURL(imageFile);
    setPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [imageFile]);

  const history = useMemo(
    () => (Array.isArray(state.history) ? state.history : []),
    [state.history],
  );
  const visibleHistory = hasFullAccess ? history : history.slice(0, 3);

  const activeHistoryItem =
    history.find((item) => item.id === state.activeHistoryId) || history[0] || null;

  const activeResult = activeHistoryItem?.result || state.solverResult;

  const solve = () => {
    if (!String(state.question || "").trim() && !imageFile) return;
    onSolve({ question: state.question || "", image: imageFile });
  };

  return (
    <div className="math-workspace">
      <div className="math-capture-panel">
        <div className="tool-eyebrow">Math Mode</div>
        <h3>Snap the problem. Get the work.</h3>
        <p className="panel-copy">
          Use camera upload like a homework solver, then review the full explanation step by step.
        </p>

        {!hasFullAccess && (
          <div className="plan-callout">
            <strong>Free plan</strong>
            <span>
              Start a free trial or unlock the full version for longer solve history, deeper answer
              checks, and stronger AI reasoning.
            </span>
            <button className="quiet-btn" onClick={() => onOpenBilling?.()}>
              See plans
            </button>
          </div>
        )}

        <div className="math-upload-actions">
          <button onClick={() => uploadRef.current?.click()}>Upload photo</button>
          <button className="quiet-btn" onClick={() => cameraRef.current?.click()}>
            Open camera
          </button>
          <input
            ref={uploadRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => setImageFile(event.target.files?.[0] || null)}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(event) => setImageFile(event.target.files?.[0] || null)}
          />
        </div>

        <label className="stack-field">
          <span>Question or instructions</span>
          <textarea
            className="math-question"
            value={state.question || ""}
            placeholder="Example: Solve for x and explain why each transformation is valid."
            onChange={(event) => onChange({ ...state, question: event.target.value, error: "" })}
          />
        </label>

        <div className="quick-prompts">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              className="chip-btn"
              onClick={() => onChange({ ...state, question: prompt })}
            >
              {prompt}
            </button>
          ))}
        </div>

        {previewUrl && (
          <div className="math-preview-card">
            <img src={previewUrl} alt="Selected math problem" className="math-preview-image" />
            <div className="math-preview-meta">
              <strong>{imageFile?.name || "Selected image"}</strong>
              <button
                type="button"
                className="quiet-btn danger"
                onClick={() => setImageFile(null)}
              >
                Remove image
              </button>
            </div>
          </div>
        )}

        <button
          className="math-solve-btn"
          onClick={solve}
          disabled={state.isLoading || (!String(state.question || "").trim() && !imageFile)}
        >
          {state.isLoading ? "Solving..." : "Solve with AI"}
        </button>

        {state.error && <div className="inline-alert">{state.error}</div>}
      </div>

      <div className="math-solution-panel">
        {state.isLoading && (
          <div className="math-loading">
            <div className="loading-orb" />
            <div>
              <strong>Analyzing your problem</strong>
              <p>Reading the prompt, detecting the math, and generating the worked solution.</p>
            </div>
          </div>
        )}

        {!state.isLoading && !activeResult && (
          <div className="math-empty-state">
            <div className="tool-eyebrow">Ready to solve</div>
            <h3>Camera-first math tutoring</h3>
            <p>
              This mode is designed to feel like a real AI solver: capture a worksheet, type a follow-up,
              and review the reasoning instead of only the final answer.
            </p>
            <div className="math-empty-grid">
              <div>
                <strong>1. Upload or type</strong>
                <span>Add a photo or describe the problem.</span>
              </div>
              <div>
                <strong>2. Inspect the method</strong>
                <span>See each step separated and explained.</span>
              </div>
              <div>
                <strong>3. Check understanding</strong>
                <span>Use the verification and follow-up ideas.</span>
              </div>
            </div>
          </div>
        )}

        {!state.isLoading && activeResult && (
          <div className="math-solution">
            <div className="solution-hero">
              <div>
                <div className="tool-eyebrow">Solved</div>
                <h3>{activeResult.title || "Worked solution"}</h3>
                <p>{activeResult.detectedProblem}</p>
              </div>
              <div className="answer-chip">
                <span>Final answer</span>
                <strong>{activeResult.finalAnswer || "See explanation"}</strong>
              </div>
            </div>

            {activeResult.summary && <div className="solution-summary">{activeResult.summary}</div>}

            <div className="step-list">
              {(activeResult.steps || []).map((step, index) => (
                <div key={`${step.title}-${index}`} className="step-card">
                  <div className="step-index">{index + 1}</div>
                  <div>
                    <h4>{step.title || `Step ${index + 1}`}</h4>
                    <p>{step.explanation}</p>
                  </div>
                </div>
              ))}
            </div>

            {activeResult.checks?.length > 0 && (
              <div className="result-section">
                <h4>Check the answer</h4>
                <ul>
                  {activeResult.checks.map((check) => (
                    <li key={check}>{check}</li>
                  ))}
                </ul>
              </div>
            )}

            {activeResult.followUps?.length > 0 && (
              <div className="result-section">
                <h4>Useful follow-ups</h4>
                <div className="follow-up-chips">
                  {activeResult.followUps.map((item) => (
                    <button
                      key={item}
                      className="chip-btn"
                      onClick={() => onChange({ ...state, question: item })}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {state.rawResponse && hasFullAccess && (
              <details className="raw-output">
                <summary>Raw model output</summary>
                <pre>{state.rawResponse}</pre>
              </details>
            )}
          </div>
        )}
      </div>

      <div className="math-history-panel">
        <div className="deck-header">
          <div>
            <div className="deck-title">Recent solves</div>
            <div className="deck-meta">{history.length} saved in this conversation</div>
          </div>
        </div>

        <div className="math-history-list">
          {visibleHistory.map((item) => (
            <button
              key={item.id}
              className={`history-card ${item.id === state.activeHistoryId ? "active" : ""}`}
              onClick={() => onChange({ ...state, activeHistoryId: item.id })}
            >
              <strong>{item.prompt}</strong>
              <span>{item.result?.finalAnswer || item.result?.summary || "View explanation"}</span>
            </button>
          ))}

          {history.length === 0 && (
            <div className="empty-state">Solved math problems will appear here for quick review.</div>
          )}

          {!hasFullAccess && history.length > visibleHistory.length && (
            <div className="plan-inline-note">
              Full access unlocks your complete solve history. Free shows the latest 3 solves.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MathWorkspace;
