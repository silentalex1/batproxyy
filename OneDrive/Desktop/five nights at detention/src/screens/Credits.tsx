type Props = {
  onClose: () => void;
};

export function Credits({ onClose }: Props) {
  return (
    <div className="veil">
      <article className="slip tall">
        <p className="slip-stamp">YEARBOOK STAFF</p>
        <h2>Credits</h2>
        <ul className="credit-list">
          <li>
            <span>Made by</span> Micah G.
          </li>
          <li>
            <span>Engine</span> Phaser 3 · React · TypeScript
          </li>
          <li>
            <span>Setting</span> RHS
          </li>
          <li>
            <span>Teachers</span> Math · Gym · Principal · History
          </li>
          <li>
            <span>Note</span> History teacher portrait coming soon
          </li>
        </ul>
        <button type="button" className="paper-btn" onClick={onClose}>
          Close
        </button>
      </article>
    </div>
  );
}
