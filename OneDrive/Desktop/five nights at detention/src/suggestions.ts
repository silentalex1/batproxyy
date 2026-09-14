import type { ScoreRow } from "./types";

export const FNAD_GENRE = "Five Nights game";

export async function postScore(row: ScoreRow): Promise<boolean> {
  try {
    const response = await fetch("/api/fnad-scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: row.name || "anonymous",
        night: row.night,
        minutes: row.minutes,
        result: row.result
      })
    });
    if (!response.ok) return false;
    const type = response.headers.get("content-type") || "";
    if (!type.includes("application/json")) return false;
    const data = await response.json();
    return Boolean(data && data.success);
  } catch {
    return false;
  }
}

export async function fetchScores(): Promise<ScoreRow[] | null> {
  try {
    const response = await fetch("/api/fnad-scores");
    if (!response.ok) return null;
    const type = response.headers.get("content-type") || "";
    if (!type.includes("application/json")) return null;
    const data = await response.json();
    return Array.isArray(data.scores) ? (data.scores as ScoreRow[]) : null;
  } catch {
    return null;
  }
}

export async function reportSuggestion(text: string, username: string, night: number): Promise<boolean> {
  try {
    const response = await fetch("/api/suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `Five Nights at Detention · night ${night}`,
        content: text.slice(0, 1000),
        userIdentifier: username || "anonymous",
        genre: FNAD_GENRE
      })
    });
    if (!response.ok) return false;
    const type = response.headers.get("content-type") || "";
    if (!type.includes("application/json")) return false;
    const data = await response.json();
    return Boolean(data && data.success);
  } catch {
    return false;
  }
}
