function Sidebar({ mode, setMode }) {
  const modes = ["Tutor", "Student", "Math"];

  return (
    <div className="sidebar">
      <h2>Student Helper AI</h2>

      {modes.map((m) => (
        <button
          key={m}
          className={mode === m ? "active" : ""}
          onClick={() => setMode(m)}
        >
          {m} Mode
        </button>
      ))}

      <hr />

      <button disabled>📚 Flashcards</button>
      <button disabled>🖥 Slides</button>
    </div>
  );
}

export default Sidebar;
