import type { ScoreRow } from "../types";
import { formatClock } from "../game/systems/ai";

type Props = {
  rows: ScoreRow[];
  onClose: () => void;
};

export function Leaderboard({ rows, onClose }: Props) {
  const sorted = [...rows].sort((a, b) => {
    if (a.result !== b.result) return a.result === "survived" ? -1 : 1;
    if (b.night !== a.night) return b.night - a.night;
    return b.minutes - a.minutes;
  });

  return (
    <div className="veil">
      <article className="slip tall">
        <p className="slip-stamp">HALL OF DETENTION</p>
        <h2>Leaderboard</h2>
        {sorted.length === 0 ? (
          <p className="empty-board">No nights recorded yet.</p>
        ) : (
          <table className="board">
            <thead>
              <tr>
                <th>Name</th>
                <th>Night</th>
                <th>Time</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {sorted.slice(0, 12).map((row) => (
                <tr key={`${row.at}-${row.name}`}>
                  <td>{row.name}</td>
                  <td>{row.night}</td>
                  <td>{formatClock(row.minutes)}</td>
                  <td className={row.result === "survived" ? "ok" : "bad"}>{row.result}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <button type="button" className="paper-btn" onClick={onClose}>
          Close
        </button>
      </article>
    </div>
  );
}
