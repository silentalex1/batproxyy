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
      const media = extractGameMedia(g);
      const icon = media.icon;
      const url = media.url;
      const id = media.id;
      const found = arr.find(x => x.name.toLowerCase() === name.toLowerCase() || (id && x.id === id));
      if (found && ((icon && found.icon !== icon) || (url && found.url !== url) || (id && found.id !== id))) {
        if (icon) found.icon = icon;
        if (url) found.url = url;
        if (id) found.id = id;
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

export interface RecentGame { name: string; plays: number; ts: number; icon?: string; url?: string; id?: string; }

function saveRecents(arr: RecentGame[]) {
  arr.sort((a, b) => b.plays - a.plays || b.ts - a.ts);
  const top = arr.slice(0, 12);
  try { localStorage.setItem('batprox-recent-games', JSON.stringify(top)); } catch {}
  const u = username();
  if (u) {
    fetch('/api/recentgames', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, games: top }) }).catch(() => {});
  }
}

export function recordRecentGame(name: string, extra?: { icon?: string; url?: string; id?: string }) {
  if (!name) return;
  try {
    const key = 'batprox-recent-games';
    let arr: RecentGame[] = JSON.parse(localStorage.getItem(key) || '[]');
    const id = extra?.id || '';
    const found = arr.find(x => x.name === name || (id && x.id === id));
    if (found) {
      found.plays += 1; found.ts = Date.now();
      if (extra?.icon) found.icon = extra.icon;
      if (extra?.url) found.url = extra.url;
      if (id) found.id = id;
    }
    else arr.push({ name, plays: 1, ts: Date.now(), icon: extra?.icon || '', url: extra?.url || '', id });
    saveRecents(arr);
  } catch {}
}

export async function loadServerRecents(): Promise<RecentGame[]> {
  const u = username();
  if (!u) return getRecentGames();
  try {
    const r = await fetch('/api/recentgames?user=' + encodeURIComponent(u));
    if (!r.ok) return getRecentGames();
    const d = await r.json();
    const server: RecentGame[] = Array.isArray(d.games) ? d.games : [];
    let local: RecentGame[] = getRecentGames();
    for (const s of server) {
      const f = local.find(x => x.name === s.name);
      if (f) {
        f.plays = Math.max(f.plays, s.plays || 0);
        if (!f.icon && s.icon) f.icon = s.icon;
        if (!f.url && s.url) f.url = s.url;
        if (!f.id && s.id) f.id = s.id;
        f.ts = Math.max(f.ts, s.ts || 0);
      } else local.push(s);
    }
    local.sort((a, b) => b.plays - a.plays || b.ts - a.ts);
    const top = local.slice(0, 12);
    try { localStorage.setItem('batprox-recent-games', JSON.stringify(top)); } catch {}
    return top;
  } catch { return getRecentGames(); }
}

export function extractGameMedia(game: any): { icon: string; url: string; id: string } {
  let icon = '';
  let url = '';
  let id = '';
  try {
    id = String(game?.id || game?.slug || game?.key || game?.gameId || '').trim();
    icon = String(game?.icon || game?.image || game?.thumbnail || game?.cover || game?.thumb || '').trim();
    url = String(game?.url || game?.playUrl || game?.href || game?.src || game?.embed || '').trim();
    const imgs: string[] = [];
    const links: string[] = [];
    const walk = (v: any, depth: number) => {
      if (depth > 2 || v === null || v === undefined) return;
      if (typeof v === 'string') {
        const t = v.trim();
        if (/^https?:\/\/[^ ]+\.(png|jpe?g|webp|gif|svg|ico)(\?[^ ]*)?$/i.test(t)) imgs.push(t);
        else if (/^https?:\/\/[^ ]+$/i.test(t) && t.length < 300) links.push(t);
        return;
      }
      if (Array.isArray(v)) { for (const x of v.slice(0, 8)) walk(x, depth + 1); return; }
      if (typeof v === 'object') { for (const k of Object.keys(v).slice(0, 20)) walk(v[k], depth + 1); }
    };
    walk(game, 0);
    const pick = (arr: string[], keys: string[]) => {
      for (const k of keys) { const f = arr.find(u => u.toLowerCase().includes(k)); if (f) return f; }
      return arr[0] || '';
    };
    if (!icon) icon = pick(imgs, ['thumb', 'thumbnail', 'icon', 'cover', 'art', 'image', 'logo']);
    if (!url) url = pick(links, ['play', 'game', 'embed', 'launch']);
    if (!id) {
      const n = String(game?.title || game?.name || '');
      if (n.includes('/')) id = n;
    }
  } catch {}
  return { icon, url, id };
}

export function getRecentGames(): RecentGame[] {
  try {
    const arr = JSON.parse(localStorage.getItem('batprox-recent-games') || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
