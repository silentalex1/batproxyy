import { useState } from "react";

type Props = {
  onEnroll: (name: string) => void;
  onBack: () => void;
};

export function EnrollModal({ onEnroll, onBack }: Props) {
  const [name, setName] = useState("");
  const trimmed = name.trim();

  return (
    <div className="veil">
      <form
        className="slip enroll"
        onSubmit={(e) => {
          e.preventDefault();
          if (trimmed) onEnroll(trimmed);
        }}
      >
        <p className="slip-stamp">DETENTION ENROLLMENT</p>
        <h2>Enter your username</h2>
        <label htmlFor="uname">Username:</label>
        <input
          id="uname"
          autoFocus
          maxLength={18}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your username here:"
          autoComplete="off"
        />
        <div className="slip-row">
          <button type="button" className="paper-btn dim" onClick={onBack}>
            Back
          </button>
          <button type="submit" className="paper-btn" disabled={!trimmed}>
            Enroll
          </button>
        </div>
      </form>
    </div>
  );
}
