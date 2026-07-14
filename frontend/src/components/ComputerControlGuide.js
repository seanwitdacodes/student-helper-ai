function BrowserTabsGraphic() {
  return (
    <div className="computer-guide-graphic" aria-hidden="true">
      <div className="computer-guide-browser">
        <div className="computer-guide-browser-top">
          <span />
          <span />
          <span />
        </div>
        <div className="computer-guide-tabs">
          <div className="computer-guide-tab is-operator">Operator</div>
          <div className="computer-guide-tab is-workspace">Amazon</div>
          <div className="computer-guide-pill">Conductor side panel</div>
        </div>
        <div className="computer-guide-page">
          <div className="computer-guide-page-card">
            <div className="computer-guide-line short" />
            <div className="computer-guide-line" />
            <div className="computer-guide-line" />
            <div className="computer-guide-grid">
              <div />
              <div />
              <div />
            </div>
          </div>
          <div className="computer-guide-panel">
            <div className="computer-guide-panel-title">Conductor</div>
            <div className="computer-guide-bubble is-user">
              Open Amazon and search track spikes
            </div>
            <div className="computer-guide-bubble is-ai">
              Opening Amazon in a new tab and searching now.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepItem({ number, title, detail }) {
  return (
    <div className="computer-guide-step">
      <div className="computer-guide-step-number">{number}</div>
      <div>
        <strong>{title}</strong>
        <p>{detail}</p>
      </div>
    </div>
  );
}

function ComputerControlGuide() {
  return (
    <section className="computer-guide">
      <div className="computer-guide-copy">
        <div className="computer-guide-kicker">Computer Control Setup</div>
        <h2>Use Operator as the brain and Conductor as the browser worker.</h2>
        <p>
          Start tasks from Operator, let Conductor open the requested site in a
          new Chrome tab, and keep follow-up actions synced through the same
          shared session.
        </p>

        <div className="computer-guide-actions">
          <a
            className="computer-guide-action primary"
            href="/Conductor-extension.zip"
            download
          >
            Download Conductor Extension
          </a>
          <a
            className="computer-guide-action"
            href="https://support.google.com/chrome_webstore/answer/2664769"
            target="_blank"
            rel="noreferrer"
          >
            Chrome Extension Help
          </a>
        </div>

        <div className="computer-guide-steps">
          <StepItem
            number="1"
            title="Download the extension"
            detail="Use the download button above to save the Conductor extension zip, then unzip it on your computer."
          />
          <StepItem
            number="2"
            title="Open Chrome Extensions"
            detail='In Chrome, open chrome://extensions, turn on Developer mode, then click "Load unpacked".'
          />
          <StepItem
            number="3"
            title="Load the Conductor folder"
            detail="Choose the unzipped Conductor extension folder and pin the extension to your Chrome toolbar."
          />
          <StepItem
            number="4"
            title="Start a task from Operator"
            detail='Open Computer Control here, type something like "Open Amazon and search track spikes", and Conductor will take over in Chrome.'
          />
        </div>
      </div>

      <BrowserTabsGraphic />
    </section>
  );
}

export default ComputerControlGuide;
