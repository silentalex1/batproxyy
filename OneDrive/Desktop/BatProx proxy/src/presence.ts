let started = false;
let timer: ReturnType<typeof setInterval> | null = null;
let currentGame = '';

function username(): string {
  try { return localStorage.getItem('batprox-user') || ''; } catch { return ''; }
}

function sessionStart(): number {
  try {
    let s = Number(sessionStorage.getItem('batprox-session-start') || 0);
    if (!s) { s = Date.now(); sessionStorage.setItem('batprox-session-start', String(s)); }
    return s;
  } catch { return Date.now(); }
}

async function beat() {
  if (!username()) return;
  try {
    await fetch('/api/presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username(), visible: document.visibilityState === 'visible', game: currentGame, sessionStart: sessionStart() })
    });
  } catch {}
}

export function syncRecentIcons(games: any[]) {
  if (!Array.isArray(games) || games.length === 0) return;
  try {
    const key = 'batprox-recent-games';
    let arr: RecentGame[] = JSON.parse(localStorage.getItem(key) || '[]');
    let changed = false;
    for (const g of games) {
      const name = String((g && (g.title || g.name)) || '');
      if (!name) continue;
      const icon = String((g && (g.thumbnail || g.thumb || g.image || g.icon || g.cover)) || '');
      const url = String((g && (g.url || g.link || g.slug)) || '');
      const found = arr.find(x => x.name.toLowerCase() === name.toLowerCase());
      if (found && ((icon && found.icon !== icon) || (url && found.url !== url))) {
        if (icon) found.icon = icon;
        if (url) found.url = url;
        changed = true;
      }
    }
    if (changed) localStorage.setItem(key, JSON.stringify(arr.slice(0, 12)));
  } catch {}
}

export function setPresenceGame(game: string) {
  currentGame = game;
  beat();
}

export function startPresence() {
  if (started) return;
  started = true;
  beat();
  if (timer) clearInterval(timer);
  timer = setInterval(beat, 20000);
  document.addEventListener('visibilitychange', beat);
}

export function trackGameSeconds(game: string, seconds: number) {
  const s = Math.round(seconds);
  if (!game || s < 5 || !username()) return;
  try {
    const key = 'batprox-game-seconds';
    const map = JSON.parse(localStorage.getItem(key) || '{}');
    map[game] = (map[game] || 0) + s;
    localStorage.setItem(key, JSON.stringify(map));
  } catch {}
  fetch('/api/gamestats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: username(), game, seconds: s })
  }).catch(() => {});
}

export interface RecentGame { name: string; plays: number; ts: number; icon?: string; url?: string; }

export function recordRecentGame(name: string, extra?: { icon?: string; url?: string }) {
  if (!name) return;
  try {
    const key = 'batprox-recent-games';
    let arr: RecentGame[] = JSON.parse(localStorage.getItem(key) || '[]');
    const found = arr.find(x => x.name === name);
    if (found) {
      found.plays += 1; found.ts = Date.now();
      if (extra?.icon) found.icon = extra.icon;
      if (extra?.url) found.url = extra.url;
    }
    else arr.push({ name, plays: 1, ts: Date.now(), icon: extra?.icon || '', url: extra?.url || '' });
    arr.sort((a, b) => b.plays - a.plays || b.ts - a.ts);
    localStorage.setItem(key, JSON.stringify(arr.slice(0, 12)));
  } catch {}
}

export function getRecentGames(): RecentGame[] {
  try {
    const arr = JSON.parse(localStorage.getItem('batprox-recent-games') || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
