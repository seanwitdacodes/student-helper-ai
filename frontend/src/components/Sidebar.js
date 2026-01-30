function Sidebar({ mode, setMode, setView }) {
  const modes = ["Answer", "Tutor", "Math"];

  return (
    <div className="sidebar">
      <h2>Student Helper AI</h2>

      {modes.map((m) => (
        <button
          key={m}
          className={mode === m ? "active" : ""}
          onClick={() => {
            setMode(m);
            setView("chat");
          }}
        >
          {m} Mode
        </button>
      ))}

      <hr />

      <button onClick={() => setView("flashcards")}>📚 Flashcards</button>
      <button onClick={() => setView("slides")}>🖥 Slides</button>
    </div>
  );
}

export default Sidebar;
