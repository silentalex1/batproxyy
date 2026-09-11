const LEGACY = 'batprox-display';
const OWNER = 'batprox-display-owner';

export function displayKey(user: string): string {
  return 'batprox-display:' + user;
}

export function currentUser(): string {
  try { return localStorage.getItem('batprox-user') || ''; } catch { return ''; }
}

export function getDisplayName(user?: string): string {
  const u = user || currentUser();
  if (!u) return '';
  try {
    const own = localStorage.getItem(displayKey(u));
    if (own) return own;
    if (localStorage.getItem(OWNER) === u) return localStorage.getItem(LEGACY) || '';
    return '';
  } catch {
    return '';
  }
}

export function setDisplayName(name: string, user?: string) {
  const u = user || currentUser();
  if (!u) return;
  const v = String(name || '').trim().slice(0, 24);
  try {
    if (!v) {
      localStorage.removeItem(displayKey(u));
    } else {
      localStorage.setItem(displayKey(u), v);
      localStorage.setItem(LEGACY, v);
      localStorage.setItem(OWNER, u);
    }
  } catch {}
}

export function forgetDisplayName(user?: string) {
  const u = user || currentUser();
  try {
    if (u) localStorage.removeItem(displayKey(u));
    localStorage.removeItem(LEGACY);
    localStorage.removeItem(OWNER);
  } catch {}
}

export async function saveDisplayName(name: string, user?: string): Promise<boolean> {
  const u = user || currentUser();
  const v = String(name || '').trim().slice(0, 24);
  if (!u || !v) return false;
  setDisplayName(v, u);
  let ok = false;
  try {
    const r = await fetch('/api/chat/name', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, display: v }) });
    ok = r.ok;
  } catch {}
  try {
    const pr = await fetch('/api/chat/profiles', { cache: 'no-store' });
    if (pr.ok) {
      const d = await pr.json();
      const mine = (d.profiles || {})[u] || {};
      await fetch('/api/chat/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, display: v, bio: mine.bio || '', pfp: mine.pfp || '' }) });
    }
  } catch {}
  return ok;
}

export async function fetchDisplayName(user?: string): Promise<string> {
  const u = user || currentUser();
  if (!u) return '';
  try {
    const r = await fetch('/api/chat/name?user=' + encodeURIComponent(u), { cache: 'no-store' });
    if (!r.ok) return '';
    const d = await r.json();
    const v = String(d.display || '');
    if (v && v !== u) { setDisplayName(v, u); return v; }
    return '';
  } catch {
    return '';
  }
}
