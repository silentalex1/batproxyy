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
      const id = media.id || gameIdOf(name);
      const found = arr.find(x => x.id === id);
      if (found && ((media.icon && found.icon !== media.icon) || (media.url && found.url !== media.url))) {
        if (media.icon) found.icon = media.icon;
        if (media.url) found.url = media.url;
        if (!found.title || found.title === found.id) found.title = prettyTitle(id);
        found.unavailable = false;
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
  timer = setInterval(beat, 10000);
  document.addEventListener('visibilitychange', beat);
  window.addEventListener('beforeunload', () => {
    try {
      const u = username();
      if (!u) return;
      fetch('/api/presence', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, visible: false, game: '', sessionStart: sessionStart() }), keepalive: true });
    } catch {}
  });
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

export interface RecentGame { id: string; title: string; plays: number; ts: number; icon?: string; url?: string; secs?: number; unavailable?: boolean }

export function gameIdOf(name: string): string {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '/').replace(/^\/+|\/+$/g, '').slice(0, 80);
}

export function prettyTitle(id: string): string {
  const seg = String(id || '').split('/').filter(Boolean).pop() || id;
  return seg.split(/[-_ ]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || 'game';
}

function readRecents(): RecentGame[] {
  try {
    const arr = JSON.parse(localStorage.getItem('batprox-recent-games') || '[]');
    if (!Array.isArray(arr)) return [];
    return arr.filter(x => x && (x.id || x.name)).map(x => {
      const rawId = String(x.id || '');
      const rawName = String(x.name || x.title || '');
      const id = rawId || gameIdOf(rawName);
      return {
        id,
        title: String(x.title || rawName || prettyTitle(id)),
        plays: Math.max(0, parseInt(x.plays, 10) || 0),
        ts: Number(x.ts) || 0,
        icon: String(x.icon || ''),
        url: String(x.url || ''),
        secs: Math.max(0, parseInt(x.secs, 10) || 0),
        unavailable: !!x.unavailable
      };
    }).filter(x => x.id);
  } catch { return []; }
}

function saveRecents(arr: RecentGame[]) {
  const top = arr.filter(x => x.id).slice(0, 12);
  try { localStorage.setItem('batprox-recent-games', JSON.stringify(top)); } catch {}
  const u = username();
  if (u) {
    fetch('/api/recentgames', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, games: top }) }).catch(() => {});
  }
}

export function recordRecentGame(name: string, extra?: { icon?: string; url?: string; id?: string }) {
  commitRecent(name, extra);
}

export function commitRecent(name: string, extra?: { icon?: string; url?: string; id?: string }) {
  const id = (extra?.id && String(extra.id)) || gameIdOf(name);
  if (!id) return;
  try {
    const arr = readRecents();
    const found = arr.find(x => x.id === id);
    if (found) {
      found.plays += 1; found.ts = Date.now();
      if (!found.title || found.title === found.id) found.title = prettyTitle(id);
      if (extra?.icon) found.icon = extra.icon;
      if (extra?.url) found.url = extra.url;
      found.unavailable = false;
    } else {
      arr.push({ id, title: prettyTitle(id), plays: 1, ts: Date.now(), icon: extra?.icon || '', url: extra?.url || '', secs: 0 });
    }
    saveRecents(arr);
  } catch {}
}

export function bumpRecentSecs(name: string, secs: number) {
  const id = gameIdOf(name);
  if (!id || !secs) return;
  try {
    const arr = readRecents();
    const found = arr.find(x => x.id === id);
    if (found) { found.secs = (found.secs || 0) + Math.round(secs); saveRecents(arr); }
  } catch {}
}

export function markRecentUnavailable(id: string) {
  try {
    const arr = readRecents();
    const found = arr.find(x => x.id === id);
    if (found) { found.unavailable = true; saveRecents(arr); }
  } catch {}
}

export function removeRecent(id: string) {
  try { saveRecents(readRecents().filter(x => x.id !== id)); } catch {}
}

export function clearRecents() {
  try { saveRecents([]); } catch {}
}

export async function loadServerRecents(): Promise<RecentGame[]> {
  const u = username();
  if (!u) return getRecentGames();
  try {
    const r = await fetch('/api/recentgames?user=' + encodeURIComponent(u));
    if (!r.ok) return getRecentGames();
    const d = await r.json();
    const server: any[] = Array.isArray(d.games) ? d.games : [];
    let local: RecentGame[] = readRecents();
    for (const s of server) {
      const sid = String(s.id || gameIdOf(s.name || ''));
      if (!sid) continue;
      const f = local.find(x => x.id === sid);
      if (f) {
        f.plays = Math.max(f.plays, s.plays || 0);
        f.secs = Math.max(f.secs || 0, s.secs || 0);
        if ((!f.icon || f.icon === '') && s.icon) f.icon = s.icon;
        if ((!f.url || f.url === '') && s.url) f.url = s.url;
        if ((!f.title || f.title === f.id) && s.title) f.title = s.title;
        f.ts = Math.max(f.ts, s.ts || 0);
      } else {
        local.push({ id: sid, title: String(s.title || s.name || prettyTitle(sid)), plays: s.plays || 0, ts: s.ts || 0, icon: s.icon || '', url: s.url || '', secs: s.secs || 0 });
      }
    }
    saveRecents(local);
    return readRecents();
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
  return readRecents();
}
