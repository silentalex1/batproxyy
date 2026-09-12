import { useState } from "react";

type Props = {
  onSend: (text: string) => void;
  onClose: () => void;
};

export function FeedbackModal({ onSend, onClose }: Props) {
  const [text, setText] = useState("");
  const ready = text.trim().length > 3;

  return (
    <div className="veil">
      <form
        className="slip tall"
        onSubmit={(e) => {
          e.preventDefault();
          if (!ready) return;
          onSend(text.trim());
        }}
      >
        <p className="slip-stamp">SUGGESTION BOX</p>
        <h2>Feedback</h2>
        <textarea
          rows={6}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Report any bugs, glitches, or any game improvements that you want me to add onto the game."
        />
        <div className="slip-row">
          <button type="button" className="paper-btn dim" onClick={onClose}>
            Close
          </button>
          <button type="submit" className="paper-btn" disabled={!ready}>
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
