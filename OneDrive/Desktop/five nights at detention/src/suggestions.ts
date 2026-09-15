import type { ScoreRow } from "./types";

export const FNAD_GENRE = "6th Nights game";

export type SuggestionReply = {
  id: number;
  title?: string;
  content: string;
  status: string;
  reply?: string;
  replied_by?: string;
};

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

export async function fetchReplies(username: string): Promise<SuggestionReply[]> {
  const name = (username || "").trim();
  if (!name) return [];
  try {
    const response = await fetch(`/api/suggestions/${encodeURIComponent(name)}`, {
      cache: "no-store"
    });
    if (!response.ok) return [];
    const type = response.headers.get("content-type") || "";
    if (!type.includes("application/json")) return [];
    const data = await response.json();
    if (!Array.isArray(data.notifications)) return [];
    return (data.notifications as SuggestionReply[]).filter((n) => n && n.reply);
  } catch {
    return [];
  }
}

export async function markRepliesSeen(username: string, ids: number[]): Promise<void> {
  const name = (username || "").trim();
  if (!name || !ids.length) return;
  try {
    await fetch("/api/notifications/seen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIdentifier: name, ids })
    });
  } catch {
    return;
  }
}

export async function reportSuggestion(text: string, username: string, night: number): Promise<boolean> {
  try {
    const response = await fetch("/api/suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `6 Nights at Detention · night ${night}`,
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
