import { useMemo, useState } from "react";

const FULL_FEATURES = [
  "Deeper AI answers and math verification",
  "Up to 50 AI flashcards",
  "Up to 12 AI slides and all themes",
  "Bigger workspaces and longer history",
];

const FREE_FEATURES = [
  "Core chat and tutoring",
  "Basic math solving",
  "Up to 12 AI flashcards",
  "Up to 6 AI slides",
];

function getTrialDaysLeft(trialEndsAt) {
  const remainingMs = Number(trialEndsAt || 0) - Date.now();
  if (remainingMs <= 0) return 0;
  return Math.max(1, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
}

function detectBrand(number) {
  const digits = String(number || "").replace(/\D/g, "");
  if (digits.startsWith("4")) return "Visa";
  if (/^5[1-5]/.test(digits)) return "Mastercard";
  if (/^3[47]/.test(digits)) return "Amex";
  return "Card";
}

function maskNumber(number) {
  const digits = String(number || "").replace(/\D/g, "");
  return digits.slice(-4).padStart(4, "0");
}

function formatCardNumber(value) {
  return String(value || "")
    .replace(/\D/g, "")
    .slice(0, 16)
    .replace(/(\d{4})(?=\d)/g, "$1 ");
}

function BillingModal({ account, trialLengthDays = 7, onClose, onStartTrial, onUpgrade, onDowngrade }) {
  const [cardholder, setCardholder] = useState(account.paymentMethod?.holderName || "");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState(account.paymentMethod?.expiry || "");
  const [cvc, setCvc] = useState("");
  const [error, setError] = useState("");

  const isTrial = account.tier === "trial";
  const isFull = account.tier === "pro";
  const trialDaysLeft = isTrial ? getTrialDaysLeft(account.trialEndsAt) : 0;
  const canStartTrial = !account.hasUsedTrial && !isTrial && !isFull;
  const detectedBrand = useMemo(() => detectBrand(cardNumber), [cardNumber]);

  const submit = (event) => {
    event.preventDefault();
    const digits = cardNumber.replace(/\D/g, "");

    if (!cardholder.trim()) {
      setError("Cardholder name is required.");
      return;
    }

    if (digits.length < 12) {
      setError("Enter a valid card number.");
      return;
    }

    if (!/^\d{2}\/\d{2}$/.test(expiry)) {
      setError("Use MM/YY for the expiry date.");
      return;
    }

    if (!/^\d{3,4}$/.test(cvc)) {
      setError("Enter a valid CVC.");
      return;
    }

    setError("");
    onUpgrade({
      brand: detectedBrand,
      last4: maskNumber(cardNumber),
      holderName: cardholder.trim(),
      expiry,
    });
  };

  return (
    <div className="modal-shell" role="dialog" aria-modal="true">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="billing-modal">
        <div className="billing-header">
          <div>
            <div className="tool-eyebrow">Billing</div>
            <h3>Free, trial, and full version</h3>
          </div>
          <button type="button" className="quiet-btn" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="billing-plan-grid">
          <div className={`billing-plan-card ${account.tier === "free" ? "active" : ""}`}>
            <div className="plan-card-top">
              <div>
                <strong>Free</strong>
                <span>Free</span>
              </div>
              {account.tier === "free" && <span className="plan-status-pill">Current</span>}
            </div>
            <div className="plan-price">$0</div>
            <ul className="plan-feature-list">
              {FREE_FEATURES.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          </div>

          <div className={`billing-plan-card ${isTrial ? "active" : ""}`}>
            <div className="plan-card-top">
              <div>
                <strong>Free Trial</strong>
                <span>No card required</span>
              </div>
              {isTrial && <span className="plan-status-pill">Current</span>}
            </div>
            <div className="plan-price">
              $0
              <small>{`/${trialLengthDays} days`}</small>
            </div>
            <ul className="plan-feature-list">
              {FULL_FEATURES.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
            {isTrial ? (
              <button type="button" className="quiet-btn" onClick={onDowngrade}>
                End free trial
              </button>
            ) : canStartTrial ? (
              <button type="button" className="quiet-btn" onClick={onStartTrial}>
                Start free trial
              </button>
            ) : (
              <button type="button" className="quiet-btn" disabled>
                Trial already used
              </button>
            )}
            {isTrial && (
              <div className="payment-method-summary">
                {trialDaysLeft > 0
                  ? `${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left in your free trial`
                  : "Your free trial ends today"}
              </div>
            )}
          </div>

          <div className={`billing-plan-card pro ${isFull ? "active" : ""}`}>
            <div className="plan-card-top">
              <div>
                <strong>Full Version</strong>
                <span>All premium tools unlocked</span>
              </div>
              {isFull && <span className="plan-status-pill pro">Current</span>}
            </div>
            <div className="plan-price">
              $1.99
              <small>one time</small>
            </div>
            <ul className="plan-feature-list">
              {FULL_FEATURES.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
            {isFull && account.paymentMethod && (
              <div className="payment-method-summary">
                {account.paymentMethod.brand} ending in {account.paymentMethod.last4}
              </div>
            )}
            {isFull && (
              <button type="button" className="quiet-btn" onClick={onDowngrade}>
                Return to Free
              </button>
            )}
          </div>
        </div>

        {!isFull && (
          <form className="billing-form" onSubmit={submit}>
            <div className="deck-title">Payment for Full Version</div>
            <p className="deck-meta">
              Unlock everything for a one-time $1.99. This project currently stores billing state
              locally in the browser.
            </p>

            <label className="stack-field">
              <span>Cardholder name</span>
              <input
                type="text"
                value={cardholder}
                onChange={(event) => setCardholder(event.target.value)}
                placeholder="Jordan Lee"
              />
            </label>

            <label className="stack-field">
              <span>Card number</span>
              <input
                type="text"
                inputMode="numeric"
                value={cardNumber}
                onChange={(event) => setCardNumber(formatCardNumber(event.target.value))}
                placeholder="4242 4242 4242 4242"
              />
            </label>

            <div className="billing-inline-fields">
              <label className="stack-field">
                <span>Expiry</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={expiry}
                  onChange={(event) =>
                    setExpiry(
                      event.target.value
                        .replace(/[^\d]/g, "")
                        .slice(0, 4)
                        .replace(/(\d{2})(\d{0,2})/, (_, mm, yy) => (yy ? `${mm}/${yy}` : mm)),
                    )
                  }
                  placeholder="12/28"
                />
              </label>

              <label className="stack-field">
                <span>CVC</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={cvc}
                  onChange={(event) => setCvc(event.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="123"
                />
              </label>
            </div>

            {error && <div className="inline-alert">{error}</div>}

            <div className="billing-actions">
              <button type="submit">Unlock full version for $1.99</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default BillingModal;
