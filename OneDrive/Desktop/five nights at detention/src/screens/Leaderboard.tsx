import { useEffect, useState } from "react";
import type { ScoreRow, ScoreScope } from "../types";
import { formatClock } from "../game/systems/ai";
import { fetchScores } from "../suggestions";

type Props = {
  rows: ScoreRow[];
  onClose: () => void;
};

export function Leaderboard({ rows, onClose }: Props) {
  const [scope, setScope] = useState<ScoreScope>("global");
  const [global, setGlobal] = useState<ScoreRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetchScores().then((data) => {
      if (!alive) return;
      setGlobal(data);
      setLoading(false);
      if (!data) setScope("local");
    });
    return () => {
      alive = false;
    };
  }, []);

  const source = scope === "global" && global ? global : rows;
  const sorted = [...source].sort((a, b) => {
    if (a.result !== b.result) return a.result === "survived" ? -1 : 1;
    if (b.night !== a.night) return b.night - a.night;
    return b.minutes - a.minutes;
  });

  return (
    <div className="veil">
      <article className="slip tall">
        <p className="slip-stamp">HALL OF DETENTION</p>
        <h2>Leaderboard</h2>

        <div className="board-tabs">
          <button
            type="button"
            className={`board-tab ${scope === "global" ? "on" : ""}`}
            disabled={!global}
            onClick={() => setScope("global")}
          >
            Everyone
          </button>
          <button
            type="button"
            className={`board-tab ${scope === "local" ? "on" : ""}`}
            onClick={() => setScope("local")}
          >
            This device
          </button>
        </div>

        {loading && scope === "global" ? (
          <p className="empty-board">Loading scores…</p>
        ) : sorted.length === 0 ? (
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
              {sorted.slice(0, 12).map((row, i) => (
                <tr key={`${row.at}-${row.name}-${i}`}>
                  <td>{row.name || "anonymous"}</td>
                  <td>{row.night}</td>
                  <td>{formatClock(row.minutes)}</td>
                  <td className={row.result === "survived" ? "ok" : "bad"}>{row.result}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!global && !loading && <p className="board-note">Offline — showing this device only.</p>}

        <button type="button" className="paper-btn" onClick={onClose}>
          Close
        </button>
      </article>
    </div>
  );
}
