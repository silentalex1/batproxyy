const KEY = "fnad_save_v1";

export function defaultSave() {
  return {
    username: "",
    nightsCleared: 0,
    settings: { volume: 0.72, pan: 0.16, flicker: true },
    leaderboard: [],
    feedback: []
  };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw);
    return { ...defaultSave(), ...parsed, settings: { ...defaultSave().settings, ...(parsed.settings || {}) } };
  } catch {
    return defaultSave();
  }
}

export function writeSave(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
  return data;
}

export function patchSave(partial) {
  const next = { ...loadSave(), ...partial };
  return writeSave(next);
}
