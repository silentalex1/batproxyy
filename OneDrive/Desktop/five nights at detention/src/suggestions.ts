export const FNAD_GENRE = "Five Nights game";

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
