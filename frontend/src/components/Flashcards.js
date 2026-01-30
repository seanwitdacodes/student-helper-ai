import { useState } from "react";

function Flashcards() {
  const [notes, setNotes] = useState("");
  const [cards, setCards] = useState("");

  const generate = async () => {
    const res = await fetch("http://localhost:5050/flashcards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    const data = await res.json();
    setCards(data.cards);
  };

  return (
    <div className="tool">
      <textarea
        placeholder="Paste notes here..."
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <button onClick={generate}>Generate Flashcards</button>
      <pre>{cards}</pre>
    </div>
  );
}

export default Flashcards;
