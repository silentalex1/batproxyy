type Props = {
  onOk: () => void;
  onBack: () => void;
};

export function WarningNote({ onOk, onBack }: Props) {
  return (
    <div className="veil">
      <article className="slip warning">
        <p className="slip-stamp">OFFICE OF THE PRINCIPAL</p>
        <h2>Warning note.</h2>
        <p>
          This is my first game and its still being worked in progress. This game is still in beta, so
          please expect bugs, glitches, etc. If you found any bugs, glitches, or anything. Please report
          them to me by clicking the feedback button in the homepage or in-game.
        </p>
        <div className="slip-row">
          <button type="button" className="paper-btn dim" onClick={onBack}>
            Back
          </button>
          <button type="button" className="paper-btn" onClick={onOk}>
            Okay understood. Let me play.
          </button>
        </div>
      </article>
    </div>
  );
}
