import { useState } from "react";

function Slides() {
  const [notes, setNotes] = useState("");
  const [slides, setSlides] = useState("");

  const generate = async () => {
    const res = await fetch("http://localhost:5050/slides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    const data = await res.json();
    setSlides(data.slides);
  };

  return (
    <div className="tool">
      <textarea
        placeholder="Paste notes here..."
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <button onClick={generate}>Generate Slides</button>
      <pre>{slides}</pre>
    </div>
  );
}

export default Slides;
